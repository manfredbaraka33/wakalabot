"""
Billing module — subscription-only. No coins, no wallet top-ups.
"""
import logging
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_tenant
from app.db import get_db
from app.models import Tenant, Transaction, PaymentRequest, Subscription
from app.schemas import TransactionOut, PaymentRequestOut, SUBSCRIPTION_PLANS

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/billing", tags=["billing"])


@router.get("/plans")
async def get_plans():
    return SUBSCRIPTION_PLANS


@router.post("/subscribe")
async def subscribe(
    plan_id: str,
    mpesa_ref: str,
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
) -> dict:
    plan = next((p for p in SUBSCRIPTION_PLANS if p["id"] == plan_id), None)
    if not plan:
        raise HTTPException(status_code=400, detail="Invalid plan")

    # Only block a NEW request if one is currently pending admin review —
    # this does NOT block renewal after expiry/exhaustion, since those
    # requests are already approved/rejected, not pending.
    existing = await db.execute(
        select(PaymentRequest).where(
            PaymentRequest.tenant_id == tenant.id,
            PaymentRequest.status == "pending",
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=409,
            detail="Tayari una ombi linalosubiri idhini ya admin."
        )

    db.add(PaymentRequest(
        tenant_id=tenant.id,
        amount_tzs=plan["amount_tzs"],
        coins_requested=0,
        package_id=f"sub_{plan_id}",
        mpesa_ref=mpesa_ref.strip(),
        status="pending",
    ))
    await db.commit()
    return {"status": "pending", "plan": plan["label"]}


@router.get("/subscription")
async def get_subscription(
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
) -> dict:
    now = datetime.now(timezone.utc)
    result = await db.execute(
        select(Subscription)
        .where(
            Subscription.tenant_id == tenant.id,
            Subscription.status == "active",
        )
        .order_by(Subscription.expires_at.desc())
    )
    sub = result.scalars().first()
    if not sub:
        return {"has_subscription": False}

    is_expired = sub.expires_at < now
    is_exhausted = sub.messages_used >= sub.messages_included

    return {
        "has_subscription": True,
        "plan_id": sub.plan_id,
        "messages_used": sub.messages_used,
        "messages_included": sub.messages_included,
        "messages_remaining": max(0, sub.messages_included - sub.messages_used),
        "expires_at": sub.expires_at.isoformat(),
        "duration_days": sub.duration_days,
        "is_expired": is_expired,
        "is_exhausted": is_exhausted,
        "usage_percent": round((sub.messages_used / sub.messages_included) * 100)
            if sub.messages_included else 0,
    }


@router.get("/subscription-status")
async def subscription_status(
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Single source of truth for the frontend banner — tells it exactly
    which state the tenant is in so the UI never shows a stale 'active'
    card when the plan has actually expired or run out of messages."""
    now = datetime.now(timezone.utc)
    result = await db.execute(
        select(Subscription)
        .where(
            Subscription.tenant_id == tenant.id,
            Subscription.status == "active",
        )
        .order_by(Subscription.expires_at.desc())
    )
    sub = result.scalars().first()

    if not sub:
        return {
            "state": "no_plan",
            "message": "Huna mpango ulioanzishwa. Chagua mpango kuanza.",
        }

    if sub.expires_at < now:
        return {
            "state": "expired",
            "plan_id": sub.plan_id,
            "expired_at": sub.expires_at.isoformat(),
            "message": "Mpango wako umeisha muda. Nunua mpango mpya kuendelea.",
        }

    if sub.messages_used >= sub.messages_included:
        return {
            "state": "exhausted",
            "plan_id": sub.plan_id,
            "expires_at": sub.expires_at.isoformat(),
            "message": "Umefikia kikomo cha mazungumzo. Nunua mpango wa ziada kuendelea sasa.",
        }

    return {
        "state": "active",
        "plan_id": sub.plan_id,
        "messages_used": sub.messages_used,
        "messages_included": sub.messages_included,
        "expires_at": sub.expires_at.isoformat(),
        "duration_days": sub.duration_days,
    }


@router.get("/payment-requests", response_model=list[PaymentRequestOut])
async def list_payment_requests(
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(PaymentRequest)
        .where(PaymentRequest.tenant_id == tenant.id)
        .order_by(PaymentRequest.created_at.desc())
    )
    reqs = result.scalars().all()
    return [
        PaymentRequestOut(
            id=str(r.id),
            amount_tzs=r.amount_tzs,
            coins_requested=r.coins_requested,
            package_id=r.package_id,
            mpesa_ref=r.mpesa_ref,
            status=r.status,
            admin_note=r.admin_note,
            created_at=r.created_at,
        )
        for r in reqs
    ]


@router.get("/transactions", response_model=list[TransactionOut])
async def list_transactions(
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Transaction)
        .where(Transaction.tenant_id == tenant.id)
        .order_by(Transaction.created_at.desc())
    )
    transactions = result.scalars().all()
    return [
        TransactionOut(
            id=str(txn.id),
            coin_amount=txn.coin_amount,
            tx_type=txn.tx_type,
            prompt_tokens=txn.prompt_tokens,
            completion_tokens=txn.completion_tokens,
            usd_cost=float(txn.usd_cost) if txn.usd_cost else None,
            amount_tzs=txn.amount_tzs,
            package_id=txn.package_id,
            note=txn.note,
            created_at=txn.created_at,
        )
        for txn in transactions
    ]