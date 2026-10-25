"""Wakalabot Studio: creator accounts, credits, and poster generation."""
import asyncio
import hashlib
import hmac
import io
import json
import logging
import re
import secrets
import shutil
import uuid
from datetime import datetime, timedelta, timezone
from typing import Literal, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Request, UploadFile
from fastapi.responses import FileResponse,Response
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from pydantic import BaseModel, Field
from PIL import Image, ImageOps
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import hash_password, verify_password
from app.core import settings
from app.db import get_db
from app.limiter import limiter
from app.sms import send_sms
from app.studio_credits import (
    ACTIVATION_REWARD, ACTIVATION_REWARD_CAP, InsufficientCredits, adjust_credits,
    free_watermarked_used_today, pricelists_today,
)
from app.studio_models import (
    Creator, CreatorJob, CreatorOtp, CreatorPayment, CreatorService, CreditLedger, CreditPack,
)
from app.studio_pricelist import PL_TEMPLATE_IDS, PL_TEMPLATE_LIST, preview_jpeg as pl_preview_jpeg
from app.studio_templates import PALETTE_IDS, PALETTE_LIST, TEMPLATE_IDS, TEMPLATE_LIST, preview_jpeg
from app.studio_worker import IN_DIR, STORAGE

logger = logging.getLogger("studio")
router = APIRouter(prefix="/studio", tags=["studio"])
Image.MAX_IMAGE_PIXELS = 40_000_000

TOS_VERSION = "2026-10"
AI_POSTERS_ENABLED = False   # AI-scene posters (Andika/Sema) are switched off. Templates only.
RESERVED = {"admin", "wakalabot", "support", "studio", "root", "wakala"}
ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"

MODE_SERVICE = {"template": "poster_template", "pricelist": "pricelist", "text": "poster_ai", "voice": "poster_ai_voice"}
_oauth2 = OAuth2PasswordBearer(tokenUrl="/api/v1/studio/auth/login")


def _now():
    return datetime.now(timezone.utc)


# ── Helpers ───────────────────────────────────────────────────────────────────

def normalize_phone(raw: str) -> str:
    d = re.sub(r"\D", "", raw or "")
    if d.startswith("0"):
        d = "255" + d[1:]
    elif len(d) == 9:
        d = "255" + d
    if not re.fullmatch(r"255[67]\d{8}", d):
        raise HTTPException(400, "Namba ya simu si sahihi. Mfano: 0712 345 678")
    return d


def _hash_code(phone: str, code: str) -> str:
    return hashlib.sha256(f"{settings.JWT_SECRET_KEY}:{phone}:{code}".encode()).hexdigest()


