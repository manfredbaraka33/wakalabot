"""DB-backed job queue with an in-process worker. Survives restarts: jobs left
'running' by a dead process are re-queued (or failed + refunded)."""
import asyncio
import io
import logging
import random
import shutil
import time
import uuid
from contextlib import suppress
from datetime import datetime, timedelta, timezone
from pathlib import Path

from PIL import Image
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import async_sessionmaker

from app.core import settings
from app.db import engine
from app.studio_config import image_cost_usd
from app import studio_bg
from app.studio_credits import adjust_credits, refund_job, reward_referral_on_first_job
from app.studio_models import Creator, CreatorJob
from app.studio_providers import JobRejected, ProviderError, generate_scene, make_plan, to_mp3
from app.studio_pricelist import render_pricelist, resolve_choice as resolve_pl_choice
from app.studio_templates import render_template, resolve_choice

logger = logging.getLogger("studio.worker")

STORAGE = Path(__file__).resolve().parent.parent / "storage" / "studio"
IN_DIR, OUT_DIR = STORAGE / "in", STORAGE / "out"
for _p in (IN_DIR, OUT_DIR):
    _p.mkdir(parents=True, exist_ok=True)

SessionLocal = async_sessionmaker(engine, expire_on_commit=False)
JOB_TIMEOUT = 300
_task: asyncio.Task | None = None
_active: set[asyncio.Task] = set()


def _now():
    return datetime.now(timezone.utc)


def _fallback_headline(name: str, item_type: str = "product") -> str:
    if item_type == "service":
        options = [f"{name} kwa Ubora Unaoutaka", f"Pata {name} Leo!",
                   f"Tunafanya {name} kwa Weledi", f"Karibu Upate {name}"]
    else:
        options = [f"{name} Bora Kwa Bei Nafuu", f"Pata {name} Leo!",
                   f"{name} Mpya Imewasili", f"Usikose {name}!"]
    return random.choice(options)[:60]


async def _claim() -> uuid.UUID | None:
    async with SessionLocal() as db:
        job = (await db.execute(
            select(CreatorJob).where(CreatorJob.status == "queued")
            .order_by(CreatorJob.created_at).limit(1).with_for_update(skip_locked=True)
        )).scalar_one_or_none()
        if not job:
            return None
        job.status, job.started_at = "running", _now()
        job.attempts += 1
        await db.commit()
        return job.id


async def _fail(job_id, message: str, flagged: bool = False):
    async with SessionLocal() as db:
        job = (await db.execute(
            select(CreatorJob).where(CreatorJob.id == job_id).with_for_update()
        )).scalar_one_or_none()
        if not job or job.status in ("done", "failed"):
            return
        job.status, job.error, job.finished_at = "failed", message[:300], _now()
        if flagged:
            job.moderation_flag = True
        await refund_job(db, job, "Kazi imeshindwa")
        if flagged:
            strikes = await db.scalar(select(func.count(CreatorJob.id)).where(
                CreatorJob.creator_id == job.creator_id,
                CreatorJob.moderation_flag.is_(True),
                CreatorJob.created_at >= _now() - timedelta(days=30),
            ))
            if (strikes or 0) >= 5:
                creator = await db.get(Creator, job.creator_id)
                if creator:
                    creator.status = "suspended"
        await db.commit()


