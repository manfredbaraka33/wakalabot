import asyncio
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

COIN_VALUE_USD = 0.000300

_IMAGE_TAG_RE = re.compile(r"\[IMAGE_URL:\s*(https?://[^\]]+)\]", re.IGNORECASE)
_FORCE_IMAGE_RE = re.compile(r"\bFORCE_IMAGE\b", re.IGNORECASE)
_RAW_CLOUDINARY_RE = re.compile(r"https?://res\.cloudinary\.com/\S+", re.IGNORECASE)

_NAME_RE = re.compile(
    r"(?:naitwa|jina\s+langu\s+ni|my\s+name\s+is|i(?:'|')?m\s+called)"
    r"\s+([A-Za-z][A-Za-z\s]{1,40})",
    re.IGNORECASE,
)


# def _extract_image(text: str) -> tuple[Optional[str], str]:
#     m = _IMAGE_TAG_RE.search(text)
#     url = m.group(1).strip().rstrip(".,;:)!?'\"") if m else None
#     clean = _IMAGE_TAG_RE.sub("", text) if m else text
#     clean = _FORCE_IMAGE_RE.sub("", clean).strip()
#     return url, clean

# _IMAGE_TAG_RE = re.compile(r"\[IMAGE_URL:\s*(https?://[^\]]+)\]", re.IGNORECASE)


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


def _calculate_coins(
    prompt_tokens: int, completion_tokens: int, mode: str
) -> tuple[int, float]:
    pricing = PRICING.get(mode, PRICING["eco"])
    usd = (
        (prompt_tokens / 1000) * pricing["input_per_1k"]
        + (completion_tokens / 1000) * pricing["output_per_1k"]
    )
    return max(1, math.ceil(usd / COIN_VALUE_USD)), usd


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


def _get_native_tools() -> list[types.Tool]:
    declarations = []
    for t in TOOLS:
        f = t["function"]
        norm_params = _normalize_schema(f.get("parameters", {}))
        declarations.append(
            types.FunctionDeclaration(
                name=f["name"],
                description=f["description"],
                parameters=norm_params,
            )
        )
    return [types.Tool(function_declarations=declarations)]


def _extract_text(response) -> str:
    try:
        if not response.candidates:
            return ""
        parts = response.candidates[0].content.parts or []
        texts = [p.text for p in parts if getattr(p, "text", None)]
        return "".join(texts).strip()
    except Exception:
        return ""


# ── Tool sets ─────────────────────────────────────────────────────────────────

_CORE_TOOL_NAMES = {
    "get_product_catalog", "get_service_catalog", "get_product_by_name",
    "get_service_by_name", "get_shop_info", "check_stock",
    "search_knowledge_base", "save_lead", "save_customer_note",
    "calculate_order_total", "get_customer_history", "log_unanswered_question",
}

_EXTENDED_TOOL_NAMES = {
    "calculate_delivery_cost", "create_notification", "escalate_to_human",
    "generate_insight", "fetch_business_website", "search_web", "context_restore",
}


