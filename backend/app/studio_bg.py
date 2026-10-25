"""Background removal for Studio posters. Runs a small open-source segmentation model (ONNX)
on our own server, so the photo never leaves it. Returns None on ANY failure: the caller then
keeps the original photo and refunds the add-on credits."""
import asyncio
import gc
import logging
import time
from pathlib import Path
from typing import Optional

from PIL import Image, ImageDraw, ImageFilter

from app.core import settings
from app.studio_templates import PALETTES, _lerp

logger = logging.getLogger("studio.bg")

MODELS_DIR = Path(__file__).resolve().parent.parent / "storage" / "models"
MODEL_URL = "https://github.com/danielgatis/rembg/releases/download/v0.0.0/{name}.onnx"
MEAN = (0.485, 0.456, 0.406)
# name -> (model input size, std)
SPECS = {
    "silueta": (320, (0.229, 0.224, 0.225)),
    "u2netp": (320, (0.229, 0.224, 0.225)),
    "u2net": (320, (0.229, 0.224, 0.225)),
    "isnet-general-use": (1024, (1.0, 1.0, 1.0)),
}
# Studio-shot canvas per poster format (same proportions as the final poster)
SHOT_SIZES = {"square": (1600, 1600), "portrait": (1440, 1800), "a4": (1273, 1800), "story": (1012, 1800)}
IDLE_UNLOAD_SECONDS = 600

_session = None
_session_name: Optional[str] = None
_last_used = 0.0
_sem = asyncio.Semaphore(1)       # one removal at a time keeps memory flat


def _ensure_model(name: str) -> Optional[Path]:
    path = MODELS_DIR / f"{name}.onnx"
    if path.exists() and path.stat().st_size > 1_000_000:
        return path
    try:
        import httpx
        MODELS_DIR.mkdir(parents=True, exist_ok=True)
        tmp = path.with_suffix(".part")
        with httpx.stream("GET", MODEL_URL.format(name=name), follow_redirects=True, timeout=180) as r:
            r.raise_for_status()
            with open(tmp, "wb") as f:
                for chunk in r.iter_bytes():
                    f.write(chunk)
        tmp.replace(path)
        return path
    except Exception:
        logger.exception("could not download background model %s", name)
        return None


def _get_session():
    global _session, _session_name, _last_used
    name = settings.STUDIO_BG_MODEL if settings.STUDIO_BG_MODEL in SPECS else "silueta"
    if _session is not None and _session_name == name:
        return _session, name
    path = _ensure_model(name)
    if path is None:
        return None, name
    import onnxruntime as ort
    so = ort.SessionOptions()
    so.intra_op_num_threads = 1
    so.inter_op_num_threads = 1
    so.enable_cpu_mem_arena = False
    so.enable_mem_pattern = False
    so.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_BASIC
    _session = ort.InferenceSession(str(path), sess_options=so, providers=["CPUExecutionProvider"])
    _session_name = name
    _last_used = time.monotonic()
    return _session, name


def _predict_mask(photo: Image.Image) -> Optional[Image.Image]:
    import numpy as np
    sess, name = _get_session()
    if sess is None:
        return None
    size, std = SPECS[name]
    im = photo.convert("RGB").resize((size, size), Image.Resampling.LANCZOS)
    arr = np.asarray(im, dtype=np.float32)
    arr = arr / max(float(arr.max()), 1e-6)
    for i in range(3):
        arr[:, :, i] = (arr[:, :, i] - MEAN[i]) / std[i]
    arr = arr.transpose((2, 0, 1))[None, ...].astype(np.float32)
    out = sess.run(None, {sess.get_inputs()[0].name: arr})
    pred = out[0][:, 0, :, :]
    mx, mn = float(pred.max()), float(pred.min())
    if mx - mn < 1e-6:
        return None
    pred = np.squeeze((pred - mn) / (mx - mn))
    mask = Image.fromarray((pred * 255).astype("uint8"))
    return mask.resize(photo.size, Image.Resampling.LANCZOS)


def _compose(photo: Image.Image, mask: Image.Image, palette_id: str, fmt: str) -> Optional[Image.Image]:
    """Cut the product out and place it on a soft spotlight background in the poster's palette."""
    pal = PALETTES.get(palette_id, PALETTES["giza"])
    # Sharpen the edge (contrast curve), remove specks, then feather slightly
    m = mask.point(lambda v: 0 if v < 30 else (255 if v > 215 else int((v - 30) * 255 / 185)))
    m = m.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(1.1))
    coverage = sum(m.histogram()[40:]) / float(m.width * m.height)
    if coverage < 0.03 or coverage > 0.97:        # nothing found, or the whole picture was kept
        return None
    bbox = m.point(lambda v: 255 if v > 40 else 0).getbbox()
    if not bbox:
        return None

    rgba = photo.convert("RGBA")
    rgba.putalpha(m)
    cut = rgba.crop(bbox)

    W, H = SHOT_SIZES.get(fmt, SHOT_SIZES["square"])
    if pal["dark"]:
        center, edge = _lerp(pal["bg2"], pal["accent"], 0.30), pal["bg1"]
    else:
        center, edge = _lerp((255, 255, 255), pal["accent"], 0.16), _lerp(pal["bg2"], pal["accent"], 0.10)
    rg = Image.radial_gradient("L").resize((W, H), Image.Resampling.BILINEAR)
    bg = Image.composite(Image.new("RGB", (W, H), edge), Image.new("RGB", (W, H), center), rg)

    bw, bh = int(W * 0.62), int(H * 0.56)         # keep the product inside a safe zone of every design
    s = min(bw / cut.width, bh / cut.height)
    pw, ph = max(1, int(cut.width * s)), max(1, int(cut.height * s))
    cut = cut.resize((pw, ph), Image.Resampling.LANCZOS)
    cx, cy = W // 2, int(H * 0.53)
    x, y = cx - pw // 2, cy - ph // 2

    sh_w, sh_h = int(pw * 0.78), max(18, int(ph * 0.07))      # soft ground shadow
    shadow = Image.new("L", (W, H), 0)
    ImageDraw.Draw(shadow).ellipse(
        [cx - sh_w // 2, y + ph - sh_h // 2, cx + sh_w // 2, y + ph + sh_h // 2], fill=130)
    shadow = shadow.filter(ImageFilter.GaussianBlur(max(10, sh_h)))
    bg.paste(Image.new("RGB", (W, H), (0, 0, 0)), (0, 0), shadow)
    bg.paste(cut.convert("RGB"), (x, y), cut.split()[3])
    return bg


async def studio_shot(photo: Image.Image, palette_id: str, fmt: str) -> Optional[Image.Image]:
    """Returns the product on a studio background, or None if anything went wrong."""
    global _last_used
    if not settings.STUDIO_BG_REMOVE_ENABLED:
        return None
    async with _sem:
        try:
            def work():
                mask = _predict_mask(photo)
                return None if mask is None else _compose(photo, mask, palette_id, fmt)
            result = await asyncio.wait_for(asyncio.to_thread(work), timeout=90)
            _last_used = time.monotonic()
            return result
        except Exception:
            logger.exception("background removal failed")
            return None


def unload_if_idle() -> None:
    """Free the model's memory after 10 idle minutes. Called by the worker loop; cheap."""
    global _session
    if _session is not None and time.monotonic() - _last_used > IDLE_UNLOAD_SECONDS:
        _session = None
        gc.collect()