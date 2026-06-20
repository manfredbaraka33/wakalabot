"""
Billing & Wallet module.
"""
import logging

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_tenant
from app.db import get_db
from app.models import Tenant, Transaction, Wallet, PaymentRequest
from app.schemas import (
    TransactionOut,
    WalletOut,
    PaymentRequestCreate,
    PaymentRequestOut,
    COIN_PACKAGES,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/billing", tags=["billing"])


@router.get("/wallet", response_model=WalletOut)
async def get_wallet(
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Wallet).where(Wallet.tenant_id == tenant.id))
    wallet = result.scalar_one_or_none()
    if not wallet:
        raise HTTPException(status_code=404, detail="Wallet not found")
    return WalletOut(balance=wallet.balance, last_updated=wallet.last_updated)


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


@router.get("/packages")
async def get_packages():
    """Return available coin packages."""
    return COIN_PACKAGES


@router.post("/payment-request", response_model=PaymentRequestOut)
async def submit_payment_request(
    payload: PaymentRequestCreate,
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
):
    """Merchant submits manual payment proof."""
    # Find package
    package = next((p for p in COIN_PACKAGES if p["id"] == payload.package_id), None)
    if not package:
        raise HTTPException(status_code=400, detail="Invalid package")

    # Check no pending request already
    existing = await db.execute(
        select(PaymentRequest).where(
            PaymentRequest.tenant_id == tenant.id,
            PaymentRequest.status == "pending",
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=409,
            detail="You already have a pending payment request. Please wait for admin approval."
        )

    req = PaymentRequest(
        tenant_id=tenant.id,
        amount_tzs=package["amount_tzs"],
        coins_requested=package["coins"],
        package_id=package["id"],
        mpesa_ref=payload.mpesa_ref.strip(),
        status="pending",
    )
    db.add(req)
    await db.commit()
    await db.refresh(req)

    return PaymentRequestOut(
        id=str(req.id),
        amount_tzs=req.amount_tzs,
        coins_requested=req.coins_requested,
        package_id=req.package_id,
        mpesa_ref=req.mpesa_ref,
        status=req.status,
        admin_note=req.admin_note,
        created_at=req.created_at,
    )


@router.get("/payment-requests", response_model=list[PaymentRequestOut])
async def list_payment_requests(
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
):
    """Merchant views their payment request history."""
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


from datetime import datetime, timedelta, timezone
from app.models import Subscription
from app.schemas import SUBSCRIPTION_PLANS

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

    # Check for pending subscription request already
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

    # Create payment request with plan info
    db.add(PaymentRequest(
        tenant_id=tenant.id,
        amount_tzs=plan["amount_tzs"],
        coins_requested=0,  # 0 coins — this is a subscription
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
    from datetime import datetime, timezone
    now = datetime.now(timezone.utc)
    result = await db.execute(
        select(Subscription).where(
            Subscription.tenant_id == tenant.id,
            Subscription.status == "active",
        )
    )
    sub = result.scalar_one_or_none()
    if not sub:
        return {"has_subscription": False}
    return {
        "has_subscription": True,
        "plan_id": sub.plan_id,
        "messages_used": sub.messages_used,
        "messages_included": sub.messages_included,
        "messages_remaining": max(0, sub.messages_included - sub.messages_used),
        "expires_at": sub.expires_at.isoformat(),
        "is_expired": sub.expires_at < now,
        "usage_percent": round((sub.messages_used / sub.messages_included) * 100),
    }