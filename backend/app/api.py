import logging
import re
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_tenant
from app.customer_auth import decode_customer_token
from app.db import get_db
from app.models import (  # type: ignore
    Conversation,
    Customer,
    KnowledgeBase,
    LeadEvent,
    Message,
    MessageFeedback,
    Subscription,
    Tenant,
    UnansweredQuestion,
    Wallet,
)
from app.schemas import MessageFeedbackCreate  # type: ignore
from app.services import ai_engine
from groq import APITimeoutError

logger = logging.getLogger(__name__)
router = APIRouter()

_IMAGE_TAG_RE = re.compile(r"\[IMAGE_URL:\s*(https?://[^\]]+)\]", re.IGNORECASE)
_FORCE_IMAGE_RE = re.compile(r"\bFORCE_IMAGE\b", re.IGNORECASE)
_QUICK_REPLY_RE = re.compile(r"\[QUICK_REPLY:\s*([^\]]+)\]", re.IGNORECASE)
_QUICK_INPUT_RE = re.compile(r"\[QUICK_INPUT[:\s]*([^\]]*)\]", re.IGNORECASE)


# ── Schemas ───────────────────────────────────────────────────────────────────

class QuickReply(BaseModel):
    type: str
    options: list[str] = []
    input_key: str = ""


class ChatRequest(BaseModel):
    message: str
    customer_token: Optional[str] = None
    customer_phone: str
    customer_name: Optional[str] = None
    tenant_slug: str
    is_guest: bool = False


class ChatResponse(BaseModel):
    id: str
    reply: str
    image_urls: list[str] = []
    quick_reply: QuickReply | None = None
    tools_used: list[str] = []

    @property
    def image_url(self) -> str | None:
        """Returns the first image URL for legacy frontend compatibility."""
        return self.image_urls[0] if self.image_urls else None


class TenantPublicInfo(BaseModel):
    biz_name: str
    slug: str
    is_verified: bool = False
    logo_url: Optional[str] = None


# ── Helpers ───────────────────────────────────────────────────────────────────

def _extract_images(text: str) -> tuple[list[str], str]:
    """
    Extracts all image URLs (markdown style or custom tags) 
    from the reply text and returns the list of URLs and cleaned text.
    """
    if not text:
        return [], ""

    # Matches both standard markdown ![alt](url) and [IMAGE: url] tags
    pattern = r"!\[.*?\]\((https?://[^\s\)]+)\)|\[IMAGE:\s*(https?://[^\s\]]+)\]"
    matches = re.findall(pattern, text)

    # Flatten tuples from regex groups
    image_urls = [m[0] or m[1] for m in matches if m[0] or m[1]]
    clean_text = re.sub(pattern, "", text).strip()

    return image_urls, clean_text


def _parse_quick_reply(text: str) -> tuple[str, QuickReply | None]:
    m = _QUICK_REPLY_RE.search(text)
    if m:
        options = [o.strip() for o in m.group(1).split("|")]
        clean = _QUICK_REPLY_RE.sub("", text).strip()
        return clean, QuickReply(type="buttons", options=options)

    m = _QUICK_INPUT_RE.search(text)
    if m:
        input_key = m.group(1).strip()
        clean = _QUICK_INPUT_RE.sub("", text).strip()
        return clean, QuickReply(type="input", input_key=input_key)

    return text, None


async def _get_tenant_by_slug(slug: str, db: AsyncSession) -> Tenant:
    result = await db.execute(
        select(Tenant).where(Tenant.slug == slug)
    )
    tenant = result.scalar_one_or_none()
    if not tenant:
        raise HTTPException(status_code=404, detail="Business not found")
    return tenant


async def _resolve_ai_mode(tenant: Tenant, db: AsyncSession) -> str:
    from app.schemas import SUBSCRIPTION_PLANS

    now = datetime.now(timezone.utc)
    sub_result = await db.execute(
        select(Subscription)
        .where(
            Subscription.tenant_id == tenant.id,
            Subscription.status == "active",
            Subscription.expires_at > now,
        )
        .order_by(Subscription.expires_at.desc())
    )
    sub = sub_result.scalars().first()
    if sub:
        plan = next((p for p in SUBSCRIPTION_PLANS if p["id"] == sub.plan_id), None)
        if plan:
            return plan.get("ai_mode", "eco")
    return tenant.ai_mode


