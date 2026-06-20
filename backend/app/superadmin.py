"""
SuperAdmin API — developer "Nerve Center" endpoints.

POST /api/v1/superadmin/auth                   — Obtain a superadmin JWT
GET  /api/v1/superadmin/stats                  — Platform-wide KPIs
GET  /api/v1/superadmin/revenue-trend          — Daily TZS revenue (last 30 days)
GET  /api/v1/superadmin/user-growth            — Daily new tenant sign-ups (last 30 days)
GET  /api/v1/superadmin/ai-activity            — Daily coins consumed (last 30 days)

GET  /api/v1/superadmin/tenants                — List all tenants (search, pagination)
PUT  /api/v1/superadmin/tenants/{id}           — Update tenant fields
DELETE /api/v1/superadmin/tenants/{id}         — Delete tenant
POST /api/v1/superadmin/tenants/{id}/reset-password — Quick fix: set new password
POST /api/v1/superadmin/tenants/{id}/add-coins — Quick fix: add coins to wallet

GET  /api/v1/superadmin/transactions           — List transactions (filter by status)
GET  /api/v1/superadmin/wallets                — List all wallets

GET  /api/v1/superadmin/tickets                — List support tickets (filter)
PUT  /api/v1/superadmin/tickets/{id}           — Update ticket status / reply
"""
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from jose import JWTError, jwt
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel, Field
from app.models import Notification, SupportTicket, Tenant, Transaction, Wallet, PaymentRequest
from app.schemas import AdminPaymentAction, COIN_PACKAGES

from app.auth import hash_password
from app.core import settings
from app.db import get_db
from app.models import SupportTicket, Tenant, Transaction, Wallet,Notification, PaymentRequest
from app.schemas import (
    AdminAddCoinsRequest,
    AdminResetPasswordRequest,
    AdminTicketUpdate,
    SuperAdminAuthRequest,
    SuperAdminTokenResponse,
)

router = APIRouter(prefix="/superadmin", tags=["superadmin"])

_SUPERADMIN_CLAIM = "superadmin"


# ── Auth helpers ──────────────────────────────────────────────────────────────

def _create_superadmin_token() -> str:
    expire = datetime.now(timezone.utc) + timedelta(
        hours=settings.SUPERADMIN_JWT_EXPIRE_HOURS
    )
    return jwt.encode(
        {"sub": _SUPERADMIN_CLAIM, "exp": expire},
        settings.JWT_SECRET_KEY,
        algorithm=settings.JWT_ALGORITHM,
    )


def _verify_superadmin_token(token: str) -> None:
    exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired superadmin token",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(
            token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM]
        )
        if payload.get("sub") != _SUPERADMIN_CLAIM:
            raise exc
    except JWTError:
        raise exc


from fastapi.security import OAuth2PasswordBearer

_sa_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/superadmin/auth")


def get_superadmin(token: str = Depends(_sa_scheme)) -> None:
    _verify_superadmin_token(token)


# ── Auth endpoint ─────────────────────────────────────────────────────────────

@router.post("/auth", response_model=SuperAdminTokenResponse)
async def superadmin_login(payload: SuperAdminAuthRequest) -> Any:
    if payload.secret != settings.SUPERADMIN_SECRET:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid superadmin secret",
        )
    return SuperAdminTokenResponse(token=_create_superadmin_token())


# ── Platform stats ────────────────────────────────────────────────────────────

