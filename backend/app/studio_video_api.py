"""Studio Video API: catalog and job creation. Polling, media and the library reuse the existing endpoints."""
import asyncio
import shutil
import uuid
from typing import Literal, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app import studio_video as sv
from app.core import settings
from app.studio import _job_out, _normalize_photo, get_current_creator, get_db, limiter
from app.studio_credits import InsufficientCredits, adjust_credits, eat_day_start
from app.studio_models import Creator, CreatorJob, CreatorPayment, CreatorService
from app.studio_providers import ProviderError
from app.studio_templates import PALETTE_IDS, TEMPLATE_IDS

router = APIRouter(prefix="/studio/video", tags=["studio-video"])
KEYS = ("video_motion", "video_extra", "video_persona", "video_voiceover")
MAX_WORDS = 22


async def _services(db: AsyncSession) -> dict:
    rows = (await db.execute(select(CreatorService).where(CreatorService.key.in_(KEYS)))).scalars().all()
    return {r.key: r for r in rows}


def _on(svc: dict, key: str) -> bool:
    return key in svc and bool(svc[key].active)


async def _state(db: AsyncSession, creator: Creator):
    if settings.STUDIO_VIDEO_REQUIRE_PURCHASE:
        paid = await db.scalar(select(func.count(CreatorPayment.id)).where(
            CreatorPayment.creator_id == creator.id, CreatorPayment.status == "approved"))
        unlocked = bool(paid)
    else:
        unlocked = True
    start = eat_day_start()
    base = (CreatorJob.kind == "video", CreatorJob.status != "failed", CreatorJob.created_at >= start)
    mine = await db.scalar(select(func.count(CreatorJob.id)).where(*base, CreatorJob.creator_id == creator.id)) or 0
    everyone = await db.scalar(select(func.count(CreatorJob.id)).where(*base)) or 0
    return unlocked, max(0, settings.STUDIO_VIDEO_DAILY_CAP - mine), max(0, settings.STUDIO_VIDEO_GLOBAL_DAILY_CAP - everyone)


@router.get("/catalog")
async def video_catalog(creator: Creator = Depends(get_current_creator), db: AsyncSession = Depends(get_db)):
    svc = await _services(db)
    unlocked, left_me, left_all = await _state(db, creator)
    motion_on, persona_on = _on(svc, "video_motion"), _on(svc, "video_persona")
    price = lambda k: svc[k].cost if k in svc else 0     # noqa: E731
    return {
        "available": bool(settings.STUDIO_VIDEO_ENABLED and settings.STUDIO_VIDEO_MODEL and (motion_on or persona_on)),
        "motion": motion_on, "persona": persona_on,
        "styles": [{k: s[k] for k in ("id", "name", "hint")} for s in sv.STYLES],
        "personas": [{k: s[k] for k in ("id", "name", "hint")} for s in sv.PERSONAS],
        "prices": {"motion": price("video_motion"), "extra_photo": price("video_extra"),
                   "persona": price("video_persona"), "voiceover": price("video_voiceover")},
        "extra_photos": _on(svc, "video_extra"),
        "voiceover_available": bool(settings.STUDIO_TTS_MODEL and _on(svc, "video_voiceover")),
        "unlocked": unlocked, "left_today": min(left_me, left_all),
        "max_words": MAX_WORDS,
    }