async def _check_wallet(tenant_id: uuid.UUID, db: AsyncSession) -> None:
    now = datetime.now(timezone.utc)
    sub_result = await db.execute(
        select(Subscription)
        .where(
            Subscription.tenant_id == tenant_id,
            Subscription.status == "active",
            Subscription.expires_at > now,
        )
        .order_by(Subscription.expires_at.desc())
    )
    sub = sub_result.scalars().first()
    if sub and sub.messages_used < sub.messages_included:
        return

    result = await db.execute(
        select(Wallet).where(Wallet.tenant_id == tenant_id)
    )
    wallet = result.scalar_one_or_none()
    if wallet is None or wallet.balance <= 0:
        raise HTTPException(
            status_code=402,
            detail="Samahani, huduma hii haipo kwa sasa. Tafadhali wasiliana na biashara moja kwa moja."
        )


# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("/chat/business/{slug}", response_model=TenantPublicInfo)
async def get_business_info(
    slug: str,
    db: AsyncSession = Depends(get_db),
) -> TenantPublicInfo:
    tenant = await _get_tenant_by_slug(slug, db)
    return TenantPublicInfo(
        biz_name=tenant.biz_name,
        slug=tenant.slug,
        is_verified=tenant.is_verified,
        logo_url=tenant.logo_url,
    )


@router.get("/chat/directory", response_model=list[TenantPublicInfo])
async def get_business_directory(
    db: AsyncSession = Depends(get_db),
) -> list[TenantPublicInfo]:
    result = await db.execute(
        select(Tenant).where(Tenant.slug.isnot(None)).order_by(Tenant.biz_name)
    )
    tenants = result.scalars().all()
    return [
        TenantPublicInfo(
            biz_name=t.biz_name,
            slug=t.slug,
            is_verified=t.is_verified,
            logo_url=t.logo_url,
        )
        for t in tenants
    ]

@router.post("/chat/message", response_model=ChatResponse)
async def chat_message(
    body: ChatRequest,
    db: AsyncSession = Depends(get_db),
) -> ChatResponse:
    tenant = await _get_tenant_by_slug(body.tenant_slug, db)
    await _check_wallet(tenant.id, db)

    if body.is_guest:
        resolved_phone = body.customer_phone
        resolved_name = body.customer_name or None
    elif not body.customer_token:
        raise HTTPException(
            status_code=401,
            detail="Tafadhali ingia kwanza ili kuanza mazungumzo."
        )
    else:
        try:
            payload = decode_customer_token(body.customer_token)
            resolved_phone = payload["phone"]
            resolved_name = payload["name"]
        except Exception:
            raise HTTPException(status_code=401, detail="Invalid customer token")

    try:
        effective_ai_mode = await _resolve_ai_mode(tenant, db)
        reply, tools_used, new_msg = await ai_engine.get_answer(
            db=db,
            user_input=body.message,
            tenant_id=tenant.id,
            customer_phone=resolved_phone,
            customer_name=resolved_name,
            biz_name=tenant.biz_name,
            ai_mode=effective_ai_mode,
            is_guest=body.is_guest,
        )

    except APITimeoutError:
        raise HTTPException(
            status_code=503,
            detail="Samahani, jibu halikuja kwa wakati. Tafadhali jaribu tena."
        )
    except Exception:
        logger.exception("AI engine error for tenant=%s", tenant.id)
        raise HTTPException(
            status_code=500,
            detail="Samahani, kuna tatizo la muda mfupi. Tafadhali jaribu tena."
        )

    # Extract ALL image URLs from the reply text instead of just one
    image_urls, clean_reply = _extract_images(reply)
    clean_reply, quick_reply = _parse_quick_reply(clean_reply)

    # Fallback to message object if no image URLs were found in the text string
    if not image_urls:
        if getattr(new_msg, "image_urls", None):
            image_urls = new_msg.image_urls
        elif getattr(new_msg, "image_url", None) and new_msg.image_url:
            image_urls = [new_msg.image_url]

    return ChatResponse(
        id=str(new_msg.id),
        reply=clean_reply,
        image_urls=image_urls,
        quick_reply=quick_reply,
        tools_used=tools_used,
    )

