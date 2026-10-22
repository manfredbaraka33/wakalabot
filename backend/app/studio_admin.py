"""Superadmin API for Wakalabot Studio."""
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.sms import send_sms
from app.studio_credits import InsufficientCredits, adjust_credits, approve_payment, refund_job
from app.studio_models import (
    Creator, CreatorJob, CreatorPayment, CreatorService, CreditLedger, CreditPack,
)
from app.superadmin import get_superadmin
from app import studio_config
from app.core import settings
from app.studio_providers import ProviderError, list_image_models, test_image_model

from app.studio_credits import FIRST_PURCHASE_BONUS_PCT

CREDIT_TZS = 100


def _margin(revenue: float, cost: float):
    return round((revenue - cost) / revenue * 100) if revenue > 0 else None

router = APIRouter(prefix="/superadmin/studio", tags=["studio-admin"], dependencies=[Depends(get_superadmin)])


class CreditAdjust(BaseModel):
    delta: int = Field(..., ge=-100000, le=100000)
    note: str = Field(default="", max_length=150)


class StatusIn(BaseModel):
    status: str = Field(pattern=r"^(active|suspended)$")


class NoteIn(BaseModel):
    admin_note: Optional[str] = Field(default=None, max_length=200)



class ServiceIn(BaseModel):
    label: Optional[str] = Field(default=None, max_length=120)
    cost: Optional[int] = Field(default=None, ge=0, le=100000)
    watermark_cost: Optional[int] = Field(default=None, ge=0, le=100000)
    est_cost_tzs: Optional[int] = Field(default=None, ge=0, le=1_000_000)
    active: Optional[bool] = None


class PackIn(BaseModel):
    label: Optional[str] = Field(default=None, max_length=60)
    price_tzs: Optional[int] = Field(default=None, ge=0, le=10_000_000)
    credits: Optional[int] = Field(default=None, ge=1, le=1_000_000)
    active: Optional[bool] = None


@router.get("/overview")
async def overview(db: AsyncSession = Depends(get_db)):
    now = datetime.now(timezone.utc)
    d30, d7 = now - timedelta(days=30), now - timedelta(days=7)

    async def scalar(stmt):
        return (await db.scalar(stmt)) or 0

    jobs_by_status = (await db.execute(
        select(CreatorJob.status, func.count(CreatorJob.id)).where(CreatorJob.created_at >= d30)
        .group_by(CreatorJob.status))).all()
    jobs_by_mode = (await db.execute(
        select(CreatorJob.mode, func.count(CreatorJob.id)).where(CreatorJob.created_at >= d30)
        .group_by(CreatorJob.mode))).all()
    return {
        "creators_total": await scalar(select(func.count(Creator.id))),
        "creators_new_7d": await scalar(select(func.count(Creator.id)).where(Creator.created_at >= d7)),
        "active_7d": await scalar(select(func.count(func.distinct(CreatorJob.creator_id))).where(CreatorJob.created_at >= d7)),
        "jobs_30d_by_status": {k: v for k, v in jobs_by_status},
        "jobs_30d_by_mode": {k: v for k, v in jobs_by_mode},
        "revenue_tzs_all": int(await scalar(select(func.coalesce(func.sum(CreatorPayment.amount_tzs), 0)).where(CreatorPayment.status == "approved"))),
        "revenue_tzs_30d": int(await scalar(select(func.coalesce(func.sum(CreatorPayment.amount_tzs), 0)).where(
            CreatorPayment.status == "approved", CreatorPayment.reviewed_at >= d30))),
        "credits_spent_30d": int(await scalar(select(func.coalesce(func.sum(-CreditLedger.delta), 0)).where(
            CreditLedger.kind == "spend", CreditLedger.created_at >= d30))),
        "credits_refunded_30d": int(await scalar(select(func.coalesce(func.sum(CreditLedger.delta), 0)).where(
            CreditLedger.kind == "refund", CreditLedger.created_at >= d30))),
        "api_cost_usd_30d": float(await scalar(select(func.coalesce(func.sum(CreatorJob.api_cost_usd), 0)).where(
            CreatorJob.status == "done", CreatorJob.created_at >= d30))),
        "pending_payments": await scalar(select(func.count(CreatorPayment.id)).where(CreatorPayment.status == "pending")),
        "flagged_30d": await scalar(select(func.count(CreatorJob.id)).where(
            CreatorJob.moderation_flag.is_(True), CreatorJob.created_at >= d30)),
    }