@router.post("/jobs")
@limiter.limit("6/minute")
async def create_video(
    request: Request,
    kind: Literal["motion", "persona"] = Form("motion"),
    style: str = Form("zoom"),
    persona: str = Form("mama"),
    audio: Literal["silent", "music", "voice"] = Form("silent"),
    line: str = Form("", max_length=220),
    product_name: str = Form("", max_length=60),
    price: str = Form("", max_length=20),
    offer: str = Form("", max_length=22),
    headline: str = Form("", max_length=60),
    business_name: str = Form("", max_length=40),
    phone: str = Form("", max_length=20),
    template: str = Form("kubwa"),
    palette: str = Form("random"),
    photo: Optional[UploadFile] = File(None),
    photo2: Optional[UploadFile] = File(None),
    photo3: Optional[UploadFile] = File(None),
    creator: Creator = Depends(get_current_creator),
    db: AsyncSession = Depends(get_db),
):
    svc = await _services(db)
    if not (settings.STUDIO_VIDEO_ENABLED and settings.STUDIO_VIDEO_MODEL):
        raise HTTPException(503, "Video inakuja hivi karibuni.")
    if not _on(svc, "video_persona" if kind == "persona" else "video_motion"):
        raise HTTPException(503, "Aina hii ya video haipatikani kwa sasa.")
    if style not in sv.STYLE_BY_ID or persona not in sv.PERSONA_BY_ID:
        raise HTTPException(400, "Mtindo au mtu haujulikani.")
    if template not in TEMPLATE_IDS and template != "random":
        raise HTTPException(400, "Muundo wa kadi haujulikani.")
    if palette not in PALETTE_IDS and palette not in ("random", "auto"):
        raise HTTPException(400, "Rangi haijulikani.")

    biz = business_name.strip() or creator.brand_name or ""
    if not biz or not product_name.strip() or not price.strip():
        raise HTTPException(400, "Weka jina la biashara, bidhaa na bei.")

    uploads = [f for f in (photo, photo2, photo3) if f and f.filename]
    if not uploads:
        raise HTTPException(400, "Pakia picha ya bidhaa.")
    if kind == "persona" and len(uploads) > 1:
        raise HTTPException(400, "Video ya mtu inatumia picha moja.")
    if len(uploads) > 1 and not _on(svc, "video_extra"):
        raise HTTPException(400, "Picha nyingi hazipatikani kwa sasa.")

    clean_line = sv.sanitize_line(line)
    if audio == "voice":
        if len(clean_line.split()) < 3:
            raise HTTPException(400, "Andika maneno ya kusemwa (angalau maneno 3).")
        if len(clean_line.split()) > MAX_WORDS:
            raise HTTPException(400, f"Maneno ni mengi mno. Tumia {MAX_WORDS} au chini.")
        if kind == "motion" and not (settings.STUDIO_TTS_MODEL and _on(svc, "video_voiceover")):
            raise HTTPException(400, "Sauti ya maelezo haipatikani kwa sasa.")
    if audio == "music" and kind == "persona":
        raise HTTPException(400, "Chagua sauti au kimya kwa video ya mtu.")
    if kind == "persona" and audio == "voice" and not clean_line:
        raise HTTPException(400, "Andika maneno ya kusemwa.")

    unlocked, left_me, left_all = await _state(db, creator)
    if not unlocked:
        raise HTTPException(403, "Video inafunguliwa baada ya kununua credits mara ya kwanza.")
    if left_all <= 0:
        raise HTTPException(429, "Video zimefikia kikomo cha leo. Jaribu kesho.")
    if left_me <= 0:
        raise HTTPException(429, f"Umefikia kikomo cha video za leo ({settings.STUDIO_VIDEO_DAILY_CAP}). Jaribu kesho.")
    active = await db.scalar(select(func.count(CreatorJob.id)).where(
        CreatorJob.creator_id == creator.id, CreatorJob.kind == "video", CreatorJob.status.in_(("queued", "running"))))
    if (active or 0) >= 1:
        raise HTTPException(429, "Una video inayotengenezwa. Subiri ikamilike.")

    try:
        ok, why = await sv.moderate(" | ".join([product_name, offer, headline, biz, clean_line]))
    except ProviderError as e:
        raise HTTPException(503, str(e))
    if not ok:
        raise HTTPException(400, why or "Maneno haya hayakubaliki kwenye Wakalabot Studio.")

    photos = []
    for up in uploads[:3]:
        raw = await up.read()
        if len(raw) > 8 * 1024 * 1024:
            raise HTTPException(413, "Picha ni kubwa mno. Tumia chini ya 8MB.")
        try:
            photos.append(await asyncio.to_thread(_normalize_photo, raw))
        except Exception:
            raise HTTPException(400, "Picha haisomeki. Jaribu nyingine.")

    cost = svc["video_persona"].cost if kind == "persona" else svc["video_motion"].cost
    if kind == "motion":
        cost += (len(photos) - 1) * (svc["video_extra"].cost if "video_extra" in svc else 0)
        if audio == "voice":
            cost += svc["video_voiceover"].cost

    job_id = uuid.uuid4()
    folder = sv.VIDEO_IN / str(job_id)
    folder.mkdir(parents=True, exist_ok=True)
    try:
        for i, b in enumerate(photos, start=1):
            (folder / f"photo{i}.jpg").write_bytes(b)
        params = {
            "fmt": "story", "kind": kind, "style": style, "persona": persona, "audio": audio, "line": clean_line,
            "product_name": product_name.strip(), "price": price.strip(), "offer": offer.strip(),
            "headline": headline.strip(), "business_name": biz, "phone": phone.strip(),
            "template": template, "palette": palette, "n_photos": len(photos),
        }
        job = CreatorJob(id=job_id, creator_id=creator.id, kind="video", mode="video", cost=cost,
                         free=False, watermark=False, params=params)
        db.add(job)
        await db.flush()
        await adjust_credits(db, creator.id, -cost, "spend", job_id=job_id, note="Video")
        await db.commit()
        await db.refresh(job)
    except InsufficientCredits:
        await db.rollback()
        shutil.rmtree(folder, ignore_errors=True)
        raise HTTPException(402, f"Credits hazitoshi. Unahitaji {cost}, una {creator.credits}. Nunua credits kuendelea.")
    except Exception:
        await db.rollback()
        shutil.rmtree(folder, ignore_errors=True)
        raise
    return _job_out(job)