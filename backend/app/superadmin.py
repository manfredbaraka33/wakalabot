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
from app.models import (
    Notification, SupportTicket, Tenant, Transaction, Wallet, PaymentRequest,
    Conversation, Subscription,
)
from app.schemas import AdminPaymentAction
from app.subscriptions import get_current_subscription

from app.auth import hash_password
from app.core import settings
from app.db import get_db
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


def _period_label(duration_days: int) -> str:
    if duration_days <= 1:
        return "siku ya leo"
    if duration_days <= 7:
        return "wiki hii"
    if duration_days <= 31:
        return "mwezi huu"
    return f"kipindi cha siku {duration_days}"

async def _activate_plan(db: AsyncSession, tenant_id: uuid.UUID, plan: dict) -> Subscription:
    """Start or renew a plan by updating the tenant's existing subscription
    row in place. Never inserts a second row, so renewals cannot violate the
    unique constraint on tenant_id."""
    now = datetime.now(timezone.utc)
    days = plan.get("duration_days", 30)

    result = await db.execute(
        select(Subscription).where(Subscription.tenant_id == tenant_id)
    )
    sub = result.scalars().first()

    if sub is None:
        sub = Subscription(tenant_id=tenant_id)
        db.add(sub)

    sub.plan_id = plan["id"]
    sub.messages_included = plan["messages_included"]
    sub.messages_used = 0
    sub.status = "active"
    sub.started_at = now
    sub.expires_at = now + timedelta(days=days)
    sub.duration_days = days
    sub.auto_renew_prompted = False
    return sub


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
) -> dict[str, Any]:
    start = datetime.now(timezone.utc) - timedelta(days=days)
    today_start = datetime.now(timezone.utc).replace(
        hour=0, minute=0, second=0, microsecond=0
    )

    # ── Daily trend — messages (deductions + subscription_usage) ─────────────
    trend_rows = (
        await db.execute(
            select(
                func.date(Transaction.created_at).label("day"),
                func.count(Transaction.id).label("count"),
            )
            .where(
                Transaction.tx_type.in_(["deduction", "subscription_usage"]),
                Transaction.created_at >= start,
            )
            .group_by(func.date(Transaction.created_at))
            .order_by(func.date(Transaction.created_at))
        )
    ).all()

    count_map: dict[str, int] = {str(r.day): int(r.count) for r in trend_rows}
    daily_trend = [
        {"date": d, "count": count_map.get(d, 0)}
        for d in _build_date_range(days)
    ]

    # ── Coins chart — keep backward compat for existing graph ─────────────────
    coins_rows = (
        await db.execute(
            select(
                func.date(Transaction.created_at).label("day"),
                func.coalesce(func.sum(Transaction.coin_amount), 0).label("coins"),
            )
            .where(
                Transaction.tx_type == "deduction",
                Transaction.created_at >= start,
            )
            .group_by(func.date(Transaction.created_at))
            .order_by(func.date(Transaction.created_at))
        )
    ).all()

    coins_map: dict[str, int] = {str(r.day): int(r.coins) for r in coins_rows}
    coins_chart = [
        {"date": d, "coins": coins_map.get(d, 0)}
        for d in _build_date_range(days)
    ]

    # ── Totals ────────────────────────────────────────────────────────────────
    totals = (
        await db.execute(
            select(
                func.count(Transaction.id).label("total_messages"),
                func.coalesce(func.sum(Transaction.usd_cost), 0).label("total_cost_usd"),
                func.coalesce(func.sum(Transaction.prompt_tokens), 0).label("prompt_tokens"),
                func.coalesce(func.sum(Transaction.completion_tokens), 0).label("completion_tokens"),
            )
            .where(
                Transaction.tx_type.in_(["deduction", "subscription_usage"]),
                Transaction.created_at >= start,
            )
        )
    ).one()

    # ── Today ─────────────────────────────────────────────────────────────────
    today_count = (
        await db.scalar(
            select(func.count(Transaction.id)).where(
                Transaction.tx_type.in_(["deduction", "subscription_usage"]),
                Transaction.created_at >= today_start,
            )
        )
    ) or 0

    # ── Eco vs Smart ──────────────────────────────────────────────────────────
    eco_count = (
        await db.scalar(
            select(func.count(Transaction.id)).where(
                Transaction.tx_type.in_(["deduction", "subscription_usage"]),
                Transaction.created_at >= start,
                Transaction.note.ilike("%eco%"),
            )
        )
    ) or 0

    smart_count = (
        await db.scalar(
            select(func.count(Transaction.id)).where(
                Transaction.tx_type.in_(["deduction", "subscription_usage"]),
                Transaction.created_at >= start,
                Transaction.note.ilike("%smart%"),
            )
        )
    ) or 0

    # ── Subscription vs Coins split ───────────────────────────────────────────
    sub_count = (
        await db.scalar(
            select(func.count(Transaction.id)).where(
                Transaction.tx_type == "subscription_usage",
                Transaction.created_at >= start,
            )
        )
    ) or 0

    coin_count = (
        await db.scalar(
            select(func.count(Transaction.id)).where(
                Transaction.tx_type == "deduction",
                Transaction.created_at >= start,
            )
        )
    ) or 0

    # ── Active tenants ────────────────────────────────────────────────────────
    active_tenants = (
        await db.scalar(
            select(func.count(func.distinct(Transaction.tenant_id))).where(
                Transaction.tx_type.in_(["deduction", "subscription_usage"]),
                Transaction.created_at >= start,
            )
        )
    ) or 0

    # ── Top 5 tenants by message count ────────────────────────────────────────
    top_rows = (
        await db.execute(
            select(
                Transaction.tenant_id,
                func.count(Transaction.id).label("msg_count"),
                func.coalesce(func.sum(Transaction.usd_cost), 0).label("cost"),
            )
            .where(
                Transaction.tx_type.in_(["deduction", "subscription_usage"]),
                Transaction.created_at >= start,
            )
            .group_by(Transaction.tenant_id)
            .order_by(func.count(Transaction.id).desc())
            .limit(5)
        )
    ).all()

    top_tenants = []
    for row in top_rows:
        tenant_obj = await db.get(Tenant, row.tenant_id)
        top_tenants.append({
            "tenant_id": str(row.tenant_id),
            "biz_name": tenant_obj.biz_name if tenant_obj else "Unknown",
            "username": tenant_obj.username if tenant_obj else "—",
            "message_count": row.msg_count,
            "cost_usd": round(float(row.cost), 4),
        })

    return {
        # Backward compat — existing coins chart still works unchanged
        "coins_chart": coins_chart,
        # New fields
        "daily_trend": daily_trend,
        "total_messages": int(totals.total_messages),
        "today_messages": int(today_count),
        "total_cost_usd": round(float(totals.total_cost_usd), 4),
        "total_prompt_tokens": int(totals.prompt_tokens),
        "total_completion_tokens": int(totals.completion_tokens),
        "eco_messages": int(eco_count),
        "smart_messages": int(smart_count),
        "subscription_messages": int(sub_count),
        "coin_messages": int(coin_count),
        "active_tenants": int(active_tenants),
        "top_tenants": top_tenants,
        "period_days": days,
    }

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
                Tenant.username.ilike(pattern),
                Tenant.biz_name.ilike(pattern),
                Tenant.email.ilike(pattern),
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
                "username": t.username,
                "email": t.email,
                "phone": t.phone,
                "slug": t.slug,
                "is_verified": t.is_verified,
                "bot_type": t.bot_type,
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
    tx_type: Optional[str] = Query(default=None),
    tenant_id_search: Optional[str] = Query(default=None),
    date_from: Optional[str] = Query(default=None),
    date_to: Optional[str] = Query(default=None),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    from sqlalchemy import and_

    filters = []
    if tx_type in ("credit", "deduction", "subscription_usage"):
        filters.append(Transaction.tx_type == tx_type)
    if tenant_id_search:
        try:
            tid = uuid.UUID(tenant_id_search.strip())
            filters.append(Transaction.tenant_id == tid)
        except ValueError:
            pass
    if date_from:
        try:
            filters.append(Transaction.created_at >= datetime.fromisoformat(date_from))
        except ValueError:
            pass
    if date_to:
        try:
            filters.append(Transaction.created_at <= datetime.fromisoformat(date_to))
        except ValueError:
            pass

    where_clause = and_(*filters) if filters else None

    count_stmt = select(func.count(Transaction.id))
    amount_stmt = select(func.coalesce(func.sum(Transaction.amount_tzs), 0))
    data_stmt = select(Transaction).order_by(Transaction.created_at.desc())

    if where_clause is not None:
        count_stmt = count_stmt.where(where_clause)
        amount_stmt = amount_stmt.where(where_clause)
        data_stmt = data_stmt.where(where_clause)

    total = int((await db.scalar(count_stmt)) or 0)
    total_amount = int((await db.scalar(amount_stmt)) or 0)
    txns = (await db.scalars(data_stmt.offset(skip).limit(limit))).all()

    return {
        "total": total,
        "total_amount_tzs": total_amount,
        "items": [
            {
                "id": str(t.id),
                "tenant_id": str(t.tenant_id),
                "amount_tzs": t.amount_tzs,
                "coin_amount": t.coin_amount,
                "tx_type": t.tx_type,
                "note": t.note,
                "package_id": t.package_id,
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
        duration_days = plan.get("duration_days", 30)
        period_label = _period_label(duration_days)

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
            await db.flush()

        # Create new subscription
        db.add(Subscription(
            tenant_id=req.tenant_id,
            plan_id=plan_id,
            messages_included=plan["messages_included"],
            messages_used=0,
            status="active",
            started_at=now,
            expires_at=now + timedelta(days=duration_days),
            duration_days=duration_days,
        ))

        # Send SMS to merchant
        from app.sms import send_sms
        tenant_obj = await db.get(Tenant, req.tenant_id)
        if tenant_obj and tenant_obj.phone:
            await send_sms(
                tenant_obj.phone,
                f"✅ Mpango wa {plan['label']} umewashwa! "
                f"Mazungumzo {plan['messages_included']:,}/{period_label}."
            )

        # Notify merchant in-app
        db.add(Notification(
            tenant_id=req.tenant_id,
            type="new_message",
            message=(
                f"✅ Mpango wako wa {plan['label']} umewashwa! "
                f"Una mazungumzo {plan['messages_included']:,} kwa {period_label}."
            ),
            is_read=False,
        ))
        
        # Record revenue for this subscription payment
        wallet = await db.scalar(select(Wallet).where(Wallet.tenant_id == req.tenant_id))
        if wallet:
            db.add(Transaction(
                tenant_id=req.tenant_id,
                wallet_id=wallet.id,
                coin_amount=0,
                tx_type="credit",
                amount_tzs=plan["amount_tzs"],
                package_id=req.package_id,
                note=f"Subscription activated: {plan['label']} ({plan['messages_included']:,} messages/{period_label}). Ref: {req.mpesa_ref}",
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

        from app.sms import send_sms
        tenant_obj = await db.get(Tenant, req.tenant_id)
        if tenant_obj and tenant_obj.phone:
            await send_sms(
                tenant_obj.phone,
                f"✅ Coins {req.coins_requested:,} zimeongezwa. "
                f"Salio jipya: {wallet.balance:,} coins."
            )

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




from sqlalchemy import delete
from app.models import Conversation, CustomerNote, UnansweredQuestion 

@router.delete("/customers/{customer_id}", dependencies=[Depends(get_superadmin)])
async def delete_customer(
    customer_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> dict:
    # 1. Fetch the customer first to get their phone number
    customer = await db.get(Customer, customer_id)
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
        
    target_phone = customer.phone

    # 2. Delete Customer Notes tied to this phone number
    await db.execute(
        delete(CustomerNote).where(CustomerNote.customer_phone == target_phone)
    )

    # 3. Delete Unanswered Questions tied to this phone number
    await db.execute(
        delete(UnansweredQuestion).where(UnansweredQuestion.customer_phone == target_phone)
    )

    # 4. Delete Conversations (This automatically triggers cascades!)
    # Because your Conversation model has cascade="all, delete-orphan" on its relationships,
    # deleting the conversation will instantly wipe out all linked Messages and LeadEvents.
    await db.execute(
        delete(Conversation).where(Conversation.customer_phone == target_phone)
    )

    # 5. Delete the actual Customer account
    await db.delete(customer)
    
    # Commit all changes in a single transaction
    await db.commit()

    return {
        "status": "deleted", 
        "detail": f"Customer and all chat records for phone {target_phone} wiped successfully."
    }





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


from app.schemas import SUBSCRIPTION_PLANS


class SetPlanRequest(BaseModel):
    plan_id: str  # 'starter' | 'business' | 'pro' | 'none'


@router.get("/tenants/{tenant_id}/subscription", dependencies=[Depends(get_superadmin)])
async def get_tenant_subscription(
    tenant_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> dict:
    from app.models import Subscription
    result = await db.execute(
        select(Subscription).where(
            Subscription.tenant_id == tenant_id,
            Subscription.status == "active",
        )
    )
    sub = await get_current_subscription(db, tenant_id)
    if not sub:
        return {"has_subscription": False}
    return {
        "has_subscription": True,
        "plan_id": sub.plan_id,
        "messages_used": sub.messages_used,
        "messages_included": sub.messages_included,
        "expires_at": sub.expires_at.isoformat(),
        "is_expired": sub.expires_at <= datetime.now(timezone.utc),
    }


@router.get("/tenants/{tenant_id}/details", dependencies=[Depends(get_superadmin)])
async def get_tenant_details(
    tenant_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> dict:
    from app.models import Product, LeadEvent

    tenant = await db.get(Tenant, tenant_id)
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    wallet = await db.scalar(select(Wallet).where(Wallet.tenant_id == tenant_id))

    sub = await get_current_subscription(db, tenant_id)

    total_spent = int(
        (await db.scalar(
            select(func.coalesce(func.sum(Transaction.amount_tzs), 0))
            .where(Transaction.tenant_id == tenant_id, Transaction.tx_type == "credit")
        )) or 0
    )
    conv_count = int(
        (await db.scalar(
            select(func.count(Conversation.id)).where(Conversation.tenant_id == tenant_id)
        )) or 0
    )
    lead_count = int(
        (await db.scalar(
            select(func.count(LeadEvent.id)).where(LeadEvent.tenant_id == tenant_id)
        )) or 0
    )
    product_count = int(
        (await db.scalar(
            select(func.count(Product.id)).where(Product.tenant_id == tenant_id)
        )) or 0
    )

    return {
        "id": str(tenant.id),
        "biz_name": tenant.biz_name,
        "username": tenant.username,
        "email": tenant.email,
        "phone": tenant.phone,
        "slug": tenant.slug,
        "is_verified": tenant.is_verified,
        "ai_mode": tenant.ai_mode,
        "wallet": {
            "balance": wallet.balance if wallet else 0,
            "last_updated": wallet.last_updated.isoformat() if wallet else None,
        },
        "subscription": {
            "has_subscription": sub is not None,
            "plan_id": sub.plan_id if sub else None,
            "messages_used": sub.messages_used if sub else 0,
            "messages_included": sub.messages_included if sub else 0,
            "expires_at": sub.expires_at.isoformat() if sub else None,
        },
        "stats": {
            "conversations": conv_count,
            "leads": lead_count,
            "products": product_count,
            "total_spent_tzs": total_spent,
        },
    }




@router.post("/tenants/{tenant_id}/set-plan", dependencies=[Depends(get_superadmin)])
async def set_tenant_plan(
    tenant_id: uuid.UUID,
    payload: SetPlanRequest,
    db: AsyncSession = Depends(get_db),
) -> dict:
    if payload.plan_id == "none":
        result = await db.execute(
            select(Subscription).where(Subscription.tenant_id == tenant_id).order_by(Subscription.expires_at.desc())
        )
        sub = result.scalars().first()
        if sub:
            sub.status = "cancelled"
        await db.commit()
        return {"status": "subscription_removed"}

    plan = next((p for p in SUBSCRIPTION_PLANS if p["id"] == payload.plan_id), None)
    if not plan:
        raise HTTPException(status_code=400, detail="Invalid plan_id")

    await _activate_plan(db, tenant_id, plan)

    period_label = _period_label(plan.get("duration_days", 30))
    db.add(Notification(
        tenant_id=tenant_id,
        type="new_message",
        message=(
            f"✅ Mpango wako umewekwa hadi {plan['label']} "
            f"({plan['messages_included']:,} mazungumzo kwa {period_label}) na admin."
        ),
        is_read=False,
    ))

    await db.commit()
    return {"status": "plan_set", "plan": plan["label"]}