async def _run(job_id):
    async with SessionLocal() as db:
        job = await db.get(CreatorJob, job_id)
        p, mode, watermark = dict(job.params), job.mode, job.watermark
        job_owner = job.creator_id

    photo_path = IN_DIR / str(job_id) / "photo.jpg"
    photo_bytes = photo_path.read_bytes() if photo_path.exists() else None
    fmt = p.get("fmt", "square")
    api_cost = 0.0
    bg_removed = False

    if mode == "pricelist":
        items = [
            {"name": str(i.get("name", "")).strip(), "price": str(i.get("price", "")).strip()}
            for i in p.get("items", []) if isinstance(i, dict)
        ]
        items = [i for i in items if i["name"] and i["price"]][:12]
        if not items:
            raise ProviderError("Orodha haina bidhaa.")
        logo = Image.open(io.BytesIO(photo_bytes)).convert("RGB") if photo_bytes else None
        template_id, palette_id = resolve_pl_choice(p.get("template"), p.get("palette"))
        jpg = await asyncio.to_thread(
            render_pricelist, template_id, palette_id, items, p["business_name"],
            p.get("title", ""), p.get("tagline", ""), p.get("phone", ""), logo, fmt, watermark,
        )
        meta = {"headline": p.get("title") or "Orodha ya Bei", "template": template_id, "palette": palette_id}
    else:
        transcript = ""
        if mode == "template":
            if not photo_bytes:
                raise ProviderError("Picha haikupatikana.")
            photo = Image.open(io.BytesIO(photo_bytes)).convert("RGB")
            price, offer = p.get("price", ""), p.get("offer", "")
            headline = p.get("headline") or _fallback_headline(p.get("product_name") or "Bidhaa", p.get("item_type", "product"))
            template_id, palette_id = resolve_choice(p.get("template"), p.get("palette"))
            if p.get("remove_bg"):
                shot = await studio_bg.studio_shot(photo, palette_id, fmt)
                if shot is not None:
                    photo, bg_removed = shot, True
                elif int(p.get("bg_cost") or 0) > 0:      # could not cut it out: keep the photo, refund the add-on
                    async with SessionLocal() as rdb:
                        await adjust_credits(rdb, job_owner, int(p["bg_cost"]), "refund", job_id=job_id,
                                             note="Mandhari haikuondolewa")
                        await rdb.commit()
        else:  # AI posters (switched off at the API while AI_POSTERS_ENABLED is False)
            audio = None
            if mode == "voice":
                audio_path = IN_DIR / str(job_id) / "audio.bin"
                if not audio_path.exists():
                    raise ProviderError("Sauti haikupatikana.")
                audio = await to_mp3(audio_path.read_bytes())
            plan = await make_plan(text=p.get("prompt", ""), audio=audio, has_photo=bool(photo_bytes))
            if not plan["safe"]:
                raise JobRejected(plan["reason"] or "Maelezo haya hayakubaliki kwenye Wakalabot Studio.")
            product = p.get("product_name") or plan["product"]
            price = p.get("price") or plan["price"]
            offer = p.get("offer") or plan["offer"]
            headline = p.get("headline") or plan["headline"] or _fallback_headline(product or "Bidhaa")
            photo = await generate_scene(plan["visual_prompt"], fmt, photo_bytes)
            template_id, palette_id = resolve_choice(p.get("template"), p.get("palette"), ai_palette=plan["style"])
            api_cost = image_cost_usd() + 0.002
            transcript = plan["transcript"]

        jpg = await asyncio.to_thread(
            render_template, template_id, palette_id, photo,
            headline=headline, price=price, offer=offer, biz=p["business_name"],
            phone=p.get("phone", ""), fmt=fmt, watermark=watermark,
        )
        meta = {"headline": headline, "template": template_id, "palette": palette_id,
                "transcript": transcript, "bg_removed": bg_removed}

    (OUT_DIR / f"{job_id}.jpg").write_bytes(jpg)
    async with SessionLocal() as db:
        job = (await db.execute(
            select(CreatorJob).where(CreatorJob.id == job_id).with_for_update()
        )).scalar_one()
        job.status, job.finished_at = "done", _now()
        job.result_path, job.result_meta, job.api_cost_usd = f"out/{job_id}.jpg", meta, api_cost
        owner_id = job.creator_id
        await db.commit()

    # Referral reward: a separate transaction AFTER the job is saved, so it can never break a finished job.
    try:
        async with SessionLocal() as rdb:
            await reward_referral_on_first_job(rdb, owner_id)
            await rdb.commit()
    except Exception:
        logger.exception("referral reward failed")
       

async def _process(job_id):
    try:
        await asyncio.wait_for(_run(job_id), timeout=JOB_TIMEOUT)
    except JobRejected as e:
        await _fail(job_id, str(e), flagged=True)
    except ProviderError as e:
        await _fail(job_id, str(e))
    except asyncio.TimeoutError:
        await _fail(job_id, "Imechukua muda mrefu mno. Credits zimerudishwa.")
    except asyncio.CancelledError:
        raise
    except Exception:
        logger.exception("studio job %s crashed", job_id)
        await _fail(job_id, "Kuna tatizo la kiufundi. Credits zimerudishwa.")
    finally:
        shutil.rmtree(IN_DIR / str(job_id), ignore_errors=True)  # never keep raw uploads


async def _recover():
    async with SessionLocal() as db:
        rows = (await db.execute(
            select(CreatorJob).where(CreatorJob.status == "running").with_for_update()
        )).scalars().all()
        for job in rows:
            if job.attempts >= 2:
                job.status, job.finished_at = "failed", _now()
                job.error = "Seva ilizimwa wakati wa kazi. Credits zimerudishwa."
                await refund_job(db, job, "Seva ilizimwa")
            else:
                job.status = "queued"
        await db.commit()


async def _cleanup():
    cutoff = _now() - timedelta(days=settings.STUDIO_RETENTION_DAYS)
    async with SessionLocal() as db:
        rows = (await db.execute(select(CreatorJob).where(
            CreatorJob.status == "done", CreatorJob.files_deleted.is_(False),
            CreatorJob.finished_at < cutoff,
        ).limit(200))).scalars().all()
        for job in rows:
            if job.result_path:
                with suppress(Exception):
                    (STORAGE / job.result_path).unlink(missing_ok=True)
            job.files_deleted = True
        await db.commit()


async def _loop():
    with suppress(Exception):
        await _recover()
    last_cleanup = 0.0
    while True:
        try:
            while len(_active) < max(1, settings.STUDIO_CONCURRENCY):
                job_id = await _claim()
                if not job_id:
                    break
                t = asyncio.create_task(_process(job_id))
                _active.add(t)
                t.add_done_callback(_active.discard)
            if time.monotonic() - last_cleanup > 6 * 3600:
                await _cleanup()
                last_cleanup = time.monotonic()
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception("studio worker loop error")
            
        studio_bg.unload_if_idle()
        await asyncio.sleep(2)


def start_worker():
    global _task
    if _task is None or _task.done():
        _task = asyncio.create_task(_loop())


async def stop_worker():
    if _task:
        _task.cancel()
        with suppress(asyncio.CancelledError):
            await _task
    for t in list(_active):
        t.cancel()