def _get_tools_for_context(user_input: str, history_text: str) -> list[types.Tool]:
    combined_text = (user_input + history_text).lower()
    needs_extended = any(kw in combined_text for kw in [
        "delivery", "deliver", "mkopo", "escalat", "website", "tovuti",
        "internet", "search", "hasira", "angry", "complaint",
    ])
    tool_set = [
        t for t in TOOLS
        if t["function"]["name"] in _CORE_TOOL_NAMES
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


class AIEngine:

    def __init__(self, hf_model: str = "all-MiniLM-L6-v2") -> None:
        if HuggingFaceEmbeddings is not None:
            self.embeddings = HuggingFaceEmbeddings(model_name=hf_model)
            self._use_langchain = True
        else:
            self._hf_model = SentenceTransformer(hf_model)
            self._use_langchain = False

        self.client = genai.Client(api_key=settings.GEMINI_API_KEY)
        self._native_tools = _get_native_tools()

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
            .order_by(Message.timestamp.desc())
            .limit(HISTORY_WINDOW)
        )
        return list(reversed(result.scalars().all()))
    async def _deduct_coins(
        self,
        db: AsyncSession,
        tenant_id: uuid.UUID,
        prompt_tokens: int,
        completion_tokens: int,
        mode: str,
    ) -> None:
        from datetime import datetime, timezone
        from app.models import Subscription

        coins, usd = _calculate_coins(prompt_tokens, completion_tokens, mode)

        now = datetime.now(timezone.utc)
        sub_result = await db.execute(
            select(Subscription).where(
                Subscription.tenant_id == tenant_id,
                Subscription.status == "active",
                Subscription.expires_at > now,
            )
        )
        sub = sub_result.scalar_one_or_none()

        if sub:
            sub.messages_used += 1
            usage_pct = (sub.messages_used / sub.messages_included) * 100

            if sub.messages_used >= sub.messages_included:
                db.add(Notification(
                    tenant_id=tenant_id,
                    type="insight",
                    message=(
                        f"⚠️ Umefika kikomo cha mazungumzo kwa mwezi huu "
                        f"({sub.messages_included} mazungumzo). "
                        f"Nunua coins za ziada kuendelea."
                    ),
                    is_read=False,
                ))
                from app.sms import send_sms
                from app.models import Tenant as TenantModel
                t = (await db.execute(
                    select(TenantModel).where(TenantModel.id == tenant_id)
                )).scalar_one_or_none()
                if t and t.phone:
                    await send_sms(
                        t.phone,
                        f"⚠️ Mazungumzo ya mpango wako yamefika kikomo "
                        f"({sub.messages_included}). Nunua coins za ziada."
                    )
            elif usage_pct >= 75 and (sub.messages_used - 1) / sub.messages_included * 100 < 75:
                from app.sms import send_sms
                from app.models import Tenant as TenantModel
                t = (await db.execute(
                    select(TenantModel).where(TenantModel.id == tenant_id)
                )).scalar_one_or_none()
                if t and t.phone:
                    await send_sms(
                        t.phone,
                        f"📊 Umetumia {sub.messages_used}/{sub.messages_included} "
                        f"mazungumzo (75%) ya mpango wako wa mwezi huu."
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
            return

        # No active subscription — fall back to coin deduction
        result = await db.execute(select(Wallet).where(Wallet.tenant_id == tenant_id))
        wallet = result.scalar_one_or_none()
        if wallet is None:
            return

        was_above_threshold = wallet.balance > 50
        wallet.balance = max(0, wallet.balance - coins)

        db.add(Transaction(
            tenant_id=tenant_id,
            wallet_id=wallet.id,
            coin_amount=-coins,
            tx_type="deduction",
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            usd_cost=usd,
            note=f"AI agent ({mode} mode)",
        ))

        if wallet.balance <= 0:
            from app.sms import send_sms
            from app.models import Tenant as TenantModel
            t = (await db.execute(
                select(TenantModel).where(TenantModel.id == tenant_id)
            )).scalar_one_or_none()
            if t and t.phone:
                await send_sms(
                    t.phone,
                    "⚠️ Coins zako zimeisha. Nunua coins za ziada ili AI iendelee kufanya kazi."
                )
        elif wallet.balance <= 50 and was_above_threshold:
            from app.sms import send_sms
            from app.models import Tenant as TenantModel
            t = (await db.execute(
                select(TenantModel).where(TenantModel.id == tenant_id)
            )).scalar_one_or_none()
            if t and t.phone:
                await send_sms(
                    t.phone,
                    f"📊 Salio lako limefika coins {wallet.balance}. Fikiria kuongeza coins."
                )

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

        # ── 3. Tool executor ────────────────────────────────────────────────
        executor = ToolExecutor(
            db=db,
            tenant_id=tenant_id,
            conv=conv,
            embedder=self._get_embedder(),
            use_langchain=self._use_langchain,
        )

        # ── 4. System prompt building blocks ────────────────────────────────
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

        # Notice block — empty string when no notice active (zero token cost)
        notice_block = (
            f"\n9. ACTIVE NOTICE.\n"
            f'The merchant has posted this notice to all customers: "{active_notice}"\n'
            f"Mention this notice naturally in your FIRST reply to the customer.\n"
            f"If the notice affects their question (e.g. delivery paused, shop closed), "
            f"address it directly and prioritize it over other information.\n"
        ) if active_notice else ""

        # Auth rule — tells the agent what it does and doesn't know about this customer
        if is_guest:
            auth_rule = (
                "\n10. CUSTOMER STATUS — GUEST (no account).\n"
                "This customer is chatting WITHOUT an account. Their real phone number is UNKNOWN.\n"
                "- Do NOT ask for a phone number or name until you see clear buying intent.\n"
                "- When buying intent appears, ask politely:\n"
                f'  "Vizuri! Ili {biz_name} iweze kuwasiliana nawe, tafadhali nipe jina lako na namba yako ya simu."\n'
                "- Pass the phone number they give you as 'customer_real_phone' when calling save_lead.\n"
                "- NEVER assume you already have their phone number — you do not.\n"
                "- If they decline to share their number, respect that and continue helping without it.\n"
            )
        else:
            auth_rule = (
                "\n10. CUSTOMER STATUS — REGISTERED (has account).\n"
                "This customer signed in with their real phone number — it is already in the system.\n"
                "- NEVER ask for their phone number again. Asking again is annoying and unnecessary.\n"
                "- Ask for their name only if unknown and only when naturally needed (e.g. at order time).\n"
            )

        # ── 5. Assemble system prompt ────────────────────────────────────────
        system_prompt = (
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
            f"\n4. IMAGES.\n"
            f"Only send images when customer says 'picha', 'onyesha', 'show me', 'nitumie picha'.\n"
            f"When requested, send ALL available images for the product by including every URL found in the all_images list.\n"
            f"Place each [IMAGE_URL: url] tag on its own line at the very end of your response.\n"
            f"Never invent image URLs. Only use valid URLs provided in the product data.\n"
            f"\n5. FAREWELLS.\n"
            f"'bye', 'nakuaga', 'baadaye' → one short warm farewell, stop.\n"
            f"\n6. ESCALATION.\n"
            f"Angry or complex issue → escalate_to_human tool.\n"
            f"\n7. INSIGHTS.\n"
            f"Valuable observations → save_customer_note or generate_insight.\n"
            # f"\n8. DISCLAIMER.\n"
            # f"Add exactly once, at the end of your very first reply only:\n"
            # f"_Wakalabot inaweza kukosea. Thibitisha taarifa muhimu._\n"
        )

        # ── 6. Build message history for the model ──────────────────────────
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

        history_text = " ".join([msg.content for msg in history if msg.content])

        # ── 7. Agent loop — multi-round, AFC disabled ───────────────────────
        model_name = PRICING.get(ai_mode, PRICING["eco"])["model"]
        total_prompt = 0
        total_completion = 0
        tools_used: list[str] = []
        answer = ""

        try:
            dynamic_tools = _get_tools_for_context(user_input, history_text)

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

        # ── 8. Deduct coins ──────────────────────────────────────────────────
        if total_prompt > 0:
            await self._deduct_coins(
                db, tenant_id, total_prompt, total_completion, ai_mode
            )

        # ── 9. Normalize raw Cloudinary URLs ────────────────────────────────
        if not _IMAGE_TAG_RE.search(answer):
            raw_m = _RAW_CLOUDINARY_RE.search(answer)
            if raw_m:
                raw_url = raw_m.group(0).rstrip(".,;:)!?'\"")
                answer = _RAW_CLOUDINARY_RE.sub("", answer).strip()
                answer = f"{answer}\n[IMAGE_URL: {raw_url}]"

        # ── 10. Persist messages ─────────────────────────────────────────────

        # return answer, tools_used, new_msg
        db.add(Message(conversation_id=conv.id, role="user", content=user_input))

        # Extract ALL image URLs from the AI response
        all_image_urls, ai_clean_content = _extract_all_images(answer)

        # First image goes into the legacy image_url field for backward compat
        # Remaining images go into extra_image_urls
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