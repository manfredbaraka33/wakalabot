import logging
import re
import uuid

from fastapi import APIRouter, Depends, HTTPException, Header
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select  # type: ignore
from typing import Optional

from datetime import datetime, timezone

from app.db import get_db
from app.models import (
    Tenant, Wallet, LeadEvent, Conversation, MessageFeedback, Message,
    Subscription, UnansweredQuestion,Customer
)  # type: ignore
from app.schemas import MessageFeedbackCreate  # type: ignore
from app.services import ai_engine
from app.auth import get_current_tenant
from app.customer_auth import decode_customer_token
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


class ChatResponse(BaseModel):
    id: str
    reply: str
    image_url: str | None = None
    quick_reply: QuickReply | None = None
    tools_used: list[str] = []


class TenantPublicInfo(BaseModel):
    biz_name: str
    slug: str
    is_verified: bool = False


# ── Helpers ───────────────────────────────────────────────────────────────────

def _extract_image(text: str) -> tuple[str | None, str]:
    m = _IMAGE_TAG_RE.search(text)
    url = m.group(1).strip().rstrip(".,;:)!?'\"") if m else None
    clean = _IMAGE_TAG_RE.sub("", text) if m else text
    clean = _FORCE_IMAGE_RE.sub("", clean).strip()
    return url, clean


def _parse_quick_reply(text: str) -> tuple[str, QuickReply | None]:
    m = _QUICK_REPLY_RE.search(text)
    if m:
        options = [o.strip() for o in m.group(1).split('|')]
        clean = _QUICK_REPLY_RE.sub('', text).strip()
        return clean, QuickReply(type='buttons', options=options)

    m = _QUICK_INPUT_RE.search(text)
    if m:
        input_key = m.group(1).strip()
        clean = _QUICK_INPUT_RE.sub('', text).strip()
        return clean, QuickReply(type='input', input_key=input_key)

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
    """If an active subscription exists, the plan locks the model tier — this
    prevents a subscriber from manually switching to 'smart' and getting
    expensive-model usage for free under their subscription's flat message count.
    No active subscription → fall back to the tenant's manual eco/smart choice."""
    from app.schemas import SUBSCRIPTION_PLANS

    now = datetime.now(timezone.utc)
    sub_result = await db.execute(
        select(Subscription).where(
            Subscription.tenant_id == tenant.id,
            Subscription.status == "active",
            Subscription.expires_at > now,
        )
    )
    sub = sub_result.scalar_one_or_none()
    if sub:
        plan = next((p for p in SUBSCRIPTION_PLANS if p["id"] == sub.plan_id), None)
        if plan:
            return plan.get("ai_mode", "eco")
    return tenant.ai_mode


async def _check_wallet(tenant_id: uuid.UUID, db: AsyncSession) -> None:
    # Check active subscription first — has allowance remaining?
    now = datetime.now(timezone.utc)
    sub_result = await db.execute(
        select(Subscription).where(
            Subscription.tenant_id == tenant_id,
            Subscription.status == "active",
            Subscription.expires_at > now,
        )
    )
    sub = sub_result.scalar_one_or_none()
    if sub and sub.messages_used < sub.messages_included:
        return  # Subscription covers this message

    # No subscription or allowance exhausted — fall back to coins
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

    # ── Resolve customer identity — token is mandatory, no unverified fallback ──
    if not body.customer_token:
        raise HTTPException(
            status_code=401,
            detail="Tafadhali ingia kwanza ili kuanza mazungumzo."
        )
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

    image_url, clean_reply = _extract_image(reply)
    clean_reply, quick_reply = _parse_quick_reply(clean_reply)

    return ChatResponse(
        id=str(new_msg.id),
        reply=clean_reply,
        image_url=new_msg.image_url,
        quick_reply=quick_reply,
        tools_used=tools_used,
    )


@router.get("/admin/leads")
async def get_all_global_leads(
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db)
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
            "created_at": getattr(lead, "created_at", None).isoformat() if getattr(lead, "created_at", None) else None
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
        # Get the actual message to find correct conversation_id
        msg_result = await db.execute(
            select(Message).where(Message.id == msg_id)
        )
        msg = msg_result.scalar_one_or_none()
        if not msg:
            return {"status": "ok"}  # Silent fail — don't expose errors
        db.add(MessageFeedback(
            conversation_id=msg.conversation_id,
            message_id=msg_id,
            rating=body.rating,
            comment=body.comment,
        ))
        await db.commit()
    except Exception as e:
        print(f"Feedback error: {e}")
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

    # Get this customer's registration date — used to hide pre-existing
    # conversations that belonged to a previous owner of the same phone number.
    customer_result = await db.execute(
        select(Customer).where(Customer.id == uuid.UUID(customer_id))
    )
    customer = customer_result.scalar_one_or_none()
    customer_since = customer.created_at if customer else None

    tenant = await _get_tenant_by_slug(slug, db)
    conv_result = await db.execute(
        select(Conversation).where(
            Conversation.tenant_id == tenant.id,
            Conversation.customer_phone == verified_phone,
        )
    )
    conv = conv_result.scalar_one_or_none()
    if not conv:
        return {"messages": []}

    msgs_query = (
        select(Message)
        .where(Message.conversation_id == conv.id)
        .order_by(Message.timestamp.asc())
        .limit(20)
    )
    # Only show messages sent after the current account was created —
    # prevents a claim-resolver from reading the previous owner's messages.
    if customer_since:
        msgs_query = msgs_query.where(Message.timestamp >= customer_since)

    msgs_result = await db.execute(msgs_query)
    msgs = msgs_result.scalars().all()
    return {
        "messages": [
            {
                "id": str(m.id),
                "role": m.role,
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