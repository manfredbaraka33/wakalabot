import asyncio
from asyncio.log import logger
import json
import math
import re
import uuid
from typing import Any, List, Optional

# ── Google GenAI Native SDK ───────────────────────────────────────────────────
from google import genai
from google.genai import types

try:
    from langchain.embeddings.huggingface import HuggingFaceEmbeddings  # type: ignore
except Exception:
    try:
        from langchain.embeddings import HuggingFaceEmbeddings  # type: ignore
    except Exception:
        HuggingFaceEmbeddings = None
        from sentence_transformers import SentenceTransformer

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import settings
from app.models import Conversation, KnowledgeBase, Message, Notification, Transaction, Wallet
from app.tools import TOOLS, ToolExecutor

HISTORY_WINDOW = 10
MAX_TOOL_ROUNDS = 5

# ── Pricing ───────────────────────────────────────────────────────────────────
PRICING = {
    "eco": {
        "model": "gemini-3.1-flash-lite",
        "input_per_1k":  0.00025,
        "output_per_1k": 0.00150,
    },
    "smart": {
        "model": "gemini-3.5-flash",
        "input_per_1k":  0.00150,
        "output_per_1k": 0.00900,
    },
}

_IMAGE_TAG_RE = re.compile(r"\[IMAGE_URL:\s*(https?://[^\]]+)\]", re.IGNORECASE)
_FORCE_IMAGE_RE = re.compile(r"\bFORCE_IMAGE\b", re.IGNORECASE)
_RAW_CLOUDINARY_RE = re.compile(r"https?://res\.cloudinary\.com/\S+", re.IGNORECASE)

_NAME_RE = re.compile(
    r"(?:naitwa|jina\s+langu\s+ni|my\s+name\s+is|i(?:'|')?m\s+called)"
    r"\s+([A-Za-z][A-Za-z\s]{1,40})",
    re.IGNORECASE,
)

def _period_label(duration_days: int) -> str:
    """Turns a plan's duration into natural Swahili phrasing for notifications."""
    if duration_days <= 1:
        return "siku ya leo"
    if duration_days <= 7:
        return "wiki hii"
    if duration_days <= 31:
        return "mwezi huu"
    return f"kipindi cha siku {duration_days}"


def _extract_image(text: str) -> tuple[Optional[str], str]:
    """Legacy single-image extractor — kept for backward compatibility."""
    m = _IMAGE_TAG_RE.search(text)
    url = m.group(1).strip().rstrip(".,;:)!?'\"") if m else None
    clean = _IMAGE_TAG_RE.sub("", text) if m else text
    clean = _FORCE_IMAGE_RE.sub("", clean).strip()
    return url, clean


def _extract_all_images(text: str) -> tuple[list[str], str]:
    """Extract ALL [IMAGE_URL: ...] tags from AI response.
    Returns (list_of_urls, cleaned_text_with_tags_removed).
    """
    urls = []
    for m in _IMAGE_TAG_RE.finditer(text):
        url = m.group(1).strip().rstrip(".,;:)!?'\"")
        if url:
            urls.append(url)
    clean = _IMAGE_TAG_RE.sub("", text)
    clean = _FORCE_IMAGE_RE.sub("", clean).strip()
    return urls, clean


def _normalize_schema(schema: dict) -> dict:
    if not isinstance(schema, dict):
        return schema
    new_schema = schema.copy()
    if "type" in new_schema and isinstance(new_schema["type"], str):
        new_schema["type"] = new_schema["type"].upper()
    if "properties" in new_schema and isinstance(new_schema["properties"], dict):
        new_schema["properties"] = {
            k: _normalize_schema(v) for k, v in new_schema["properties"].items()
        }
    if "items" in new_schema and isinstance(new_schema["items"], dict):
        new_schema["items"] = _normalize_schema(new_schema["items"])
    return new_schema


def _extract_text(response) -> str:
    try:
        if not response.candidates:
            return ""
        parts = response.candidates[0].content.parts or []
        texts = [p.text for p in parts if getattr(p, "text", None)]
        return "".join(texts).strip()
    except Exception:
        return ""


# ── Commerce tool sets ─────────────────────────────────────────────────────────

_COMMERCE_CORE_TOOL_NAMES = {
    "get_product_catalog", "get_service_catalog", "get_product_by_name",
    "get_service_by_name", "get_shop_info", "check_stock",
    "search_knowledge_base", "save_lead", "save_customer_note",
    "calculate_order_total", "get_customer_history", "log_unanswered_question",
}