@router.get("/stats", dependencies=[Depends(get_superadmin)])
async def platform_stats(db: AsyncSession = Depends(get_db)) -> dict[str, Any]:
    total_tenants = int((await db.scalar(select(func.count(Tenant.id)))) or 0)

    total_revenue_tzs = int(
    (
        await db.scalar(
            select(func.coalesce(func.sum(Transaction.amount_tzs), 0)).where(
                Transaction.tx_type == "credit"
            )
        )
    )
    or 0
)

    total_coins_purchased = int(
        (
            await db.scalar(
                select(func.coalesce(func.sum(Transaction.coin_amount), 0)).where(
                    Transaction.tx_type == "credit"
                )
            )
        )
        or 0
    )

    total_wallet_balance = int(
        (await db.scalar(select(func.coalesce(func.sum(Wallet.balance), 0)))) or 0
    )
    coins_consumed = max(0, total_coins_purchased - total_wallet_balance)

    open_tickets = int(
        (
            await db.scalar(
                select(func.count(SupportTicket.id)).where(
                    SupportTicket.status != "resolved"
                )
            )
        )
        or 0
    )

    return {
        "total_tenants": total_tenants,
        "total_revenue_tzs": total_revenue_tzs,
        "total_coins_purchased": total_coins_purchased,
        "coins_consumed": coins_consumed,
        "open_tickets": open_tickets,
    }


def _build_date_range(days: int = 30) -> list[str]:
    now = datetime.now(timezone.utc)
    return [(now - timedelta(days=i)).date().isoformat() for i in range(days - 1, -1, -1)]


@router.get("/revenue-trend", dependencies=[Depends(get_superadmin)])
async def revenue_trend(
    days: int = Query(default=30, ge=7, le=90),
    db: AsyncSession = Depends(get_db),
) -> list[dict[str, Any]]:
    start = datetime.now(timezone.utc) - timedelta(days=days)

    rows = (
        await db.execute(
            select(
                func.date(Transaction.created_at).label("day"),
                func.sum(Transaction.amount_tzs).label("revenue"),
            )
            .where(Transaction.tx_type == "credit", Transaction.created_at >= start)
            .group_by(func.date(Transaction.created_at))
            .order_by(func.date(Transaction.created_at))
        )
    ).all()

    revenue_map: dict[str, int] = {str(r.day): int(r.revenue) for r in rows}
    return [
        {"date": d, "revenue": revenue_map.get(d, 0)}
        for d in _build_date_range(days)
    ]


@router.get("/user-growth", dependencies=[Depends(get_superadmin)])
async def user_growth(
    days: int = Query(default=30, ge=7, le=90),
    db: AsyncSession = Depends(get_db),
) -> list[dict[str, Any]]:
    # Tenants don't have created_at — use wallet.last_updated as a proxy, or
    # count all tenants per day via transactions. Since Tenant lacks created_at,
    # we add a created_at column check; if missing we return placeholder.
    # For now: query by wallet last_updated date as tenant creation proxy.
    start = datetime.now(timezone.utc) - timedelta(days=days)

    rows = (
        await db.execute(
            select(
                func.date(Wallet.last_updated).label("day"),
                func.count(Wallet.id).label("new_users"),
            )
            .where(Wallet.last_updated >= start)
            .group_by(func.date(Wallet.last_updated))
            .order_by(func.date(Wallet.last_updated))
        )
    ).all()

    growth_map: dict[str, int] = {str(r.day): int(r.new_users) for r in rows}
    return [
        {"date": d, "new_tenants": growth_map.get(d, 0)}
        for d in _build_date_range(days)
    ]


@router.get("/ai-activity", dependencies=[Depends(get_superadmin)])
async def ai_activity(
    days: int = Query(default=30, ge=7, le=90),
    db: AsyncSession = Depends(get_db),
) -> list[dict[str, Any]]:
    start = datetime.now(timezone.utc) - timedelta(days=days)

    rows = (
        await db.execute(
            select(
                func.date(Transaction.created_at).label("day"),
                func.sum(Transaction.coin_amount).label("coins"),
            )
            .where(Transaction.tx_type == "deduction", Transaction.created_at >= start)
            .group_by(func.date(Transaction.created_at))
            .order_by(func.date(Transaction.created_at))
        )
    ).all()

    coins_map: dict[str, int] = {str(r.day): int(r.coins) for r in rows}
    return [
        {"date": d, "coins": coins_map.get(d, 0)}
        for d in _build_date_range(days)
    ]


# ── Tenants CRUD ──────────────────────────────────────────────────────────────