@router.post("/chat/message/noauth", response_model=ChatResponse)
async def chat_message_noauth(
    body: ChatRequest,
    db: AsyncSession = Depends(get_db),
) -> ChatResponse:
    tenant = await _get_tenant_by_slug(body.tenant_slug, db)
    await _check_wallet(tenant.id, db)

    resolved_phone = getattr(body, "customer_phone", "guest-anonymous")
    resolved_name = getattr(body, "customer_name", "Mteja")

    try:
        effective_ai_mode = await _resolve_ai_mode(tenant, db)
        reply, tools_used, new_msg = await ai_engine.get_answer(
            db=db,
            user_input=body.message,
            tenant_id=tenant.id,
            customer_phone=resolved_phone,
            customer_name=resolved_name,
            biz_name=tenant.biz_name,
            ai_mode=effective_ai_mode,
            is_guest=True,
        )

    except APITimeoutError:
        raise HTTPException(
            status_code=503,
            detail="Samahani, jibu halikuja kwa wakati. Tafadhali jaribu tena."
        )
    except Exception:
        logger.exception("AI engine error for tenant=%s", tenant.id)
        raise HTTPException(
            status_code=500,
            detail="Samahani, kuna tatizo la muda mfupi. Tafadhali jaribu tena."
        )

    image_urls, clean_reply = _extract_images(reply)
    clean_reply, quick_reply = _parse_quick_reply(clean_reply)

    if not image_urls:
        if getattr(new_msg, "image_urls", None):
            image_urls = new_msg.image_urls
        elif getattr(new_msg, "image_url", None) and new_msg.image_url:
            image_urls = [new_msg.image_url]

    return ChatResponse(
        id=str(new_msg.id),
        reply=clean_reply,
        image_urls=image_urls,
        quick_reply=quick_reply,
        tools_used=tools_used,
    )

@router.get("/admin/leads")
async def get_all_global_leads(
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
):
    stmt = (
        select(LeadEvent, Conversation)
        .join(Conversation, LeadEvent.conversation_id == Conversation.id)
        .where(LeadEvent.tenant_id == tenant.id)
        .order_by(LeadEvent.created_at.desc())
    )

    result = await db.execute(stmt)
    rows = result.all()

    return [
        {
            "id": str(lead.id),
            "conversation_id": str(lead.conversation_id),
            "customer_phone": getattr(conv, "customer_phone", "Unknown"),
            "customer_name": getattr(lead, "customer_name", None) or getattr(conv, "customer_name", None),
            "event_type": getattr(lead, "event_type", "intent"),
            "status": getattr(lead, "status", "pending"),
            "product_name": getattr(lead, "product_name", None),
            "created_at": getattr(lead, "created_at", None).isoformat() if getattr(lead, "created_at", None) else None,
        }
        for lead, conv in rows
    ]


@router.post("/chat/feedback")
async def submit_feedback(
    body: MessageFeedbackCreate,
    db: AsyncSession = Depends(get_db),
) -> dict:
    try:
        msg_id = uuid.UUID(body.message_id)
        msg_result = await db.execute(
            select(Message).where(Message.id == msg_id)
        )
        msg = msg_result.scalar_one_or_none()
        if not msg:
            return {"status": "ok"}
        db.add(
            MessageFeedback(
                conversation_id=msg.conversation_id,
                message_id=msg_id,
                rating=body.rating,
                comment=body.comment,
            )
        )
        await db.commit()
    except Exception as e:
        logger.error(f"Feedback error: {e}")
    return {"status": "ok"}


