import asyncio
import json
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

HISTORY_WINDOW = 6
MAX_TOOL_ROUNDS = 5

# ── Pricing ───────────────────────────────────────────────────────────────────
PRICING = {
    "eco": {
        "model": "gemini-3.1-flash-lite",
        "input_per_1k":  0.00025,   # $0.25 per 1 Million tokens
        "output_per_1k": 0.00150,   # $1.50 per 1 Million tokens
    },
    "smart": {
        "model": "gemini-3.5-flash",
        "input_per_1k":  0.00150,   # $1.50 per 1 Million tokens
        "output_per_1k": 0.00900,   # $9.00 per 1 Million tokens
    },
}

COIN_VALUE_USD = 0.000220  

_IMAGE_TAG_RE = re.compile(r"\[IMAGE_URL:\s*(https?://[^\]]+)\]", re.IGNORECASE)
_FORCE_IMAGE_RE = re.compile(r"\bFORCE_IMAGE\b", re.IGNORECASE)
_RAW_CLOUDINARY_RE = re.compile(r"https?://res\.cloudinary\.com/\S+", re.IGNORECASE)
_NAME_RE = re.compile(
    r"(?:naitwa|jina\s+langu\s+ni|my\s+name\s+is|i(?:'|')?m\s+called)"
    r"\s+([A-Za-z][A-Za-z\s]{1,40})",
    re.IGNORECASE,
)


def _extract_image(text: str) -> tuple[Optional[str], str]:
    m = _IMAGE_TAG_RE.search(text)
    url = m.group(1).strip().rstrip(".,;:)!?'\"") if m else None
    clean = _IMAGE_TAG_RE.sub("", text) if m else text
    clean = _FORCE_IMAGE_RE.sub("", clean).strip()
    return url, clean


def _calculate_coins(
    prompt_tokens: int, completion_tokens: int, mode: str
) -> tuple[int, float]:
    pricing = PRICING.get(mode, PRICING["eco"])
    usd = (
        (prompt_tokens / 1000) * pricing["input_per_1k"]
        + (completion_tokens / 1000) * pricing["output_per_1k"]
    )
    return max(1, round(usd / COIN_VALUE_USD)), usd


def _normalize_schema(schema: dict) -> dict:
    """Convert lowercase JSON schema types to uppercase strings for Google SDK."""
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
    """Translate standard JSON tool definitions into native Google FunctionDeclarations."""
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
    """Safely pull text from a response, ignoring function_call parts.
    Prevents the 'non-text parts' SDK warning and avoids silently empty replies."""
    try:
        if not response.candidates:
            return ""
        parts = response.candidates[0].content.parts or []
        texts = [p.text for p in parts if getattr(p, "text", None)]
        return "".join(texts).strip()
    except Exception:
        return ""




# Tools always available — cover 90% of actual usage
_CORE_TOOL_NAMES = {
    "get_product_catalog", "get_service_catalog", "get_product_by_name",
    "get_service_by_name", "get_shop_info", "check_stock",
    "search_knowledge_base", "save_lead", "save_customer_note",
    "calculate_order_total", "get_customer_history", "log_unanswered_question",
}

# Tools only loaded when conversation hints they might be needed
_EXTENDED_TOOL_NAMES = {
    "calculate_delivery_cost", "create_notification", "escalate_to_human",
    "generate_insight", "fetch_business_website", "search_web", "context_restore",
}