@router.get("/tenants", dependencies=[Depends(get_superadmin)])
async def list_tenants(
    search: Optional[str] = Query(default=None),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    stmt = select(Tenant)
    if search:
        pattern = f"%{search}%"
        from sqlalchemy import or_
        stmt = stmt.where(
            or_(
                Tenant.email.ilike(pattern),
                Tenant.biz_name.ilike(pattern),
            )
        )
    total = int((await db.scalar(select(func.count()).select_from(stmt.subquery()))) or 0)
    tenants = (await db.scalars(stmt.offset(skip).limit(limit))).all()

    return {
        "total": total,
        "items": [
                {
                    "id": str(t.id),
                    "biz_name": t.biz_name,
                    "email": t.email,
                    "slug": t.slug,
                    "is_verified": t.is_verified,
                    "ai_mode": t.ai_mode,
                }
                for t in tenants
            ],
    }


@router.put("/tenants/{tenant_id}", dependencies=[Depends(get_superadmin)])
async def update_tenant(
    tenant_id: uuid.UUID,
    payload: dict,
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    tenant = await db.get(Tenant, tenant_id)
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    allowed_fields = {"biz_name", "email"}
    for field in allowed_fields:
        if field in payload:
            setattr(tenant, field, payload[field])

    await db.commit()
    return {"id": str(tenant.id), "biz_name": tenant.biz_name, "email": tenant.email}


@router.delete("/tenants/{tenant_id}", dependencies=[Depends(get_superadmin)], status_code=204)
async def delete_tenant(
    tenant_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> None:
    tenant = await db.get(Tenant, tenant_id)
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    await db.delete(tenant)
    await db.commit()


@router.post("/tenants/{tenant_id}/reset-password", dependencies=[Depends(get_superadmin)])
async def reset_tenant_password(
    tenant_id: uuid.UUID,
    payload: AdminResetPasswordRequest,
    db: AsyncSession = Depends(get_db),
) -> dict[str, str]:
    tenant = await db.get(Tenant, tenant_id)
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    tenant.hashed_password = hash_password(payload.new_password)
    await db.commit()
    return {"message": f"Password reset for {tenant.email}"}


@router.post("/tenants/{tenant_id}/add-coins", dependencies=[Depends(get_superadmin)])
async def add_coins_to_wallet(
    tenant_id: uuid.UUID,
    payload: AdminAddCoinsRequest,
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    from sqlalchemy import update as sa_update

    wallet = (
        await db.scalar(select(Wallet).where(Wallet.tenant_id == tenant_id))
    )
    if not wallet:
        raise HTTPException(status_code=404, detail="Wallet not found for this tenant")

    wallet.balance += payload.coins
    await db.commit()
    await db.refresh(wallet)
    return {"tenant_id": str(tenant_id), "new_balance": wallet.balance, "coins_added": payload.coins}


# ── Transactions ──────────────────────────────────────────────────────────────

@router.get("/transactions", dependencies=[Depends(get_superadmin)])
async def list_transactions(
    status_filter: Optional[str] = Query(default=None, alias="status"),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    stmt = select(Transaction)
    if status_filter in ("credit", "deduction"):
        stmt = stmt.where(Transaction.tx_type == status_filter)
    stmt = stmt.order_by(Transaction.created_at.desc())

    total = int((await db.scalar(select(func.count()).select_from(stmt.subquery()))) or 0)
    txns = (await db.scalars(stmt.offset(skip).limit(limit))).all()

    return {
        "total": total,
        "items": [
            {
                "id": str(t.id),
                "tenant_id": str(t.tenant_id),
                "amount_tzs": t.amount_tzs,
                "coin_amount": t.coin_amount,
                "tx_type": t.tx_type,
                "created_at": t.created_at.isoformat(),
            }
            for t in txns
        ],
    }


# ── Wallets ───────────────────────────────────────────────────────────────────

@router.get("/wallets", dependencies=[Depends(get_superadmin)])
async def list_wallets(
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    stmt = select(Wallet, Tenant).join(Tenant, Wallet.tenant_id == Tenant.id)
    total = int(
        (await db.scalar(select(func.count(Wallet.id)))) or 0
    )
    rows = (await db.execute(stmt.offset(skip).limit(limit))).all()

    return {
        "total": total,
        "items": [
            {
                "id": str(w.id),
                "tenant_id": str(w.tenant_id),
                "tenant_name": t.biz_name,
                "balance": w.balance,
                "last_updated": w.last_updated.isoformat(),
            }
            for w, t in rows
        ],
    }


# ── Support Tickets ───────────────────────────────────────────────────────────

@router.get("/tickets", dependencies=[Depends(get_superadmin)])
async def list_all_tickets(
    status_filter: Optional[str] = Query(default=None, alias="status"),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    stmt = select(SupportTicket, Tenant).join(Tenant, SupportTicket.tenant_id == Tenant.id)
    if status_filter in ("pending", "in_progress", "resolved"):
        stmt = stmt.where(SupportTicket.status == status_filter)
    stmt = stmt.order_by(SupportTicket.created_at.desc())

    total = int(
        (await db.scalar(select(func.count(SupportTicket.id)))) or 0
    )
    rows = (await db.execute(stmt.offset(skip).limit(limit))).all()

    return {
        "total": total,
        "items": [
            {
                "id": str(tk.id),
                "tenant_id": str(tk.tenant_id),
                "tenant_name": t.biz_name,
                "subject": tk.subject,
                "category": tk.category,
                "message": tk.message,
                "status": tk.status,
                "admin_reply": tk.admin_reply,
                "created_at": tk.created_at.isoformat(),
                "updated_at": tk.updated_at.isoformat(),
            }
            for tk, t in rows
        ],
    }


@router.put("/tickets/{ticket_id}", dependencies=[Depends(get_superadmin)])
async def update_ticket(
    ticket_id: uuid.UUID,
    payload: AdminTicketUpdate,
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    ticket = await db.get(SupportTicket, ticket_id)
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    if payload.status is not None:
        ticket.status = payload.status
    if payload.admin_reply is not None:
        ticket.admin_reply = payload.admin_reply

    await db.commit()
    await db.refresh(ticket)
    return {
        "id": str(ticket.id),
        "status": ticket.status,
        "admin_reply": ticket.admin_reply,
    }

@router.patch("/tenants/{tenant_id}/verify", dependencies=[Depends(get_superadmin)])
async def toggle_verify_tenant(
    tenant_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    tenant = await db.get(Tenant, tenant_id)
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    tenant.is_verified = not tenant.is_verified
    await db.commit()
    return {"id": str(tenant.id), "is_verified": tenant.is_verified}


# ── Payment Requests ──────────────────────────────────────────────────────────

@router.get("/payment-requests", dependencies=[Depends(get_superadmin)])
async def list_payment_requests(
    status_filter: Optional[str] = Query(default=None, alias="status"),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
) -> dict:
    stmt = select(PaymentRequest, Tenant).join(Tenant, PaymentRequest.tenant_id == Tenant.id)
    if status_filter in ("pending", "approved", "rejected"):
        stmt = stmt.where(PaymentRequest.status == status_filter)
    stmt = stmt.order_by(PaymentRequest.created_at.desc())

    total = int((await db.scalar(select(func.count(PaymentRequest.id)))) or 0)
    rows = (await db.execute(stmt.offset(skip).limit(limit))).all()

    return {
        "total": total,
        "items": [
            {
                "id": str(r.id),
                "tenant_id": str(r.tenant_id),
                "tenant_name": t.biz_name,
                "tenant_email": t.email,
                "amount_tzs": r.amount_tzs,
                "coins_requested": r.coins_requested,
                "package_id": r.package_id,
                "mpesa_ref": r.mpesa_ref,
                "status": r.status,
                "admin_note": r.admin_note,
                "created_at": r.created_at.isoformat(),
            }
            for r, t in rows
        ],
    }


@router.post("/payment-requests/{request_id}/approve", dependencies=[Depends(get_superadmin)])
async def approve_payment_request(
    request_id: uuid.UUID,
    payload: AdminPaymentAction,
    db: AsyncSession = Depends(get_db),
) -> dict:
    from datetime import datetime, timedelta, timezone
    from app.models import Subscription
    from app.schemas import SUBSCRIPTION_PLANS

    req = await db.get(PaymentRequest, request_id)
    if not req:
        raise HTTPException(status_code=404, detail="Payment request not found")
    if req.status != "pending":
        raise HTTPException(status_code=400, detail="Request is not pending")

    # Subscription approval
    if req.package_id.startswith("sub_"):
        plan_id = req.package_id.replace("sub_", "")
        plan = next((p for p in SUBSCRIPTION_PLANS if p["id"] == plan_id), None)
        if not plan:
            raise HTTPException(status_code=400, detail="Invalid plan")

        now = datetime.now(timezone.utc)

        # Deactivate existing subscription if any
        existing_sub = await db.execute(
            select(Subscription).where(
                Subscription.tenant_id == req.tenant_id,
                Subscription.status == "active",
            )
        )
        old_sub = existing_sub.scalar_one_or_none()
        if old_sub:
            old_sub.status = "cancelled"

        # Create new subscription
        db.add(Subscription(
            tenant_id=req.tenant_id,
            plan_id=plan_id,
            messages_included=plan["messages_included"],
            messages_used=0,
            status="active",
            started_at=now,
            expires_at=now + timedelta(days=30),
        ))

        # Notify merchant
        db.add(Notification(
            tenant_id=req.tenant_id,
            type="new_message",
            message=(
                f"✅ Mpango wako wa {plan['label']} umewashwa! "
                f"Una mazungumzo {plan['messages_included']:,} kwa mwezi huu."
            ),
            is_read=False,
        ))

    else:
        # Regular coin top-up
        wallet = await db.scalar(select(Wallet).where(Wallet.tenant_id == req.tenant_id))
        if not wallet:
            raise HTTPException(status_code=404, detail="Wallet not found")
        wallet.balance += req.coins_requested
        db.add(Transaction(
            tenant_id=req.tenant_id,
            wallet_id=wallet.id,
            coin_amount=req.coins_requested,
            tx_type="credit",
            amount_tzs=req.amount_tzs,
            package_id=req.package_id,
            note=f"Manual top-up approved. Ref: {req.mpesa_ref}",
        ))
        db.add(Notification(
            tenant_id=req.tenant_id,
            type="new_message",
            message=f"✅ Coins {req.coins_requested:,} zimeongezwa kwenye akaunti yako.",
            is_read=False,
        ))

    req.status = "approved"
    req.admin_note = payload.admin_note
    await db.commit()
    return {"status": "approved"}


@router.post("/payment-requests/{request_id}/reject", dependencies=[Depends(get_superadmin)])
async def reject_payment_request(
    request_id: uuid.UUID,
    payload: AdminPaymentAction,
    db: AsyncSession = Depends(get_db),
) -> dict:
    req = await db.get(PaymentRequest, request_id)
    if not req:
        raise HTTPException(status_code=404, detail="Payment request not found")
    if req.status != "pending":
        raise HTTPException(status_code=400, detail="Request is not pending")

    req.status = "rejected"
    req.admin_note = payload.admin_note
    await db.commit()

    return {"status": "rejected"}



from app.models import Customer, NumberClaim

# ── Customer Management ───────────────────────────────────────────────────────

@router.get("/customers", dependencies=[Depends(get_superadmin)])
async def list_customers(
    search: Optional[str] = Query(default=None),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
) -> list:
    stmt = select(Customer)
    if search:
        stmt = stmt.where(
            (Customer.name.ilike(f"%{search}%")) |
            (Customer.phone.ilike(f"%{search}%"))
        )
    stmt = stmt.order_by(Customer.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(stmt)
    customers = result.scalars().all()
    return [
        {
            "id": str(c.id),
            "name": c.name,
            "phone": c.phone,
            "created_at": c.created_at.isoformat(),
        }
        for c in customers
    ]


@router.delete("/customers/{customer_id}", dependencies=[Depends(get_superadmin)])
async def delete_customer(
    customer_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> dict:
    customer = await db.get(Customer, customer_id)
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    await db.delete(customer)
    await db.commit()
    return {"status": "deleted"}


# ── Number Claims ─────────────────────────────────────────────────────────────

@router.get("/number-claims", dependencies=[Depends(get_superadmin)])
async def list_number_claims(
    db: AsyncSession = Depends(get_db),
) -> list:
    result = await db.execute(
        select(NumberClaim).order_by(NumberClaim.created_at.desc())
    )
    claims = result.scalars().all()
    return [
        {
            "id": str(c.id),
            "phone": c.phone,
            "claimant_name": c.claimant_name,
            "claimant_contact": c.claimant_contact,
            "claim_code": c.claim_code,
            "status": c.status,
            "admin_note": c.admin_note,
            "created_at": c.created_at.isoformat(),
        }
        for c in claims
    ]


@router.post("/number-claims/{claim_id}/resolve", dependencies=[Depends(get_superadmin)])
async def resolve_claim(
    claim_id: uuid.UUID,
    payload: AdminPaymentAction,
    db: AsyncSession = Depends(get_db),
) -> dict:
    claim = await db.get(NumberClaim, claim_id)
    if not claim:
        raise HTTPException(status_code=404, detail="Claim not found")
    claim.status = "resolved"
    claim.admin_note = payload.admin_note
    await db.commit()
    return {"status": "resolved"}


@router.post("/number-claims/{claim_id}/reject", dependencies=[Depends(get_superadmin)])
async def reject_claim(
    claim_id: uuid.UUID,
    payload: AdminPaymentAction,
    db: AsyncSession = Depends(get_db),
) -> dict:
    claim = await db.get(NumberClaim, claim_id)
    if not claim:
        raise HTTPException(status_code=404, detail="Claim not found")
    claim.status = "rejected"
    claim.admin_note = payload.admin_note
    await db.commit()
    return {"status": "rejected"}


class BroadcastRequest(BaseModel):
    message: str = Field(..., min_length=5, max_length=500)
    tenant_ids: Optional[list[str]] = None  # None = all tenants


@router.post("/broadcast", dependencies=[Depends(get_superadmin)])
async def broadcast_notification(
    payload: BroadcastRequest,
    db: AsyncSession = Depends(get_db),
) -> dict:
    if payload.tenant_ids:
        tenant_ids = [uuid.UUID(tid) for tid in payload.tenant_ids]
    else:
        result = await db.execute(select(Tenant.id))
        tenant_ids = result.scalars().all()

    for tid in tenant_ids:
        db.add(Notification(
            tenant_id=tid,
            type="new_message",
            message=f"📢 {payload.message}",
            is_read=False,
        ))
    await db.commit()
    return {"sent_to": len(tenant_ids)}


from app.models import MessageFeedback, Message as ChatMessage, Conversation

@router.get("/feedback", dependencies=[Depends(get_superadmin)])
async def list_feedback(
    rating: Optional[str] = Query(default=None),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
) -> dict:
    stmt = (
        select(MessageFeedback, ChatMessage, Conversation, Tenant)
        .join(ChatMessage, MessageFeedback.message_id == ChatMessage.id)
        .join(Conversation, MessageFeedback.conversation_id == Conversation.id)
        .join(Tenant, Conversation.tenant_id == Tenant.id)
    )
    if rating in ("positive", "negative"):
        stmt = stmt.where(MessageFeedback.rating == rating)
    stmt = stmt.order_by(MessageFeedback.created_at.desc())

    total_result = await db.execute(
        select(func.count(MessageFeedback.id))
    )
    total = total_result.scalar() or 0

    rows = (await db.execute(stmt.offset(skip).limit(limit))).all()

    return {
        "total": total,
        "items": [
            {
                "id": str(fb.id),
                "rating": fb.rating,
                "comment": fb.comment,
                "message_content": msg.content,
                "tenant_name": tenant.biz_name,
                "customer_phone": conv.customer_phone,
                "created_at": fb.created_at.isoformat(),
            }
            for fb, msg, conv, tenant in rows
        ],
    }