_EXTENDED_TOOL_NAMES = {
    "calculate_delivery_cost", "create_notification", "escalate_to_human",
    "generate_insight", "fetch_business_website", "search_web", "context_restore",
}


def _get_commerce_tools_for_context(user_input: str, history_text: str) -> list[types.Tool]:
    combined_text = (user_input + history_text).lower()
    needs_extended = any(kw in combined_text for kw in [
        "delivery", "deliver", "mkopo", "escalat", "website", "tovuti",
        "internet", "search", "hasira", "angry", "complaint",
    ])
    tool_set = [
        t for t in TOOLS
        if t["function"]["name"] in _COMMERCE_CORE_TOOL_NAMES
        or (needs_extended and t["function"]["name"] in _EXTENDED_TOOL_NAMES)
    ]
    declarations = []
    for t in tool_set:
        f = t["function"]
        norm_params = _normalize_schema(f.get("parameters", {}))
        declarations.append(types.FunctionDeclaration(
            name=f["name"],
            description=f["description"],
            parameters=norm_params,
        ))
    return [types.Tool(function_declarations=declarations)]


def _get_info_tools() -> list[types.Tool]:
    """Info bots get a fixed, small tool set — no context filtering needed
    since there's no commerce/extended split to worry about."""
    from app.info_tools import INFO_TOOLS
    declarations = []
    for t in INFO_TOOLS:
        f = t["function"]
        norm_params = _normalize_schema(f.get("parameters", {}))
        declarations.append(types.FunctionDeclaration(
            name=f["name"],
            description=f["description"],
            parameters=norm_params,
        ))
    return [types.Tool(function_declarations=declarations)]


# ── Prompt builders ─────────────────────────────────────────────────────────────

def _build_commerce_prompt(
    biz_name: str, customer_ctx: str, post_deal: str,
    notice_block: str, auth_rule: str,
) -> str:
    return (
        f"You are a sharp, warm customer service agent for {biz_name} in Tanzania.\n"
        f"{customer_ctx}{post_deal}{notice_block}{auth_rule}\n"
        f"\nABSOLUTE RULES:\n"
        f"\n1. NEVER GUESS BUSINESS DATA.\n"
        f"Always call a tool before answering questions about products, services, prices,\n"
        f"stock, location, hours, or delivery. If the tool returns found=false, tell the\n"
        f"customer that item or info is not available. Never invent any price, stock count,\n"
        f"or business detail.\n"
        f"\n2. LANGUAGE.\n"
        f"Default Swahili. Match customer's language exactly.\n"
        f"One honorific per reply maximum ('boss', 'mkuu').\n"
        f"\n3. PURCHASE FLOW.\n"
        f"- Confirm item and price from tool data.\n"
        f"- Always quote prices using 'price_display' field from tool results, never 'price_tzs'.\n"
        f"- For range prices say: 'Bei ni X–Y TZS kulingana na...' and ask what they need.\n"
        f"- If customer name unknown: ask naturally before saving lead.\n"
        f"- Once name known and intent clear: call save_lead immediately.\n"
        f'- After lead saved: "Biashara itawasiliana nawe hivi karibuni." Close the topic.\n'
        f"\n3b. FULL CATALOG LISTS — CRITICAL, NEVER VIOLATE.\n"
        f"When a customer asks for the full list of products or services (e.g. 'mna nini',\n"
        f"'orodha ya bidhaa', 'onyesha zote'), call get_product_catalog or get_service_catalog,\n"
        f"then COPY the 'formatted_list' field EXACTLY, character-for-character, into your\n"
        f"reply — do not retype, shorten, summarize, reorder, or omit ANY line from it.\n"
        f"Add only a short one-line intro before it and one short question after it.\n"
        f"NEVER generate the list yourself from memory of the conversation.\n"
        f"\n4. IMAGES.\n"
        f"Only send images when customer says 'picha', 'onyesha', 'show me', 'nitumie picha'.\n"
        f"When requested, send ALL available images for the product by including every URL "
        f"found in the all_images list.\n"
        f"Place each [IMAGE_URL: url] tag on its own line at the very end of your response.\n"
        f"Never invent image URLs. Only use valid URLs provided in the product data.\n"
        f"\n5. FAREWELLS.\n"
        f"'bye', 'nakuaga', 'baadaye' → one short warm farewell, stop.\n"
        f"\n6. ESCALATION.\n"
        f"Angry or complex issue → escalate_to_human tool.\n"
        f"\n7. INSIGHTS.\n"
        f"Valuable observations → save_customer_note or generate_insight.\n"
    )


