"""Shared drawing helpers + base palettes for Studio (posters and price lists)."""
import io
import os
import re
from functools import lru_cache

from PIL import Image, ImageDraw, ImageFilter, ImageFont

_FONT_DIR = os.path.join(os.path.dirname(__file__), "..", "static", "fonts")


@lru_cache(maxsize=96)
def _F(size: int, bold: bool = True):
    names = (
        ["Poppins-Bold.ttf", "DejaVuSans-Bold.ttf"] if bold
        else ["Poppins-Medium.ttf", "DejaVuSans.ttf"]
    )
    for name in names:
        for path in (os.path.join(_FONT_DIR, name), name):
            try:
                return ImageFont.truetype(path, size)
            except Exception:
                continue
    try:
        return ImageFont.load_default(size)
    except TypeError:
        return ImageFont.load_default()


_STYLES = {
    "giza": {
        "bg1": (11, 11, 18), "bg2": (36, 27, 10), "accent": (245, 183, 49),
        "on_accent": (28, 20, 4), "text": (255, 255, 255), "muted": (178, 172, 152),
        "card": (255, 255, 255, 22), "pill": (255, 255, 255), "on_pill": (20, 20, 30),
        "overlay": (8, 8, 14), "overlay_a": 0.62, "ring": (245, 183, 49), "dark": True,
    },
    "zumaridi": {
        "bg1": (5, 28, 22), "bg2": (9, 56, 43), "accent": (52, 211, 153),
        "on_accent": (3, 32, 24), "text": (255, 255, 255), "muted": (150, 200, 184),
        "card": (255, 255, 255, 22), "pill": (255, 255, 255), "on_pill": (6, 40, 30),
        "overlay": (4, 30, 22), "overlay_a": 0.60, "ring": (52, 211, 153), "dark": True,
    },
    "machweo": {
        "bg1": (46, 14, 24), "bg2": (118, 38, 20), "accent": (255, 138, 76),
        "on_accent": (52, 14, 4), "text": (255, 255, 255), "muted": (244, 196, 176),
        "card": (255, 255, 255, 24), "pill": (255, 255, 255), "on_pill": (60, 18, 10),
        "overlay": (52, 16, 10), "overlay_a": 0.58, "ring": (255, 138, 76), "dark": True,
    },
    "safi": {
        "bg1": (250, 250, 253), "bg2": (226, 229, 247), "accent": (79, 70, 229),
        "on_accent": (255, 255, 255), "text": (24, 24, 40), "muted": (100, 104, 130),
        "card": (255, 255, 255, 235), "pill": (24, 24, 40), "on_pill": (255, 255, 255),
        "overlay": (255, 255, 255), "overlay_a": 0.74, "ring": (255, 255, 255), "dark": False,
    },
}


def _t(d, xy, text, font, fill, anchor="la"):
    try:
        d.text(xy, text, font=font, fill=fill, anchor=anchor)
    except Exception:
        d.text(xy, text, font=font, fill=fill)


_PREFIXED = re.compile(r"^(kuanzia|ada)\s+([\d][\d,. ]*)$", re.IGNORECASE)


def _fmt_price(raw: str) -> str:
    s = raw.strip()
    m = _PREFIXED.match(s)
    if m:
        digits = m.group(2).replace(",", "").replace(".", "").replace(" ", "")
        if digits.isdigit():
            return f"{m.group(1).capitalize()} {int(digits):,} TZS"
    digits = s.replace(",", "").replace(".", "").replace(" ", "")
    return f"{int(digits):,} TZS" if digits.isdigit() else s


def _gradient(w, h, top, bottom):
    strip = Image.new("RGB", (1, h))
    px = strip.load()
    for y in range(h):
        t = y / max(h - 1, 1)
        px[0, y] = tuple(int(top[i] + (bottom[i] - top[i]) * t) for i in range(3))
    return strip.resize((w, h), Image.Resampling.BILINEAR)


def _cover(img, w, h):
    s = max(w / img.width, h / img.height)
    nw, nh = max(1, round(img.width * s)), max(1, round(img.height * s))
    img = img.resize((nw, nh), Image.Resampling.LANCZOS)
    l, t = (nw - w) // 2, (nh - h) // 2
    return img.crop((l, t, l + w, t + h))


def _rr_mask(size, radius):
    m = Image.new("L", size, 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, size[0] - 1, size[1] - 1], radius=radius, fill=255)
    return m


def _paste_rr(base, box, radius, rgb, alpha=255):
    x0, y0, x1, y1 = [int(v) for v in box]
    w, h = x1 - x0, y1 - y0
    if w <= 0 or h <= 0:
        return
    mask = Image.new("L", (w, h), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, w - 1, h - 1], radius=radius, fill=alpha)
    base.paste(Image.new("RGB", (w, h), rgb), (x0, y0), mask)


def _paste_circle(base, cx, cy, r, rgb, alpha=255):
    r = int(r)
    mask = Image.new("L", (r * 2, r * 2), 0)
    ImageDraw.Draw(mask).ellipse([0, 0, r * 2 - 1, r * 2 - 1], fill=alpha)
    base.paste(Image.new("RGB", (r * 2, r * 2), rgb), (int(cx - r), int(cy - r)), mask)


def _shadow(base, box, radius, offset=(6, 16), blur=20, alpha=140):
    x0, y0, x1, y1 = [int(v) for v in box]
    w, h, pad = x1 - x0, y1 - y0, blur * 3
    mask = Image.new("L", (w + 2 * pad, h + 2 * pad), 0)
    ImageDraw.Draw(mask).rounded_rectangle([pad, pad, pad + w, pad + h], radius=radius, fill=alpha)
    mask = mask.filter(ImageFilter.GaussianBlur(blur))
    base.paste(
        Image.new("RGB", mask.size, (0, 0, 0)),
        (x0 - pad + offset[0], y0 - pad + offset[1]), mask,
    )


def _jpeg(img) -> bytes:
    out = io.BytesIO()
    img.save(out, "JPEG", quality=92, optimize=True, subsampling=0)
    return out.getvalue()