def _get_tools_for_context(user_input: str, history_text: str) -> list[types.Tool]:
    """Load core tools, and append extended tools only when keywords match."""
    combined_text = (user_input + history_text).lower()
    
    needs_extended = any(kw in combined_text for kw in [
        "delivery", "deliver", "mkopo", "escalat", "website", "tovuti",
        "internet", "search", "hasira", "angry", "complaint",
    ])
    
    # 1. Filter tools strictly using your sets
    if needs_extended:
        # Include BOTH Core and Extended tools
        tool_set = [
            t for t in TOOLS 
            if t["function"]["name"] in _CORE_TOOL_NAMES 
            or t["function"]["name"] in _EXTENDED_TOOL_NAMES
        ]
    else:
        # Include ONLY Core tools to minimize token cost
        tool_set = [
            t for t in TOOLS if t["function"]["name"] in _CORE_TOOL_NAMES
        ]
        
    # 2. Build the native declarations list
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
            select(Conversation).where(
                Conversation.tenant_id == tenant_id,
                Conversation.customer_phone == customer_phone,
            )
        )
        conv = result.scalar_one_or_none()
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

        # Check active subscription first
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

    async def get_answer(
        self,
        db: AsyncSession,
        user_input: str,
        tenant_id: uuid.UUID,
        customer_phone: str = "unknown",
        customer_name: Optional[str] = None,
        biz_name: str = "our business",
        ai_mode: str = "eco",
    ) -> tuple[str, list[str], Message]:

        # ── 1. Conversation setup ───────────────────────────────────────────
        conv = await self._get_or_create_conversation(db, tenant_id, customer_phone)
        if customer_name and not conv.customer_name:
            conv.customer_name = customer_name.strip().title()
        m = _NAME_RE.search(user_input)
        if m and not conv.customer_name:
            conv.customer_name = m.group(1).strip().title()

        history = await self._load_history(db, conv.id)

        # ── Fetch active customer notice ─────────────────────────────
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

        # ── 2. Tool executor ────────────────────────────────────────────────
        executor = ToolExecutor(
            db=db,
            tenant_id=tenant_id,
            conv=conv,
            embedder=self._get_embedder(),
            use_langchain=self._use_langchain,
        )

        # ── 3. System prompt ────────────────────────────────────────────────
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

        notice_block = f"""
9. ACTIVE NOTICE.
The merchant has posted this notice to all customers:
"{active_notice}"
Mention this notice naturally in your FIRST reply to the customer.
If the notice affects their question (e.g. delivery paused, shop closed),
address it directly and prioritize it over other information.
""" if active_notice else ""

        system_prompt = f"""You are a sharp, warm customer service agent for {biz_name} in Tanzania.
{customer_ctx}{post_deal}{notice_block}

ABSOLUTE RULES:

1. NEVER GUESS BUSINESS DATA.
Always call a tool before answering questions about products, services, prices,
stock, location, hours, or delivery. If the tool returns found=false, tell the
customer that item or info is not available. Never invent any price, stock count,
or business detail.

2. LANGUAGE.
Default Swahili. Match customer's language exactly.
One honorific per reply maximum ('boss', 'mkuu').

3. PURCHASE FLOW.
- Confirm item and price from tool data.
- If customer name unknown: ask naturally before saving lead.
- Once name known and intent clear: call save_lead immediately.
- After lead saved: "Biashara itawasiliana nawe hivi karibuni." Close the topic.

4. IMAGES.
Only send [IMAGE_URL: url] when customer says 'picha', 'onyesha', 'show me', 'nitumie picha'.
Get URL from tool result image_url field. Never invent URLs.
Place [IMAGE_URL: url] alone on the last line of your reply.

5. FAREWELLS.
'bye', 'nakuaga', 'baadaye' → one short warm farewell, stop.

6. ESCALATION.
Angry or complex issue → escalate_to_human tool.

7. INSIGHTS.
Valuable observations → save_customer_note or generate_insight.

8. DISCLAIMER.
Add exactly once, at the end of your very first reply only:
_WakalaBot inaweza kukosea. Thibitisha taarifa muhimu._



"""

        # ── 4. Build native message content arrays ──────────────────────────
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

        # ── 5. Agent loop — multi-round, AFC disabled ───────────────────────
        model_name = PRICING.get(ai_mode, PRICING["eco"])["model"]
        total_prompt = 0
        total_completion = 0
        tools_used: list[str] = []
        answer = ""

        try:
            # 👇 GENERATE DYNAMIC TOOLS FOR THE FIRST CALL
            dynamic_tools = _get_tools_for_context(user_input, history_text)

            response = await self.client.aio.models.generate_content(
                model=model_name,
                contents=contents,
                config=types.GenerateContentConfig(
                    tools=dynamic_tools,
                    temperature=0.3,
                    max_output_tokens=1024,
                    system_instruction=system_prompt,
                    automatic_function_calling=types.AutomaticFunctionCallingConfig(disable=True),
                )
            )
            if response.usage_metadata:
                total_prompt += response.usage_metadata.prompt_token_count or 0
                total_completion += response.usage_metadata.candidates_token_count or 0

            rounds = 0
            while response.function_calls and rounds < MAX_TOOL_ROUNDS:
                rounds += 1
                # Retain the model's turn (incl. thought signatures) in history
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

                # Tools remain available every round — model may chain calls
                response = await self.client.aio.models.generate_content(
                    model=model_name,
                    contents=contents,
                    config=types.GenerateContentConfig(
                        tools=dynamic_tools,
                        temperature=0.3,
                        max_output_tokens=512,
                        system_instruction=system_prompt,
                        automatic_function_calling=types.AutomaticFunctionCallingConfig(disable=True),
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

        # ── 6. Deduct coins ──────────────────────────────────────────────────
        if total_prompt > 0:
            await self._deduct_coins(
                db, tenant_id, total_prompt, total_completion, ai_mode
            )

        # ── 7. Normalize raw Cloudinary URLs ───────────────────────────────────
        if not _IMAGE_TAG_RE.search(answer):
            raw_m = _RAW_CLOUDINARY_RE.search(answer)
            if raw_m:
                raw_url = raw_m.group(0).rstrip(".,;:)!?'\"")
                answer = _RAW_CLOUDINARY_RE.sub("", answer).strip()
                answer = f"{answer}\n[IMAGE_URL: {raw_url}]"

        # ── 8. Persist messages ─────────────────────────────────────────────
        db.add(Message(conversation_id=conv.id, role="user", content=user_input))
        ai_image_url, ai_clean_content = _extract_image(answer)

        new_msg = Message(
            conversation_id=conv.id,
            role="assistant",
            content=ai_clean_content,
            image_url=ai_image_url,
        )
        db.add(new_msg)
        await db.commit()
        await db.refresh(new_msg)

        return answer, tools_used, new_msg


ai_engine = AIEngine()