@router.get("/creators")
async def list_creators(search: str = "", skip: int = Query(0, ge=0), limit: int = Query(30, ge=1, le=100),
                        db: AsyncSession = Depends(get_db)):
    stmt = select(Creator)
    if search.strip():
        like = f"%{search.strip().lower()}%"
        stmt = stmt.where(Creator.username.ilike(like) | Creator.phone.ilike(like))
    total = await db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    rows = (await db.execute(stmt.order_by(Creator.created_at.desc()).offset(skip).limit(limit))).scalars().all()
    return {"total": total, "items": [
        {"id": str(c.id), "username": c.username, "phone": c.phone, "brand_name": c.brand_name,
         "credits": c.credits, "status": c.status, "created_at": c.created_at.isoformat(),
         "last_login_at": c.last_login_at.isoformat() if c.last_login_at else None} for c in rows]}


@router.get("/creators/{creator_id}")
async def creator_detail(creator_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    c = await db.get(Creator, creator_id)
    if not c:
        raise HTTPException(404, "Haipatikani")
    ledger = (await db.execute(select(CreditLedger).where(CreditLedger.creator_id == c.id)
                               .order_by(CreditLedger.created_at.desc()).limit(40))).scalars().all()
    jobs = (await db.execute(select(CreatorJob).where(CreatorJob.creator_id == c.id)
                             .order_by(CreatorJob.created_at.desc()).limit(20))).scalars().all()
    return {
        "id": str(c.id), "username": c.username, "phone": c.phone, "brand_name": c.brand_name,
        "credits": c.credits, "status": c.status, "referral_code": c.referral_code,
        "tos_version": c.tos_version, "created_at": c.created_at.isoformat(),
        "ledger": [{"delta": l.delta, "balance_after": l.balance_after, "kind": l.kind, "note": l.note,
                    "created_at": l.created_at.isoformat()} for l in ledger],
        "jobs": [{"id": str(j.id), "mode": j.mode, "status": j.status, "cost": j.cost, "error": j.error,
                  "flagged": j.moderation_flag, "created_at": j.created_at.isoformat()} for j in jobs],
    }


@router.post("/creators/{creator_id}/credits")
async def adjust(creator_id: uuid.UUID, body: CreditAdjust, db: AsyncSession = Depends(get_db)):
    if body.delta == 0:
        raise HTTPException(400, "Weka kiasi tofauti na sifuri.")
    try:
        balance = await adjust_credits(db, creator_id, body.delta,
                                       "admin_grant" if body.delta > 0 else "admin_deduct", note=body.note or "Admin")
    except InsufficientCredits:
        raise HTTPException(400, "Salio halitoshi kupunguza kiasi hicho.")
    await db.commit()
    return {"balance": balance}


@router.post("/creators/{creator_id}/status")
async def set_status(creator_id: uuid.UUID, body: StatusIn, db: AsyncSession = Depends(get_db)):
    c = await db.get(Creator, creator_id)
    if not c:
        raise HTTPException(404, "Haipatikani")
    c.status = body.status
    await db.commit()
    return {"status": c.status}


@router.get("/payments")
async def list_payments(status: str = "pending", db: AsyncSession = Depends(get_db)):
    stmt = select(CreatorPayment, Creator.username, Creator.phone).join(Creator, Creator.id == CreatorPayment.creator_id)
    if status in ("pending", "approved", "rejected"):
        stmt = stmt.where(CreatorPayment.status == status)
    rows = (await db.execute(stmt.order_by(CreatorPayment.created_at.desc()).limit(100))).all()
    return [{"id": str(p.id), "username": u, "phone": ph, "pack_id": p.pack_id, "amount_tzs": p.amount_tzs,
             "credits": p.credits, "bonus_credits": p.bonus_credits, "reference": p.reference,
             "status": p.status, "admin_note": p.admin_note, "created_at": p.created_at.isoformat()}
            for p, u, ph in rows]


@router.post("/payments/{payment_id}/approve")
async def approve(payment_id: uuid.UUID, body: NoteIn, db: AsyncSession = Depends(get_db)):
    try:
        payment = await approve_payment(db, payment_id, body.admin_note)
    except ValueError as e:
        raise HTTPException(400, str(e))
    total = payment.credits + payment.bonus_credits
    creator = await db.get(Creator, payment.creator_id)
    await db.commit()
    if creator:
        await send_sms(creator.phone, f"Wakalabot Studio: credits {total} zimeongezwa. Karibu ubuni matangazo!")
    return {"status": "approved", "credited": total}


@router.post("/payments/{payment_id}/reject")
async def reject(payment_id: uuid.UUID, body: NoteIn, db: AsyncSession = Depends(get_db)):
    p = (await db.execute(select(CreatorPayment).where(CreatorPayment.id == payment_id).with_for_update())).scalar_one_or_none()
    if not p or p.status != "pending":
        raise HTTPException(400, "Ombi halipo au limeshashughulikiwa.")
    p.status, p.admin_note, p.reviewed_at = "rejected", (body.admin_note or "")[:200] or None, datetime.now(timezone.utc)
    await db.commit()
    return {"status": "rejected"}


@router.get("/services")
async def list_services(db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(select(CreatorService).order_by(CreatorService.sort))).scalars().all()
    packs = (await db.execute(select(CreditPack).where(CreditPack.active.is_(True)))).scalars().all()
    floor = min((p.price_tzs / p.credits for p in packs), default=CREDIT_TZS)   # best-deal pack
    worst = floor / (1 + FIRST_PURCHASE_BONUS_PCT / 100)                         # ...bought as a first purchase
    return [{
        "key": s.key, "label": s.label, "cost": s.cost, "watermark_cost": s.watermark_cost,
        "est_cost_tzs": s.est_cost_tzs, "active": s.active,
        "margin_pct": _margin(s.cost * CREDIT_TZS, s.est_cost_tzs),
        "margin_pct_floor": _margin(s.cost * floor, s.est_cost_tzs),
        "margin_pct_worst": _margin(s.cost * worst, s.est_cost_tzs),
    } for s in rows]



@router.put("/services/{key}")
async def update_service(key: str, body: ServiceIn, db: AsyncSession = Depends(get_db)):
    s = await db.get(CreatorService, key)
    if not s:
        raise HTTPException(404, "Haipatikani")
    data = body.model_dump(exclude_unset=True)
    for field, value in data.items():
        setattr(s, field, value)
    await db.commit()
    return {"ok": True}


@router.get("/packs")
async def list_packs(db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(select(CreditPack).order_by(CreditPack.sort))).scalars().all()
    return [{"id": p.id, "label": p.label, "price_tzs": p.price_tzs, "credits": p.credits, "active": p.active} for p in rows]


@router.put("/packs/{pack_id}")
async def update_pack(pack_id: str, body: PackIn, db: AsyncSession = Depends(get_db)):
    p = await db.get(CreditPack, pack_id)
    if not p:
        raise HTTPException(404, "Haipatikani")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(p, field, value)
    await db.commit()
    return {"ok": True}


@router.get("/jobs")
async def list_jobs(status: str = "", flagged: bool = False, db: AsyncSession = Depends(get_db)):
    stmt = select(CreatorJob, Creator.username).join(Creator, Creator.id == CreatorJob.creator_id)
    if status:
        stmt = stmt.where(CreatorJob.status == status)
    if flagged:
        stmt = stmt.where(CreatorJob.moderation_flag.is_(True))
    rows = (await db.execute(stmt.order_by(CreatorJob.created_at.desc()).limit(100))).all()
    return [{"id": str(j.id), "username": u, "mode": j.mode, "status": j.status, "cost": j.cost,
             "error": j.error, "flagged": j.moderation_flag, "prompt": (j.params or {}).get("prompt", "")[:200],
             "created_at": j.created_at.isoformat()} for j, u in rows]


@router.post("/jobs/{job_id}/refund")
async def refund(job_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    job = (await db.execute(select(CreatorJob).where(CreatorJob.id == job_id).with_for_update())).scalar_one_or_none()
    if not job:
        raise HTTPException(404, "Haipatikani")
    done = await refund_job(db, job, "Refund na admin")
    await db.commit()
    return {"refunded": done}


class ModelPick(BaseModel):
    model: str = Field(min_length=3, max_length=120)
    cost_usd: Optional[float] = Field(default=None, ge=0, le=5)


@router.get("/ai/status")
async def ai_status():
    saved = studio_config.get("image_model")
    return {
        "model": studio_config.image_model(),
        "cost_usd": studio_config.image_cost_usd(),
        "text_model": settings.STUDIO_TEXT_MODEL,
        "source": "admin" if saved else ("env" if settings.STUDIO_IMAGE_MODEL else "none"),
    }


@router.get("/ai/models")
async def ai_models():
    try:
        return {"models": await list_image_models()}
    except ProviderError as e:
        raise HTTPException(502, f"{e} ({e.detail})" if e.detail else str(e))


@router.post("/ai/test")
async def ai_test(body: ModelPick):
    """Costs one real image (about $0.03). Returns a preview so you can see it works."""
    try:
        return await test_image_model(body.model)
    except ProviderError as e:
        return {"ok": False, "error": str(e), "detail": e.detail}


@router.post("/ai/select")
async def ai_select(body: ModelPick):
    values = {"image_model": body.model}
    if body.cost_usd is not None:
        values["image_cost_usd"] = body.cost_usd
    studio_config.set_many(**values)
    return {"ok": True}