@router.get("/chat/history/{slug}")
async def get_chat_history(
    slug: str,
    authorization: str = Header(...),
    db: AsyncSession = Depends(get_db),
) -> dict:
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid authorization header")
    token = authorization.removeprefix("Bearer ").strip()
    try:
        payload = decode_customer_token(token)
        verified_phone = payload["phone"]
        customer_id = payload["sub"]
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired session")

    customer_result = await db.execute(
        select(Customer).where(Customer.id == uuid.UUID(customer_id))
    )
    customer = customer_result.scalar_one_or_none()
    customer_since = customer.created_at if customer else None

    tenant = await _get_tenant_by_slug(slug, db)

    # Order by newest record first to safely avoid MultipleResultsFound error
    conv_result = await db.execute(
        select(Conversation)
        .where(
            Conversation.tenant_id == tenant.id,
            Conversation.customer_phone == verified_phone,
        )
        .order_by(Conversation.id.desc())
    )
    conv = conv_result.scalars().first()
    if not conv:
        return {"messages": []}

    msgs_query = (
        select(Message)
        .where(Message.conversation_id == conv.id)
        .order_by(Message.timestamp.desc())
        .limit(20)
    )
    if customer_since:
        msgs_query = msgs_query.where(Message.timestamp >= customer_since)

    msgs_result = await db.execute(msgs_query)
    msgs = list(reversed(msgs_result.scalars().all()))
    return {
        "messages": [
            {
                "id": str(m.id),
                "role": getattr(m, "role", getattr(m, "sender", "assistant")),
                "content": m.content,
                "image_url": m.image_url,
            }
            for m in msgs
        ]
    }


@router.patch("/leads/{lead_id}/status")
async def update_lead_status(
    lead_id: uuid.UUID,
    status: str,
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
) -> dict:
    if status not in ("hot", "cold", "pending", "resolved"):
        raise HTTPException(status_code=400, detail="Invalid status")
    result = await db.execute(
        select(LeadEvent).where(
            LeadEvent.id == lead_id,
            LeadEvent.tenant_id == tenant.id,
        )
    )
    lead = result.scalar_one_or_none()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    lead.status = status
    await db.commit()
    return {"status": status}


@router.get("/unanswered-questions")
async def list_unanswered_questions(
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
) -> list:
    result = await db.execute(
        select(UnansweredQuestion)
        .where(UnansweredQuestion.tenant_id == tenant.id)
        .order_by(UnansweredQuestion.created_at.desc())
        .limit(100)
    )
    items = result.scalars().all()
    return [
        {
            "id": str(q.id),
            "question": q.question,
            "category": q.category,
            "customer_phone": q.customer_phone,
            "is_resolved": q.is_resolved,
            "created_at": q.created_at.isoformat(),
        }
        for q in items
    ]


@router.patch("/unanswered-questions/{question_id}/resolve")
async def resolve_question(
    question_id: uuid.UUID,
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
) -> dict:
    result = await db.execute(
        select(UnansweredQuestion).where(
            UnansweredQuestion.id == question_id,
            UnansweredQuestion.tenant_id == tenant.id,
        )
    )
    q = result.scalar_one_or_none()
    if not q:
        raise HTTPException(status_code=404, detail="Not found")
    q.is_resolved = True
    await db.commit()
    return {"status": "resolved"}


@router.get("/chat/notice/{slug}")
async def get_chat_notice(
    slug: str,
    db: AsyncSession = Depends(get_db),
) -> dict:
    tenant = await _get_tenant_by_slug(slug, db)

    # Pick the latest notice safely without crashing if multiple exist
    result = await db.execute(
        select(KnowledgeBase)
        .where(
            KnowledgeBase.tenant_id == tenant.id,
            KnowledgeBase.content.like("__CUSTOMER_NOTICE__%"),
        )
        .order_by(KnowledgeBase.id.desc())
    )
    row = result.scalars().first()

    if not row:
        return {"notice": None}

    text = row.content
    if text.startswith("__CUSTOMER_NOTICE__:"):
        text = text.removeprefix("__CUSTOMER_NOTICE__:")
    elif text.startswith("__CUSTOMER_NOTICE__"):
        text = text.removeprefix("__CUSTOMER_NOTICE__")

    return {"notice": text.strip()}