def _build_info_prompt(
    biz_name: str, customer_ctx: str, notice_block: str, auth_rule: str,
) -> str:
    return (
        f"You are a knowledgeable, calm information assistant for {biz_name} in Tanzania.\n"
        f"{customer_ctx}{notice_block}{auth_rule}\n"
        f"\nWho you are: You answer questions about {biz_name} accurately, using only what's "
        f"in the knowledge base. You do NOT sell anything, quote prices, or handle purchases.\n"
        f"\nABSOLUTE RULES:\n"
        f"\n1. NEVER GUESS.\n"
        f"Always call search_knowledge_base or get_org_info before answering factual questions. "
        f"If not found, say so honestly — never invent policy, dates, or facts.\n"
        f"\n2. LANGUAGE.\n"
        f"Default Swahili. Match the person's language exactly.\n"
        f"\n3. WHEN SOMEONE NEEDS FOLLOW-UP.\n"
        f"If they want a human to contact them about something specific (application, "
        f"complaint, detailed question), ask their name and phone number, then call "
        f"save_inquiry with a short topic summary.\n"
        f"\n4. NO IMAGES.\n"
        f"This bot has no product images — never attempt [IMAGE_URL: ...] tags.\n"
        f"\n5. ESCALATION.\n"
        f"If the person is upset or the issue is sensitive → escalate_to_human.\n"
        f"\n6. UNANSWERED.\n"
        f"If search_knowledge_base returns found=false and you truly cannot help, call "
        f"log_unanswered_question, then tell them honestly you don't have that information "
        f"yet and suggest they contact the office directly.\n"
    )