def _token(claims: dict, minutes: int) -> str:
    return jwt.encode({**claims, "exp": _now() + timedelta(minutes=minutes)},
                      settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def _decode(token: str, purpose: str) -> dict:
    try:
        payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
    except JWTError:
        raise HTTPException(400, "Kipindi kimeisha. Anza upya.")
    if payload.get("purpose") != purpose:
        raise HTTPException(400, "Kipindi si sahihi. Anza upya.")
    return payload


async def get_current_creator(token: str = Depends(_oauth2), db: AsyncSession = Depends(get_db)) -> Creator:
    exc = HTTPException(401, "Tafadhali ingia tena.", headers={"WWW-Authenticate": "Bearer"})
    try:
        payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
        if payload.get("role") != "creator":
            raise exc
        creator = await db.get(Creator, uuid.UUID(payload["sub"]))
    except (JWTError, KeyError, ValueError):
        raise exc
    if creator is None:
        raise exc
    if creator.status != "active":
        raise HTTPException(403, "Akaunti imesimamishwa. Wasiliana na support.")
    return creator


def _creator_out(c: Creator, free_used: int = 0) -> dict:
    return {
        "id": str(c.id), "username": c.username, "phone": c.phone,
        "brand_name": c.brand_name or "", "contact_phone": c.contact_phone or "",
        "default_style": c.default_style, "credits": c.credits, "referral_code": c.referral_code,
        "free_left_today": max(0, settings.STUDIO_FREE_DAILY_WATERMARKED - free_used),
    }


def _access_token(c: Creator) -> str:
    return _token({"sub": str(c.id), "role": "creator"}, 60 * 24 * 14)


# ── Auth ──────────────────────────────────────────────────────────────────────

class OtpRequest(BaseModel):
    phone: str
    purpose: Literal["signup", "reset"] = "signup"


class OtpVerify(BaseModel):
    phone: str
    code: str = Field(min_length=6, max_length=6)
    purpose: Literal["signup", "reset"] = "signup"


class SignupIn(BaseModel):
    token: str
    username: str = Field(pattern=r"^[a-zA-Z0-9_]{3,20}$")
    password: str = Field(min_length=8, max_length=100)
    brand_name: str = Field(default="", max_length=40)
    ref: str = Field(default="", max_length=12)
    accept_terms: bool


class LoginIn(BaseModel):
    identifier: str = Field(min_length=3, max_length=40)
    password: str = Field(min_length=1, max_length=100)


class ResetIn(BaseModel):
    token: str
    new_password: str = Field(min_length=8, max_length=100)


@router.post("/auth/request-otp")
@limiter.limit("5/minute")
async def request_otp(request: Request, body: OtpRequest, db: AsyncSession = Depends(get_db)):
    phone = normalize_phone(body.phone)
    exists = await db.scalar(select(Creator.id).where(Creator.phone == phone))
    if body.purpose == "signup" and exists:
        raise HTTPException(409, "Namba hii tayari ina akaunti. Tafadhali ingia.")
    if body.purpose == "reset" and not exists:
        return {"status": "sent"}  # never reveal which numbers are registered

    recent = await db.scalar(select(func.count(CreatorOtp.id)).where(
        CreatorOtp.phone == phone, CreatorOtp.created_at >= _now() - timedelta(hours=1)))
    if (recent or 0) >= 3:
        raise HTTPException(429, "Umeomba nambari mara nyingi. Jaribu tena baada ya saa moja.")

    code = f"{secrets.randbelow(900000) + 100000}"
    db.add(CreatorOtp(phone=phone, purpose=body.purpose, code_hash=_hash_code(phone, code),
                      expires_at=_now() + timedelta(minutes=10)))
    await db.commit()

    sent = await send_sms(
        phone, f"Wakalabot Studio: nambari yako ya uthibitisho ni {code}. "
               "Inaisha baada ya dakika 10. Usimpe mtu yeyote.")
    if not sent:
        if getattr(settings, "ENV", "production") == "production":
            raise HTTPException(503, "Imeshindwa kutuma SMS. Jaribu tena.")
        logger.warning("DEV OTP for %s: %s", phone, code)
    return {"status": "sent"}


@router.post("/auth/verify-otp")
@limiter.limit("10/minute")
async def verify_otp(request: Request, body: OtpVerify, db: AsyncSession = Depends(get_db)):
    phone = normalize_phone(body.phone)
    row = (await db.execute(
        select(CreatorOtp).where(
            CreatorOtp.phone == phone, CreatorOtp.purpose == body.purpose,
            CreatorOtp.used.is_(False), CreatorOtp.expires_at > _now(),
        ).order_by(CreatorOtp.created_at.desc()).limit(1)
    )).scalar_one_or_none()
    if row is None:
        raise HTTPException(400, "Nambari imeisha muda. Omba mpya.")
    if row.attempts >= 5:
        raise HTTPException(400, "Umekosea mara nyingi. Omba nambari mpya.")

    row.attempts += 1
    if not hmac.compare_digest(row.code_hash, _hash_code(phone, body.code)):
        await db.commit()
        raise HTTPException(400, "Nambari si sahihi.")
    row.used = True
    await db.commit()
    return {"token": _token({"phone": phone, "purpose": f"creator_{body.purpose}"}, 15)}


@router.post("/auth/complete-signup")
@limiter.limit("10/minute")
async def complete_signup(request: Request, body: SignupIn, db: AsyncSession = Depends(get_db)):
    if not body.accept_terms:
        raise HTTPException(400, "Lazima ukubali Masharti na Faragha.")
    phone = _decode(body.token, "creator_signup")["phone"]
    username = body.username.lower()
    if username.isdigit() or username in RESERVED:
        raise HTTPException(400, "Username hii haikubaliki. Chagua nyingine.")

    referrer_id = None
    if body.ref.strip():
        referrer_id = await db.scalar(select(Creator.id).where(Creator.referral_code == body.ref.strip().upper()))

    code = "".join(secrets.choice(ALPHABET) for _ in range(8))
    creator = Creator(
        username=username, phone=phone, password_hash=hash_password(body.password),
        brand_name=body.brand_name.strip() or None, referral_code=code,
        referred_by=referrer_id, tos_version=TOS_VERSION,
    )
    db.add(creator)
    try:
        await db.flush()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(409, "Username au namba hii tayari inatumika.")

    if settings.STUDIO_SIGNUP_BONUS > 0:
        await adjust_credits(db, creator.id, settings.STUDIO_SIGNUP_BONUS, "signup_bonus", note="Zawadi ya kujisajili")
    await db.commit()
    await db.refresh(creator)
    return {"token": _access_token(creator), "creator": _creator_out(creator)}


_dummy_hash: str | None = None


@router.post("/auth/login")
@limiter.limit("5/minute")
async def login(request: Request, body: LoginIn, db: AsyncSession = Depends(get_db)):
    global _dummy_hash
    ident = body.identifier.strip().lower()
    creator = await db.scalar(select(Creator).where(Creator.username == ident))
    if creator is None:
        try:
            creator = await db.scalar(select(Creator).where(Creator.phone == normalize_phone(ident)))
        except HTTPException:
            creator = None

    if creator and creator.locked_until and creator.locked_until > _now():
        raise HTTPException(429, "Akaunti imefungwa kwa muda. Jaribu tena baada ya dakika 15.")

    if creator is None:  # equalise timing so usernames can't be probed
        _dummy_hash = _dummy_hash or hash_password("not-a-real-password")
        verify_password(body.password, _dummy_hash)
        raise HTTPException(401, "Username/namba au neno la siri si sahihi.")

    if not verify_password(body.password, creator.password_hash):
        creator.failed_logins += 1
        if creator.failed_logins >= 8:
            creator.locked_until, creator.failed_logins = _now() + timedelta(minutes=15), 0
        await db.commit()
        raise HTTPException(401, "Username/namba au neno la siri si sahihi.")

    if creator.status != "active":
        raise HTTPException(403, "Akaunti imesimamishwa. Wasiliana na support.")
    creator.failed_logins, creator.locked_until, creator.last_login_at = 0, None, _now()
    await db.commit()
    used = await free_watermarked_used_today(db, creator.id)
    return {"token": _access_token(creator), "creator": _creator_out(creator, used)}


@router.post("/auth/reset-password")
@limiter.limit("5/minute")
async def reset_password(request: Request, body: ResetIn, db: AsyncSession = Depends(get_db)):
    phone = _decode(body.token, "creator_reset")["phone"]
    creator = await db.scalar(select(Creator).where(Creator.phone == phone))
    if creator is None:
        raise HTTPException(400, "Akaunti haipatikani.")
    creator.password_hash = hash_password(body.new_password)
    creator.failed_logins, creator.locked_until = 0, None
    await db.commit()
    return {"status": "updated"}


# ── Account ───────────────────────────────────────────────────────────────────

class ProfileIn(BaseModel):
    brand_name: Optional[str] = Field(default=None, max_length=40)
    contact_phone: Optional[str] = Field(default=None, max_length=20)
    default_style: Optional[str] = Field(default=None, max_length=12)


@router.get("/me")
async def me(creator: Creator = Depends(get_current_creator), db: AsyncSession = Depends(get_db)):
    return _creator_out(creator, await free_watermarked_used_today(db, creator.id))


@router.patch("/me")
async def update_me(body: ProfileIn, creator: Creator = Depends(get_current_creator), db: AsyncSession = Depends(get_db)):
    if body.brand_name is not None:
        creator.brand_name = body.brand_name.strip() or None
    if body.contact_phone is not None:
        creator.contact_phone = body.contact_phone.strip() or None
    if body.default_style in PALETTE_IDS:
        creator.default_style = body.default_style
    await db.commit()
    return _creator_out(creator, await free_watermarked_used_today(db, creator.id))


# ── Catalog & packs ───────────────────────────────────────────────────────────

@router.get("/catalog")
async def catalog(creator: Creator = Depends(get_current_creator), db: AsyncSession = Depends(get_db)):
    services = (await db.execute(
        select(CreatorService).where(CreatorService.active.is_(True)).order_by(CreatorService.sort))).scalars().all()
    used = await free_watermarked_used_today(db, creator.id)
    return {
        "services": [{"key": s.key, "label": s.label, "cost": s.cost, "watermark_cost": s.watermark_cost} for s in services],
        "templates": TEMPLATE_LIST, "palettes": PALETTE_LIST, "pricelist_templates": PL_TEMPLATE_LIST,
        "free_daily": settings.STUDIO_FREE_DAILY_WATERMARKED,
        "free_left_today": max(0, settings.STUDIO_FREE_DAILY_WATERMARKED - used),
        "pricelist_watermark": settings.STUDIO_PRICELIST_WATERMARK,
        "pricelist_free_left": max(0, settings.STUDIO_FREE_PRICELIST_DAILY - await pricelists_today(db, creator.id)),
        "credits": creator.credits,
    }


@router.get("/packs")
async def packs(db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(
        select(CreditPack).where(CreditPack.active.is_(True)).order_by(CreditPack.sort))).scalars().all()
    return {
        "packs": [{"id": p.id, "label": p.label, "price_tzs": p.price_tzs, "credits": p.credits} for p in rows],
        "pay_to": {"number": settings.STUDIO_PAY_NUMBER, "name": settings.STUDIO_PAY_NAME},
        "first_purchase_bonus_pct": 20,
    }


# ── Jobs ──────────────────────────────────────────────────────────────────────

def _media_token(job_id) -> str:
    return _token({"jid": str(job_id), "purpose": "media"}, 60)


def _job_out(j: CreatorJob) -> dict:
    url = None
    if j.status == "done" and j.result_path and not j.files_deleted:
        url = f"/api/v1/studio/media/{j.id}?t={_media_token(j.id)}"
    meta = j.result_meta or {}
    return {
        "id": str(j.id), "kind": j.kind, "mode": j.mode, "status": j.status, "cost": j.cost,
        "free": j.free, "watermark": j.watermark, "error": j.error,
        "created_at": j.created_at.isoformat() if j.created_at else None,
        "media_url": url, "headline": meta.get("headline"), "transcript": meta.get("transcript"),
        "template": meta.get("template"), "palette": meta.get("palette"),
        "bg_removed": meta.get("bg_removed"), "bg_requested": bool((j.params or {}).get("remove_bg")),
        "fmt": (j.params or {}).get("fmt"),
    }


def _normalize_photo(data: bytes) -> bytes:
    """Re-encode: validates it's a real image and strips EXIF/GPS metadata."""
    img = ImageOps.exif_transpose(Image.open(io.BytesIO(data)))
    rgba = img.convert("RGBA")
    base = Image.new("RGB", rgba.size, (255, 255, 255))
    base.paste(rgba, mask=rgba.split()[3])
    base.thumbnail((2000, 2000))
    out = io.BytesIO()
    base.save(out, "JPEG", quality=90)
    return out.getvalue()

@router.post("/jobs")
@limiter.limit("20/minute")
async def create_job(
    request: Request,
    mode: Literal["template", "pricelist", "text", "voice"] = Form(...),
    fmt: Literal["square", "portrait", "a4", "story"] = Form("square"),
    template: str = Form("random"),
    palette: str = Form("auto"),
    watermark: bool = Form(False),
    product_name: str = Form("", max_length=60),
    price: str = Form("", max_length=20),
    business_name: str = Form("", max_length=40),
    phone: str = Form("", max_length=20),
    headline: str = Form("", max_length=60),
    offer: str = Form("", max_length=22),
    prompt: str = Form("", max_length=600),
    item_type: Literal["product", "service"] = Form("product"),
    remove_bg: bool = Form(False),
    title: str = Form("", max_length=30),
    tagline: str = Form("", max_length=50),
    items_json: str = Form("", max_length=6000),
    photo: Optional[UploadFile] = File(None),
    audio: Optional[UploadFile] = File(None),
    creator: Creator = Depends(get_current_creator),
    db: AsyncSession = Depends(get_db),
):
    if mode in ("text", "voice") and not AI_POSTERS_ENABLED:
        raise HTTPException(400, "Njia hii haipatikani kwa sasa. Tumia Template.")

    biz = business_name.strip() or creator.brand_name or ""
    if not biz:
        raise HTTPException(400, "Weka jina la biashara kwenye Akaunti yako au kwenye fomu.")
    contact = phone.strip() or creator.contact_phone or ""
    valid_templates = PL_TEMPLATE_IDS if mode == "pricelist" else TEMPLATE_IDS
    if template not in valid_templates and template != "random":
        raise HTTPException(400, "Muundo haujulikani.")
    if palette not in PALETTE_IDS and palette not in ("random", "auto"):
        raise HTTPException(400, "Rangi haijulikani.")

    # Price list items (max 12)
    items: list[dict] = []
    if mode == "pricelist":
        try:
            raw_items = json.loads(items_json or "[]")
            if not isinstance(raw_items, list):
                raise ValueError
        except ValueError:
            raise HTTPException(400, "Orodha ya bidhaa si sahihi.")
        for it in raw_items[:12]:
            if isinstance(it, dict):
                name, pr = str(it.get("name", "")).strip()[:50], str(it.get("price", "")).strip()[:20]
                if name and pr:
                    items.append({"name": name, "price": pr})
        if not items:
            raise HTTPException(400, "Weka angalau bidhaa moja yenye bei.")

    # Photo: the product photo for posters, an optional logo for price lists
    photo_bytes = audio_bytes = None
    if photo and photo.filename:
        raw = await photo.read()
        if len(raw) > 8 * 1024 * 1024:
            raise HTTPException(413, "Picha ni kubwa mno. Tumia chini ya 8MB.")
        try:
            photo_bytes = await asyncio.to_thread(_normalize_photo, raw)
        except Exception:
            raise HTTPException(400, "Picha haisomeki. Jaribu nyingine.")
    if mode == "template" and (not photo_bytes or not product_name.strip() or not price.strip()):
        raise HTTPException(400, "Template inahitaji picha, jina la bidhaa na bei.")
    if mode == "text" and len(prompt.strip()) < 8:
        raise HTTPException(400, "Elezea tangazo unalotaka (angalau maneno machache).")
    if mode == "voice":
        if not audio or not audio.filename:
            raise HTTPException(400, "Rekodi sauti kwanza.")
        if not ((audio.content_type or "").startswith("audio/") or audio.content_type == "video/webm"):
            raise HTTPException(400, "Aina ya sauti haikubaliki.")
        audio_bytes = await audio.read()
        if len(audio_bytes) > 5 * 1024 * 1024 or len(audio_bytes) < 2000:
            raise HTTPException(400, "Sauti ni fupi mno au ndefu mno (kiwango: sekunde 60).")

    active = await db.scalar(select(func.count(CreatorJob.id)).where(
        CreatorJob.creator_id == creator.id, CreatorJob.status.in_(("queued", "running"))))
    if (active or 0) >= 3:
        raise HTTPException(429, "Una kazi 3 zinazoendelea. Subiri zikamilike.")

    # Pricing. Free = watermarked. Clean (no watermark) costs credits. One rule for posters and price lists.
    svc = await db.get(CreatorService, MODE_SERVICE[mode])
    if svc is None and mode == "pricelist":          # migration not applied yet: use the default
        svc = CreatorService(key="pricelist", label="Orodha ya Bei", cost=1, watermark_cost=0,
                             est_cost_tzs=20, active=True, sort=0)
    if not svc or not svc.active:
        raise HTTPException(503, "Huduma hii haipatikani kwa sasa.")

    free = False
    if mode == "pricelist":
        if not settings.STUDIO_PRICELIST_WATERMARK:
            watermark, cost = False, 0                # policy off: price lists free and clean
        elif watermark and svc.watermark_cost is not None:
            cost = svc.watermark_cost
            free = cost == 0
            cap = settings.STUDIO_FREE_PRICELIST_DAILY
            if free and await pricelists_today(db, creator.id) >= cap:
                raise HTTPException(402, f"Umefikia kikomo cha orodha {cap} za bure leo. Ondoa alama kwa credits au jaribu kesho.")
        else:
            watermark, cost = False, svc.cost
    else:
        daily_free = settings.STUDIO_FREE_DAILY_WATERMARKED
        if watermark and svc.watermark_cost is not None and daily_free > 0:
            cost = svc.watermark_cost
            free = cost == 0
            if free and await free_watermarked_used_today(db, creator.id) >= daily_free:
                raise HTTPException(402, "Umemaliza matangazo ya bure ya leo. Ondoa alama kwa credits au jaribu kesho.")
        else:
            watermark, cost = False, svc.cost

    bg_cost = 0
    if remove_bg and mode == "template":
        bg_svc = await db.get(CreatorService, "bg_remove")
        if not settings.STUDIO_BG_REMOVE_ENABLED or not bg_svc or not bg_svc.active:
            raise HTTPException(503, "Huduma ya kuondoa mandhari haipatikani kwa sasa.")
        bg_cost = bg_svc.cost
        cost += bg_cost
        free = free and bg_cost == 0              # a job stays "free" only if the add-on is free too
    else:
        remove_bg = False

    job_id = uuid.uuid4()
    in_dir = IN_DIR / str(job_id)
    in_dir.mkdir(parents=True, exist_ok=True)
    try:
        if photo_bytes:
            (in_dir / "photo.jpg").write_bytes(photo_bytes)
        if audio_bytes:
            (in_dir / "audio.bin").write_bytes(audio_bytes)

        params = {
            "fmt": fmt, "template": template, "palette": palette, "item_type": item_type,
            "remove_bg": remove_bg, "bg_cost": bg_cost,
            "product_name": product_name.strip(), "price": price.strip(), "business_name": biz,
            "phone": contact, "headline": headline.strip(), "offer": offer.strip(), "prompt": prompt.strip(),
        }
        if mode == "pricelist":
            params.update({"items": items, "title": title.strip(), "tagline": tagline.strip()})

        job = CreatorJob(
            id=job_id, creator_id=creator.id, kind="pricelist" if mode == "pricelist" else "poster",
            mode=mode, cost=cost, free=free, watermark=watermark, params=params,
        )
        db.add(job)
        await db.flush()
        if cost > 0:
            await adjust_credits(db, creator.id, -cost, "spend", job_id=job_id, note=svc.label if svc else "Studio")
        await db.commit()
        await db.refresh(job)
    except InsufficientCredits:
        await db.rollback()
        shutil.rmtree(in_dir, ignore_errors=True)
        raise HTTPException(402, f"Credits hazitoshi. Unahitaji {cost}, una {creator.credits}. Nunua credits kuendelea.")
    except Exception:
        await db.rollback()
        shutil.rmtree(in_dir, ignore_errors=True)
        raise
    return _job_out(job)

@router.get("/jobs")
async def list_jobs(creator: Creator = Depends(get_current_creator), db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(
        select(CreatorJob).where(CreatorJob.creator_id == creator.id)
        .order_by(CreatorJob.created_at.desc()).limit(50))).scalars().all()
    return [_job_out(j) for j in rows]


@router.get("/jobs/{job_id}")
async def get_job(job_id: uuid.UUID, creator: Creator = Depends(get_current_creator), db: AsyncSession = Depends(get_db)):
    job = await db.get(CreatorJob, job_id)
    if not job or job.creator_id != creator.id:
        raise HTTPException(404, "Kazi haipatikani.")
    return _job_out(job)


@router.delete("/jobs/{job_id}")
async def delete_job(job_id: uuid.UUID, creator: Creator = Depends(get_current_creator), db: AsyncSession = Depends(get_db)):
    job = await db.get(CreatorJob, job_id)
    if not job or job.creator_id != creator.id:
        raise HTTPException(404, "Kazi haipatikani.")
    if job.status in ("queued", "running"):
        raise HTTPException(400, "Subiri kazi ikamilike kwanza.")
    if job.result_path:
        (STORAGE / job.result_path).unlink(missing_ok=True)
    await db.delete(job)
    await db.commit()
    return {"deleted": True}


@router.get("/media/{job_id}")
async def media(job_id: uuid.UUID, t: str = Query(...), download: int = 0, db: AsyncSession = Depends(get_db)):
    payload = _decode(t, "media")
    if payload.get("jid") != str(job_id):
        raise HTTPException(403, "Kiungo si sahihi.")
    job = await db.get(CreatorJob, job_id)
    if not job or not job.result_path or job.files_deleted:
        raise HTTPException(404, "Faili haipo (huenda imefutwa).")
    path = (STORAGE / job.result_path).resolve()
    if STORAGE.resolve() not in path.parents or not path.exists():
        raise HTTPException(404, "Faili haipo.")
    return FileResponse(
                path, media_type="image/jpeg", headers={"Cache-Control": "private, max-age=3600", "Vary": "Origin"},

        filename=f"wakalabot-{str(job_id)[:8]}.jpg" if download else None,
        content_disposition_type="attachment" if download else "inline",
    )


# ── Wallet & payments ─────────────────────────────────────────────────────────

class PaymentIn(BaseModel):
    pack_id: str = Field(max_length=20)
    reference: str = Field(min_length=6, max_length=20)


@router.get("/wallet")
async def wallet(creator: Creator = Depends(get_current_creator), db: AsyncSession = Depends(get_db)):
    ledger = (await db.execute(select(CreditLedger).where(CreditLedger.creator_id == creator.id)
                               .order_by(CreditLedger.created_at.desc()).limit(50))).scalars().all()
    pays = (await db.execute(select(CreatorPayment).where(CreatorPayment.creator_id == creator.id)
                             .order_by(CreatorPayment.created_at.desc()).limit(20))).scalars().all()
    return {
        "credits": creator.credits,
        "ledger": [{"delta": l.delta, "balance_after": l.balance_after, "kind": l.kind, "note": l.note,
                    "created_at": l.created_at.isoformat()} for l in ledger],
        "payments": [{"id": str(p.id), "pack_id": p.pack_id, "amount_tzs": p.amount_tzs, "credits": p.credits,
                      "bonus_credits": p.bonus_credits, "reference": p.reference, "status": p.status,
                      "admin_note": p.admin_note, "created_at": p.created_at.isoformat()} for p in pays],
    }



def _mask_name(u: str) -> str:
    u = u or ""
    if len(u) <= 3:
        return u[:1] + "***"
    return u[:2] + "*" * min(6, len(u) - 3) + u[-1]


@router.get("/referrals")
async def my_referrals(creator: Creator = Depends(get_current_creator), db: AsyncSession = Depends(get_db)):
    friends = (await db.execute(
        select(Creator).where(Creator.referred_by == creator.id)
        .order_by(Creator.created_at.desc()).limit(200))).scalars().all()
    ids = [f.id for f in friends]

    ledger = (await db.execute(
        select(CreditLedger).where(CreditLedger.creator_id == creator.id, CreditLedger.kind == "referral")
    )).scalars().all()
    act: dict[str, int] = {}      # reward for a friend's first job, keyed by friend id
    by_ref: dict[str, int] = {}   # reward for a friend's first purchase, keyed by payment reference
    for l in ledger:
        if l.ref and l.ref.startswith("act:"):
            act[l.ref[4:]] = act.get(l.ref[4:], 0) + l.delta
        elif l.ref:
            by_ref[l.ref] = by_ref.get(l.ref, 0) + l.delta

    made_ids: set = set()
    pay_refs: dict = {}
    if ids:
        made_ids = set((await db.execute(
            select(CreatorJob.creator_id).where(CreatorJob.creator_id.in_(ids), CreatorJob.status == "done").distinct()
        )).scalars().all())
        for cid, ref in (await db.execute(
            select(CreatorPayment.creator_id, CreatorPayment.reference)
            .where(CreatorPayment.creator_id.in_(ids), CreatorPayment.status == "approved")
        )).all():
            pay_refs.setdefault(cid, []).append(ref)

    out = []
    for f in friends:
        earned = act.get(str(f.id), 0) + sum(by_ref.get(r, 0) for r in pay_refs.get(f.id, []))
        out.append({
            "name": _mask_name(f.username),
            "joined": f.created_at.isoformat() if f.created_at else None,
            "made": f.id in made_ids,
            "bought": f.id in pay_refs,
            "earned": earned,
        })
    rewarded = len(act)
    return {
        "code": creator.referral_code,
        "reward_per_friend": ACTIVATION_REWARD,
        "cap": ACTIVATION_REWARD_CAP,
        "invited": len(friends),
        "active": sum(1 for x in out if x["made"]),
        "rewarded": rewarded,
        "slots_left": max(0, ACTIVATION_REWARD_CAP - rewarded),
        "earned": sum(l.delta for l in ledger),
        "friends": out,
    }


@router.post("/payments")
@limiter.limit("6/minute")
async def submit_payment(request: Request, body: PaymentIn, creator: Creator = Depends(get_current_creator),
                         db: AsyncSession = Depends(get_db)):
    pack = await db.get(CreditPack, body.pack_id)
    if not pack or not pack.active:
        raise HTTPException(400, "Pack haipatikani.")
    ref = body.reference.strip().upper()
    if not re.fullmatch(r"[A-Z0-9]{6,20}", ref):
        raise HTTPException(400, "Reference ya muamala si sahihi (herufi na namba tu).")
    pending = await db.scalar(select(func.count(CreatorPayment.id)).where(
        CreatorPayment.creator_id == creator.id, CreatorPayment.status == "pending"))
    if (pending or 0) >= 3:
        raise HTTPException(400, "Una maombi 3 yanayosubiri uthibitisho. Subiri yashughulikiwe.")

    db.add(CreatorPayment(creator_id=creator.id, pack_id=pack.id, amount_tzs=pack.price_tzs,
                          credits=pack.credits, reference=ref))
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(409, "Reference hii imeshatumika.")

    if settings.STUDIO_ADMIN_PHONE:
        await send_sms(settings.STUDIO_ADMIN_PHONE,
                       f"Studio: malipo mapya TZS {pack.price_tzs:,} (@{creator.username}) ref {ref}. Thibitisha.")
    return {"status": "pending", "message": "Ombi limetumwa. Credits zitaongezwa ndani ya dakika chache."}


@router.get("/template-preview")
@limiter.limit("600/minute")
async def template_preview(request: Request, template: str, palette: str,
                           fmt: Literal["square", "portrait", "a4", "story"] = "square"):
    if template not in TEMPLATE_IDS or palette not in PALETTE_IDS:
        raise HTTPException(404, "Haipatikani.")
    jpg = await asyncio.to_thread(preview_jpeg, template, palette, fmt)
    return Response(content=jpg, media_type="image/jpeg", headers={"Cache-Control": "public, max-age=86400"})


@router.get("/pricelist-preview")
@limiter.limit("600/minute")
async def pricelist_preview(request: Request, template: str, palette: str,
                            fmt: Literal["square", "portrait", "a4", "story"] = "square"):
    if template not in PL_TEMPLATE_IDS or palette not in PALETTE_IDS:
        raise HTTPException(404, "Haipatikani.")
    jpg = await asyncio.to_thread(pl_preview_jpeg, template, palette, fmt)
    return Response(content=jpg, media_type="image/jpeg", headers={"Cache-Control": "public, max-age=86400"})