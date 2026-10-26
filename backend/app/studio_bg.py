"""AI studio re-shoot for Studio posters, using Google's Nano Banana 2.1 (image editing).
Sends the seller's photo and gets back the SAME product on a clean studio background.
Returns None on ANY failure: the caller then keeps the original photo and refunds the add-on credits."""
import asyncio
import io
import logging
import time
from pathlib import Path
from typing import Optional

from google import genai
from google.genai import types
from PIL import Image

from app.core import settings

logger = logging.getLogger("studio.shot")

RATIOS = {"1:1": 1.0, "3:4": 0.75, "4:3": 1.333, "2:3": 0.667, "3:2": 1.5,
          "4:5": 0.8, "5:4": 1.25, "9:16": 0.5625, "16:9": 1.778}
PROMPT = (
    "Edit this photo. Keep the product exactly the same: its shape, size, proportions, color, material, "
    "texture, printed patterns, labels and any text must stay unchanged. "
    "Remove the background and every other object. "
    "Place the product centered on a clean, seamless light grey studio background with soft natural lighting "
    "and a gentle contact shadow under it. Do not add any text, logo, props or people. Do not redesign the product."
)
_client = None
_sem = asyncio.Semaphore(3)        # at most 3 edits at the same time


def _get_client():
    global _client
    if _client is None:
        _client = genai.Client(api_key=settings.GEMINI_API_KEY)
    return _client


def _closest_ratio(w: int, h: int) -> str:
    return min(RATIOS, key=lambda k: abs(RATIOS[k] - w / h))


def _call(image_bytes: bytes, ratio: str):
    """Blocking call. Older SDK versions may not know some options, so fall back step by step."""
    model = getattr(settings, "STUDIO_SHOT_MODEL", "gemini-nano-banana-2.1")
    attempts = (
        lambda: types.GenerateContentConfig(
            response_modalities=["TEXT", "IMAGE"],
            image_config=types.ImageConfig(aspect_ratio=ratio, image_size="1K")),
        lambda: types.GenerateContentConfig(
            response_modalities=["TEXT", "IMAGE"],
            image_config=types.ImageConfig(aspect_ratio=ratio)),
        lambda: types.GenerateContentConfig(response_modalities=["TEXT", "IMAGE"]),
    )
    last = None
    for make in attempts:
        try:
            return _get_client().models.generate_content(
                model=model,
                contents=[types.Part.from_bytes(data=image_bytes, mime_type="image/jpeg"), PROMPT],
                config=make())
        except Exception as e:
            last = e
    raise last


def _first_image(resp) -> Optional[Image.Image]:
    cands = resp.candidates or []
    if not cands or not cands[0].content:
        logger.warning("studio shot: no candidates (blocked or empty)")
        return None
    for part in cands[0].content.parts or []:
        if getattr(part, "inline_data", None) and part.inline_data.data:
            return Image.open(io.BytesIO(part.inline_data.data)).convert("RGB")
    logger.warning("studio shot: the reply had no image")
    return None


async def studio_shot(photo: Image.Image, palette_id: str, fmt: str) -> Optional[Image.Image]:
    """Return the product on a clean studio background, or None if anything went wrong."""
    if not settings.STUDIO_BG_REMOVE_ENABLED:
        return None
    async with _sem:
        try:
            small = photo.copy()
            small.thumbnail((1280, 1280))
            buf = io.BytesIO()
            small.convert("RGB").save(buf, "JPEG", quality=90)
            resp = await asyncio.wait_for(
                asyncio.to_thread(_call, buf.getvalue(), _closest_ratio(*small.size)), timeout=90)
            return _first_image(resp)
        except Exception:
            logger.exception("studio shot failed")
            return None


SHOTS_DIR = Path(__file__).resolve().parent.parent / "storage" / "studio" / "shots"
SHOT_TTL_SECONDS = 24 * 3600       # an AI studio photo is kept 24 hours, so design tweaks cost no new edit
_last_purge = 0.0


def _shot_path(creator_id, photo_hash: str) -> Optional[Path]:
    if not photo_hash or not photo_hash.isalnum():
        return None
    return SHOTS_DIR / str(creator_id) / f"{photo_hash}.jpg"


def shot_cached(creator_id, photo_hash: str) -> bool:
    p = _shot_path(creator_id, photo_hash)
    return bool(p and p.exists() and time.time() - p.stat().st_mtime < SHOT_TTL_SECONDS)


def load_shot(creator_id, photo_hash: str) -> Optional[Image.Image]:
    if not shot_cached(creator_id, photo_hash):
        return None
    try:
        return Image.open(_shot_path(creator_id, photo_hash)).convert("RGB")
    except Exception:
        return None


def save_shot(creator_id, photo_hash: str, img: Image.Image) -> None:
    p = _shot_path(creator_id, photo_hash)
    if p is None:
        return
    try:
        p.parent.mkdir(parents=True, exist_ok=True)
        img.convert("RGB").save(p, "JPEG", quality=92)
    except Exception:
        logger.exception("could not save the studio photo")


def unload_if_idle() -> None:
    """Called by the worker loop every couple of seconds. Once an hour it deletes studio photos older than 24 hours."""
    global _last_purge
    now = time.time()
    if now - _last_purge < 3600:
        return
    _last_purge = now
    try:
        if not SHOTS_DIR.exists():
            return
        for f in SHOTS_DIR.rglob("*.jpg"):
            if now - f.stat().st_mtime > SHOT_TTL_SECONDS:
                f.unlink(missing_ok=True)
        for d in SHOTS_DIR.iterdir():
            if d.is_dir() and not any(d.iterdir()):
                d.rmdir()
    except Exception:
        logger.exception("studio photo cleanup failed")