class AIEngine:

    def __init__(self, hf_model: str = "all-MiniLM-L6-v2") -> None:
        if HuggingFaceEmbeddings is not None:
            self.embeddings = HuggingFaceEmbeddings(model_name=hf_model)
            self._use_langchain = True
        else:
            self._hf_model = SentenceTransformer(hf_model)
            self._use_langchain = False

        self.client = genai.Client(api_key=settings.GEMINI_API_KEY)

    def _get_embedder(self) -> Any:
        return self.embeddings if self._use_langchain else self._hf_model

    async def _embed(self, text: str) -> List[float]:
        if self._use_langchain:
            return await asyncio.to_thread(self.embeddings.embed_query, text)
        vec = await asyncio.to_thread(
            self._hf_model.encode, text, show_progress_bar=False
        )
        return vec.tolist() if hasattr(vec, "tolist") else list(vec)

    async def add_knowledge(
        self, db: AsyncSession, tenant_id: uuid.UUID, content: str
    ) -> uuid.UUID:
        emb = await self._embed(content)
        kb = KnowledgeBase(tenant_id=tenant_id, content=content, embedding=emb)
        db.add(kb)
        await db.flush()
        await db.commit()
        return kb.id

    async def ingest_product(
        self,
        db: AsyncSession,
        tenant_id: uuid.UUID,
        name: str,
        price: float,
        description: str,
        image_url: Optional[str] = None,
    ) -> uuid.UUID:
        content = f"Product: {name}\nPrice: {price}\nDescription: {description}"
        emb = await self._embed(content)
        kb = KnowledgeBase(
            tenant_id=tenant_id, content=content,
            embedding=emb, image_url=image_url,
        )
        db.add(kb)
        await db.flush()
        await db.commit()
        return kb.id

    async def _get_or_create_conversation(
        self, db: AsyncSession, tenant_id: uuid.UUID, customer_phone: str
    ) -> Conversation:
        result = await db.execute(
            select(Conversation)
            .where(
                Conversation.tenant_id == tenant_id,
                Conversation.customer_phone == customer_phone,
            )
            .order_by(Conversation.created_at.desc())
            .limit(1)
        )
        conv = result.scalars().first()

        if conv is None:
            conv = Conversation(tenant_id=tenant_id, customer_phone=customer_phone)
            db.add(conv)
            await db.flush()

        return conv

    async def _load_history(
        self, db: AsyncSession, conversation_id: uuid.UUID
    ) -> List[Message]:
        result = await db.execute(
            select(Message)
            .where(Message.conversation_id == conversation_id)
            .order_by(Message.timestamp.desc(), Message.sequence_id.desc())
            .limit(HISTORY_WINDOW)
        )
        return list(reversed(result.scalars().all()))

    async def _record_usage(
        self,
        db: AsyncSession,
        tenant_id: uuid.UUID,
        prompt_tokens: int,
        completion_tokens: int,
        mode: str,
    ) -> None:
        """Subscription-only usage recording. No coins, no wallet fallback —
        _check_wallet in api.py already guarantees an active subscription
        exists before get_answer is ever called, so this only records the
        usage and fires threshold warnings. If somehow no subscription is
        found here (edge case / race), we simply skip recording rather
        than fail the whole request."""
        from datetime import datetime, timezone
        from app.models import Subscription

        pricing = PRICING.get(mode, PRICING["eco"])
        usd = (
            (prompt_tokens / 1000) * pricing["input_per_1k"]
            + (completion_tokens / 1000) * pricing["output_per_1k"]
        )

        now = datetime.now(timezone.utc)
        sub_result = await db.execute(
            select(Subscription).where(
                Subscription.tenant_id == tenant_id,
                Subscription.status == "active",
                Subscription.expires_at > now,
            )
        )
        sub = sub_result.scalar_one_or_none()

        if not sub:
            return  # No active subscription — nothing to record against

        sub.messages_used += 1
        usage_pct = (sub.messages_used / sub.messages_included) * 100

        from app.sms import send_sms
        from app.models import Tenant as TenantModel
        tenant_obj = (await db.execute(
            select(TenantModel).where(TenantModel.id == tenant_id)
        )).scalar_one_or_none()

       
        if sub.messages_used >= sub.messages_included:
            period_label = _period_label(sub.duration_days)
            db.add(Notification(
                tenant_id=tenant_id,
                type="insight",
                message=(
                    f"⚠️ Umefika kikomo cha mazungumzo kwa {period_label} "
                    f"({sub.messages_included} mazungumzo). "
                    f"Nunua mpango mpya kuendelea."
                ),
                is_read=False,
            ))
            if tenant_obj and tenant_obj.phone:
                await send_sms(
                    tenant_obj.phone,
                    f"⚠️ Mazungumzo ya mpango wako yamefika kikomo "
                    f"({sub.messages_included}). Nunua mpango mpya kuendelea."
                )
        elif usage_pct >= 75 and (sub.messages_used - 1) / sub.messages_included * 100 < 75:
            if tenant_obj and tenant_obj.phone:
                await send_sms(
                    tenant_obj.phone,
                    f"📊 Umetumia {sub.messages_used}/{sub.messages_included} "
                    f"mazungumzo (75%) ya mpango wako wa sasa."
                )

        db.add(Transaction(
            tenant_id=tenant_id,
            wallet_id=(await db.execute(
                select(Wallet.id).where(Wallet.tenant_id == tenant_id)
            )).scalar_one_or_none(),
            coin_amount=0,
            tx_type="subscription_usage",
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            usd_cost=usd,
            note=f"Subscription ({sub.plan_id}) message {sub.messages_used}/{sub.messages_included}",
        ))

    async def get_answer(
        self,
        db: AsyncSession,
        user_input: str,
        tenant_id: uuid.UUID,
        customer_phone: str = "unknown",
        customer_name: Optional[str] = None,
        biz_name: str = "our business",
        ai_mode: str = "eco",
        is_guest: bool = False,
        bot_type: str = "commerce",
    ) -> tuple[str, list[str], Message]:

        # ── 1. Conversation setup ───────────────────────────────────────────
        conv = await self._get_or_create_conversation(db, tenant_id, customer_phone)
        if customer_name and not conv.customer_name:
            conv.customer_name = customer_name.strip().title()
        m = _NAME_RE.search(user_input)
        if m and not conv.customer_name:
            conv.customer_name = m.group(1).strip().title()

        history = await self._load_history(db, conv.id)

        # ── 2. Fetch active customer notice ─────────────────────────────────
        notice_result = await db.execute(
            select(KnowledgeBase).where(
                KnowledgeBase.tenant_id == tenant_id,
                KnowledgeBase.content.like("__CUSTOMER_NOTICE__%"),
            )
        )
        notice_row = notice_result.scalar_one_or_none()
        active_notice = (
            notice_row.content[len("__CUSTOMER_NOTICE__:"):].strip()
            if notice_row else None
        )
        # notice_block = (
        #     f"\n9. ACTIVE NOTICE.\n"
        #     f'The organization has posted this notice to all customers: "{active_notice}"\n'
        #     f"Mention this notice naturally in your FIRST reply to the customer.\n"
        #     f"If the notice affects their question (e.g. delivery paused, office closed), "
        #     f"address it directly and prioritize it over other information.\n"
        # ) if active_notice else ""

        # Only inject the notice instruction if it hasn't already been
        # mentioned in this conversation — checked by scanning recent
        # assistant messages for a fragment of the notice text itself.
        already_mentioned_notice = False
        if active_notice and history:
            notice_fragment = active_notice[:20].lower()
            for msg in history:
                if msg.role == "assistant" and notice_fragment in (msg.content or "").lower():
                    already_mentioned_notice = True
                    break

        notice_block = (
            f"\n9. ACTIVE NOTICE.\n"
            f'The organization has posted this notice: "{active_notice}"\n'
            f"You have NOT yet told this customer about it. Mention it naturally once, "
            f"in this reply.\n"
        ) if (active_notice and not already_mentioned_notice) else (
            f"\n9. NOTICE ALREADY GIVEN.\n"
            f"You already told this customer about the active notice earlier in this "
            f"conversation. Do NOT repeat it again unless they ask about something the "
            f"notice specifically affects.\n"
        ) if active_notice else ""

        # ── 3. Post-deal detection (commerce only, harmless no-op for info) ──
        post_deal = ""
        if history:
            recent_ai = [msg.content for msg in history if msg.role == "assistant"]
            if any("tutawasiliana" in (c or "").lower() for c in recent_ai[-3:]):
                post_deal = (
                    "\n[DEAL CLOSED] Order already taken. "
                    "Short polite replies only. No more pitching or lead saving.\n"
                )

        customer_ctx = (
            f"Customer name: {conv.customer_name}."
            if conv.customer_name
            else "Customer name: unknown — ask naturally only when they want to order."
        )

        # ── 4. Auth rule — what the agent knows about this customer ──────────
        if is_guest:
            auth_rule = (
                "\n10. CUSTOMER STATUS — GUEST (no account).\n"
                "This customer is chatting WITHOUT an account. Their real phone number is UNKNOWN.\n"
                "- Do NOT ask for a phone number or name until it's actually needed "
                "(buying intent for commerce, or a follow-up request for info bots).\n"
                "- When needed, ask politely for name and phone together.\n"
                "- Pass the phone number they give you as 'customer_phone' when saving "
                "a lead or inquiry.\n"
                "- NEVER assume you already have their phone number — you do not.\n"
                "- If they decline to share it, respect that and continue helping without it.\n"
            )
        else:
            auth_rule = (
                "\n10. CUSTOMER STATUS — REGISTERED (has account).\n"
                "This customer signed in with their real phone number — it is already in the system.\n"
                "- NEVER ask for their phone number again. Asking again is annoying and unnecessary.\n"
                "- Ask for their name only if unknown and only when naturally needed.\n"
            )

        # ── 5. Branch by bot_type — tools, executor, and prompt ──────────────
        if bot_type == "info":
            from app.info_tools import InfoToolExecutor
            executor = InfoToolExecutor(db=db, tenant_id=tenant_id, conv=conv)
            dynamic_tools = _get_info_tools()
            system_prompt = _build_info_prompt(
                biz_name, customer_ctx, notice_block, auth_rule
            )
        else:
            executor = ToolExecutor(
                db=db,
                tenant_id=tenant_id,
                conv=conv,
                embedder=self._get_embedder(),
                use_langchain=self._use_langchain,
            )
            history_text_preview = " ".join(
                [msg.content for msg in history if msg.content]
            )
            dynamic_tools = _get_commerce_tools_for_context(user_input, history_text_preview)
            system_prompt = _build_commerce_prompt(
                biz_name, customer_ctx, post_deal, notice_block, auth_rule
            )

        # ── 6. Build message history for the model ───────────────────────────
        contents: list[types.Content] = []
        for msg in history:
            content_str = msg.content or ""
            if msg.role == "assistant" and msg.image_url:
                content_str = f"{content_str}\n[IMAGE_URL: {msg.image_url}]"
            role_label = "model" if msg.role == "assistant" else "user"
            contents.append(
                types.Content(
                    role=role_label,
                    parts=[types.Part.from_text(text=content_str)]
                )
            )

        contents.append(
            types.Content(
                role="user",
                parts=[types.Part.from_text(text=user_input)]
            )
        )

        # ── 7. Agent loop — multi-round, AFC disabled ────────────────────────
        model_name = PRICING.get(ai_mode, PRICING["eco"])["model"]
        total_prompt = 0
        total_completion = 0
        tools_used: list[str] = []
        answer = ""

        try:
            response = await self.client.aio.models.generate_content(
                model=model_name,
                contents=contents,
                config=types.GenerateContentConfig(
                    tools=dynamic_tools,
                    temperature=0.3,
                    max_output_tokens=1024,
                    system_instruction=system_prompt,
                    automatic_function_calling=types.AutomaticFunctionCallingConfig(
                        disable=True
                    ),
                )
            )
            if response.usage_metadata:
                total_prompt += response.usage_metadata.prompt_token_count or 0
                total_completion += response.usage_metadata.candidates_token_count or 0

            rounds = 0
            while response.function_calls and rounds < MAX_TOOL_ROUNDS:
                rounds += 1
                contents.append(response.candidates[0].content)

                for fc in response.function_calls:
                    tool_name = fc.name
                    tools_used.append(tool_name)
                    args = fc.args if isinstance(fc.args, dict) else {}
                    tool_result = await executor.execute(tool_name, args)
                    contents.append(
                        types.Content(
                            role="tool",
                            parts=[
                                types.Part.from_function_response(
                                    name=tool_name,
                                    response={"result": tool_result}
                                )
                            ]
                        )
                    )

                response = await self.client.aio.models.generate_content(
                    model=model_name,
                    contents=contents,
                    config=types.GenerateContentConfig(
                        tools=dynamic_tools,
                        temperature=0.3,
                        max_output_tokens=512,
                        system_instruction=system_prompt,
                        automatic_function_calling=types.AutomaticFunctionCallingConfig(
                            disable=True
                        ),
                    )
                )
                if response.usage_metadata:
                    total_prompt += response.usage_metadata.prompt_token_count or 0
                    total_completion += response.usage_metadata.candidates_token_count or 0

            answer = _extract_text(response)
            if not answer:
                answer = (
                    "Samahani, sijapata jibu kamili kwa wakati huu. "
                    "Tafadhali jaribu tena au uliza kwa njia tofauti."
                )

            # Safety net: if a catalog tool was called but the reply looks
            # suspiciously short relative to the actual product count,
            # something went wrong in generation — log it for review.
            catalog_tools_called = {"get_product_catalog", "get_service_catalog"} & set(tools_used)
            if catalog_tools_called and len(answer) < 50:
                logger.warning(
                    f"[Catalog Truncation Suspected] tenant={tenant_id} "
                    f"tools={tools_used} reply_len={len(answer)}"
                )

        except Exception as err:
            print(f"[Agent Error] {type(err).__name__}: {err}")
            fallback_msg = "Samahani, kuna tatizo la kiufundi kwa muda mfupi. Tafadhali jaribu tena."
            fallback_entry = Message(
                conversation_id=conv.id,
                role="assistant",
                content=fallback_msg,
                image_url=None,
            )
            db.add(fallback_entry)
            await db.commit()
            await db.refresh(fallback_entry)
            return fallback_msg, [], fallback_entry

        # ── 8. Record subscription usage (no coins) ───────────────────────────
        if total_prompt > 0:
            await self._record_usage(
                db, tenant_id, total_prompt, total_completion, ai_mode
            )

        # ── 9. Normalize raw Cloudinary URLs (commerce mainly, harmless for info) ──
        if not _IMAGE_TAG_RE.search(answer):
            raw_m = _RAW_CLOUDINARY_RE.search(answer)
            if raw_m:
                raw_url = raw_m.group(0).rstrip(".,;:)!?'\"")
                answer = _RAW_CLOUDINARY_RE.sub("", answer).strip()
                answer = f"{answer}\n[IMAGE_URL: {raw_url}]"

        # ── 10. Persist messages ───────────────────────────────────────────────
        db.add(Message(conversation_id=conv.id, role="user", content=user_input))

        all_image_urls, ai_clean_content = _extract_all_images(answer)
        main_image_url = all_image_urls[0] if all_image_urls else None
        extra_image_urls = all_image_urls[1:] if len(all_image_urls) > 1 else None

        new_msg = Message(
            conversation_id=conv.id,
            role="assistant",
            content=ai_clean_content,
            image_url=main_image_url,
            extra_image_urls=extra_image_urls,
        )
        db.add(new_msg)
        await db.commit()
        await db.refresh(new_msg)

        return answer, tools_used, new_msg


ai_engine = AIEngine()