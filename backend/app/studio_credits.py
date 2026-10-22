"""All credit movements go through here. Balance changes are atomic and
append-only in the ledger; the DB also enforces credits >= 0."""
from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.studio_models import Creator, CreatorJob, CreatorPayment, CreditLedger

FIRST_PURCHASE_BONUS_PCT = 20
REFERRAL_REWARD_PCT = 10


class InsufficientCredits(Exception):
    pass


async def adjust_credits(
    db: AsyncSession, creator_id, delta: int, kind: str, *,
    job_id=None, ref: str | None = None, note: str | None = None,
) -> int:
    """Atomically change a balance and write the ledger row. Caller commits."""
    stmt = update(Creator).where(Creator.id == creator_id)
    if delta < 0:
        stmt = stmt.where(Creator.credits >= -delta)
    stmt = (
        stmt.values(credits=Creator.credits + delta)
        .returning(Creator.credits)
        .execution_options(synchronize_session=False)
    )
    row = (await db.execute(stmt)).first()
    if row is None:
        raise InsufficientCredits()
    db.add(CreditLedger(
        creator_id=creator_id, delta=delta, balance_after=row[0],
        kind=kind, job_id=job_id, ref=ref, note=(note or "")[:200] or None,
    ))
    return row[0]


async def free_watermarked_used_today(db: AsyncSession, creator_id) -> int:
    eat = timezone(timedelta(hours=3))
    start = datetime.now(eat).replace(hour=0, minute=0, second=0, microsecond=0).astimezone(timezone.utc)
    return int((await db.scalar(
        select(func.count(CreatorJob.id)).where(
            CreatorJob.creator_id == creator_id,
            CreatorJob.kind == "poster",
            CreatorJob.free.is_(True),
            CreatorJob.status != "failed",
            CreatorJob.created_at >= start,
        )
    )) or 0)


async def refund_job(db: AsyncSession, job: CreatorJob, reason: str) -> bool:
    """Idempotent. Call with the job row locked (SELECT ... FOR UPDATE)."""
    if job.cost <= 0:
        return False
    already = await db.scalar(
        select(func.count(CreditLedger.id)).where(
            CreditLedger.job_id == job.id, CreditLedger.kind == "refund"
        )
    )
    if already:
        return False
    await adjust_credits(db, job.creator_id, job.cost, "refund", job_id=job.id, note=reason)
    return True


async def approve_payment(db: AsyncSession, payment_id, admin_note: str | None) -> CreatorPayment:
    """Credit a pending payment. Used by manual admin approval now and by the
    AzamPay webhook later (after it verifies the signature)."""
    payment = (await db.execute(
        select(CreatorPayment).where(CreatorPayment.id == payment_id).with_for_update()
    )).scalar_one_or_none()
    if payment is None or payment.status != "pending":
        raise ValueError("Ombi halipo au limeshashughulikiwa.")

    creator = (await db.execute(
        select(Creator).where(Creator.id == payment.creator_id).with_for_update()
    )).scalar_one()

    approved_before = await db.scalar(
        select(func.count(CreatorPayment.id)).where(
            CreatorPayment.creator_id == creator.id, CreatorPayment.status == "approved"
        )
    )
    bonus = int(payment.credits * FIRST_PURCHASE_BONUS_PCT / 100) if not approved_before else 0
    payment.bonus_credits = bonus
    await adjust_credits(
        db, creator.id, payment.credits + bonus, "purchase",
        ref=payment.reference, note=f"Pack {payment.pack_id}" + (f" (+{bonus} bonus)" if bonus else ""),
    )

    if creator.referred_by and not creator.referral_rewarded:
        reward = max(5, payment.credits * REFERRAL_REWARD_PCT // 100)
        await adjust_credits(db, creator.referred_by, reward, "referral",
                             ref=payment.reference, note="Zawadi ya mwaliko")
        creator.referral_rewarded = True

    payment.status = "approved"
    payment.admin_note = (admin_note or "")[:200] or None
    payment.reviewed_at = datetime.now(timezone.utc)
    return payment


def eat_day_start():
    """Start of today in East Africa Time (UTC+3), as a UTC datetime."""
    eat = timezone(timedelta(hours=3))
    return datetime.now(eat).replace(hour=0, minute=0, second=0, microsecond=0).astimezone(timezone.utc)


async def pricelists_today(db: AsyncSession, creator_id) -> int:
    return int((await db.scalar(
        select(func.count(CreatorJob.id)).where(
            CreatorJob.creator_id == creator_id,
            CreatorJob.kind == "pricelist",
            CreatorJob.free.is_(True),
            CreatorJob.status != "failed",
            CreatorJob.created_at >= eat_day_start(),
        )
    )) or 0)