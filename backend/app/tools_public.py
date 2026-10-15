"""
Free, no-auth public tools. These exist purely as lead magnets — small,
instantly useful utilities that carry the Wakalabot name and funnel
toward signup, without requiring any commitment to use.
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from google import genai
from google.genai import types

from app.core import settings

router = APIRouter(prefix="/tools", tags=["public-tools"])

_client = genai.Client(api_key=settings.GEMINI_API_KEY)

from app.limiter import limiter
from fastapi import Request

import asyncio
import json
import os
from functools import lru_cache
from typing import Optional

from fastapi import APIRouter, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import Response, StreamingResponse
from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageOps
from pydantic import BaseModel, Field, ValidationError





class BroadcastRequest(BaseModel):
    business_name: str = Field(..., min_length=2, max_length=100)
    product_name: str = Field(..., min_length=2, max_length=150)
    price: str = Field(..., min_length=1, max_length=50)
    offer: str = Field(default="", max_length=200)  # optional: "punguzo 20%", "leo tu"


@router.post("/broadcast-message")
@limiter.limit("10/minute")
async def generate_broadcast_message(request: Request, payload: BroadcastRequest) -> dict:
    prompt = f"""Tengeneza ujumbe mfupi wa WhatsApp Broadcast kwa Kiswahili, wa kuvutia,
kwa biashara ifuatayo:

Jina la Biashara: {payload.business_name}
Bidhaa: {payload.product_name}
Bei: {payload.price}
{"Ofa: " + payload.offer if payload.offer else ""}

Sheria:
- Mfupi, si zaidi ya maneno 60
- Tumia emoji 2-3 zinazofaa
- Uwe na call-to-action wazi mwishoni (mfano: "Agiza sasa!", "Tupigie simu")
- Kiswahili cha kawaida, si rasmi sana
- Usiongeze maelezo ya ziada, toa ujumbe tu tayari kutumwa"""

    try:
        response = await _client.aio.models.generate_content(
            model="gemini-3.1-flash-lite",
            contents=prompt,
            config=types.GenerateContentConfig(
                temperature=0.7,
                max_output_tokens=200,
            ),
        )
        message = response.text.strip() if response.text else None
        if not message:
            raise HTTPException(status_code=500, detail="Imeshindwa kutengeneza ujumbe.")
        return {"message": message}
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(
            status_code=503,
            detail="Huduma haipatikani kwa sasa. Tafadhali jaribu tena baadaye."
        )



import io
from fastapi import UploadFile
from PIL import Image, ImageDraw, ImageFont
from fastapi.responses import StreamingResponse


class PriceListItem(BaseModel):
    name: str = Field(..., min_length=1, max_length=60)
    price: str = Field(..., min_length=1, max_length=30)




# ═════════════════════════════════════════════════════════════════════════════
# Shared design system (price list + ad generator)
# ═════════════════════════════════════════════════════════════════════════════

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


def _ctext(d, cx, y, text, font, fill):
    _t(d, (cx, y), text, font, fill, "ma")


def _fit(d, text, bold, max_w, max_h, max_size, min_size, max_lines):
    """Largest font size at which the wrapped text fits both width and height."""
    for size in range(max_size, min_size - 1, -2):
        f = _F(size, bold)
        lines = _wrap(d, text, f, max_w, 99)
        lh = int(size * 1.18)
        if len(lines) <= max_lines and len(lines) * lh <= max_h:
            return lines, f, lh
    f = _F(min_size, bold)
    return _wrap(d, text, f, max_w, max_lines), f, int(min_size * 1.18)


def _fmt_price(raw: str) -> str:
    s = raw.strip()
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


def _contain(img, w, h):
    s = min(w / img.width, h / img.height)
    return img.resize(
        (max(1, round(img.width * s)), max(1, round(img.height * s))),
        Image.Resampling.LANCZOS,
    )


def _flatten(img, bg=(255, 255, 255)):
    rgba = img.convert("RGBA")
    base = Image.new("RGB", rgba.size, bg)
    base.paste(rgba, mask=rgba.split()[3])
    return base


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


# Daily cap on AI calls so a viral day can't create a surprise bill.
_AI_DAILY_CAP = 400
_ai_usage = {"day": None, "count": 0}


def _ai_allowed() -> bool:
    today = datetime.now(timezone.utc).date()
    if _ai_usage["day"] != today:
        _ai_usage["day"], _ai_usage["count"] = today, 0
    if _ai_usage["count"] >= _AI_DAILY_CAP:
        return False
    _ai_usage["count"] += 1
    return True


# ═════════════════════════════════════════════════════════════════════════════
# Price list (redesigned)
# ═════════════════════════════════════════════════════════════════════════════

def _render_price_list(biz, tagline, phone, items, style_key, logo) -> bytes:
    S = _STYLES.get(style_key, _STYLES["giza"])
    W, MX = 1080, 64
    scratch = ImageDraw.Draw(Image.new("RGB", (10, 10)))

    # --- measure header
    logo_size = 140 if logo else 0
    name_x = MX + (logo_size + 30 if logo else 0)
    name_w = W - MX - name_x
    nlines, nf, nlh = _fit(scratch, biz, True, name_w, 190, 76, 40, 2)
    text_h = len(nlines) * nlh
    tag_lines, tag_f = [], _F(30, False)
    if tagline.strip():
        tag_lines = _wrap(scratch, tagline.strip(), tag_f, name_w, 2)
    tag_h = len(tag_lines) * 40 + (8 if tag_lines else 0)
    top = 84
    block_h = max(logo_size, text_h + tag_h)
    pill_y = top + block_h + 34
    header_end = pill_y + 56 + 36

    n = len(items)
    footer_h = 170 if phone.strip() else 90
    H = max(1080, header_end + n * 112 + footer_h + 20)
    avail = H - header_end - footer_h - 20
    row_h = min(150, max(112, avail // n))
    rows_y0 = header_end + max(0, (avail - n * row_h) // 2)

    # --- background + decoration
    bg = _gradient(W, H, S["bg1"], S["bg2"])
    _paste_circle(bg, W - 40, 40, 260, S["accent"], 38)
    _paste_circle(bg, 0, H, 220, S["accent"], 30)
    d = ImageDraw.Draw(bg)

    # --- header
    if logo:
        lx, ly = MX, top + (block_h - logo_size) // 2
        _paste_circle(bg, lx + logo_size / 2, ly + logo_size / 2, logo_size / 2 + 6, (255, 255, 255))
        lg = _cover(logo, logo_size, logo_size)
        m = Image.new("L", (logo_size, logo_size), 0)
        ImageDraw.Draw(m).ellipse([0, 0, logo_size - 1, logo_size - 1], fill=255)
        bg.paste(lg, (lx, ly), m)
    y = top + (block_h - (text_h + tag_h)) // 2
    for ln in nlines:
        _t(d, (name_x, y), ln, nf, S["text"])
        y += nlh
    y += 8 if tag_lines else 0
    for ln in tag_lines:
        _t(d, (name_x, y), ln, tag_f, S["muted"])
        y += 40
    pf = _F(26, True)
    pw_ = d.textlength("ORODHA YA BEI", font=pf) + 56
    d.rounded_rectangle([MX, pill_y, MX + pw_, pill_y + 56], radius=28, fill=S["accent"])
    _t(d, (MX + pw_ / 2, pill_y + 28), "ORODHA YA BEI", pf, S["on_accent"], "mm")

    # --- rows
    y = rows_y0
    for i, it in enumerate(items):
        r0, r1 = y, y + row_h - 14
        box = (MX, r0, W - MX, r1)
        _paste_rr(bg, box, 28, S["card"][:3], S["card"][3])
        if not S["dark"]:
            d.rounded_rectangle(box, radius=28, outline=(214, 218, 240), width=2)
        cy = (r0 + r1) // 2

        d.ellipse([MX + 22, cy - 26, MX + 74, cy + 26], fill=S["accent"])
        _t(d, (MX + 48, cy), str(i + 1), _F(26, True), S["on_accent"], "mm")

        price_txt = _fmt_price(it.price)
        size = 36
        while size > 20 and d.textlength(price_txt, font=_F(size, True)) + 44 > 420:
            size -= 2
        pfont = _F(size, True)
        pw2 = d.textlength(price_txt, font=pfont) + 44
        px1 = W - MX - 20
        px0 = px1 - pw2
        d.rounded_rectangle([px0, cy - 30, px1, cy + 30], radius=30, fill=S["accent"])
        _t(d, ((px0 + px1) / 2, cy), price_txt, pfont, S["on_accent"], "mm")

        avail_w = px0 - 24 - (MX + 100)
        lines, f, lh = _fit(d, it.name.strip(), False, avail_w, row_h - 40, 38, 24, 2)
        ty = cy - (len(lines) * lh) / 2
        for ln in lines:
            _t(d, (MX + 100, ty), ln, f, S["text"])
            ty += lh
        y += row_h

    # --- footer
    fy = H - footer_h + 6
    if phone.strip():
        cf = _F(32, True)
        ptxt = _truncate(d, f"Piga / WhatsApp: {phone.strip()}", cf, W - 2 * MX - 70)
        pwid = d.textlength(ptxt, font=cf) + 70
        x0 = (W - pwid) / 2
        d.rounded_rectangle([x0, fy, x0 + pwid, fy + 68], radius=34, fill=S["pill"])
        _t(d, (W / 2, fy + 34), ptxt, cf, S["on_pill"], "mm")
        fy += 92
    _ctext(d, W / 2, fy, "Imetengenezwa na Wakalabot  ·  wakalabot.co.tz", _F(22, False), S["muted"])
    return _jpeg(bg)


@router.post("/price-list-image")
@limiter.limit("10/minute")
async def generate_price_list_image(
    request: Request,
    business_name: str = Form(..., min_length=2, max_length=50),
    items_json: str = Form(...),
    tagline: str = Form(default="", max_length=60),
    phone: str = Form(default="", max_length=20),
    style: str = Form(default="giza"),
    logo: Optional[UploadFile] = File(default=None),
):
    try:
        raw = json.loads(items_json)
        if not isinstance(raw, list):
            raise ValueError
        items = [PriceListItem(**x) for x in raw]
        items = [i for i in items if i.name.strip() and i.price.strip()]
    except (ValueError, TypeError, ValidationError):
        raise HTTPException(status_code=400, detail="Orodha ya bidhaa si sahihi.")
    if not 1 <= len(items) <= 12:
        raise HTTPException(status_code=400, detail="Weka bidhaa 1 hadi 12.")

    logo_img = None
    if logo is not None and logo.filename:
        try:
            data = await logo.read()
            if len(data) <= 5 * 1024 * 1024:
                logo_img = _flatten(ImageOps.exif_transpose(Image.open(io.BytesIO(data))))
        except Exception:
            logo_img = None

    jpg = await asyncio.to_thread(
        _render_price_list, business_name.strip(), tagline, phone, items,
        style if style in _STYLES else "giza", logo_img,
    )
    return Response(content=jpg, media_type="image/jpeg", headers={"Cache-Control": "no-store"})


# ═════════════════════════════════════════════════════════════════════════════
# Product ad generator (photo -> finished advert)
# ═════════════════════════════════════════════════════════════════════════════

_AD_LAYOUT = {
    "square": {"W": 1080, "H": 1080, "pill_y": 46, "head_y": 118, "head_h": 170,
               "head_max": 76, "head_lines": 2, "box": (90, 300, 900, 520), "foot_y": 1030},
    # Story keeps key content inside Instagram's safe zone (~250px top, ~340px bottom).
    "story": {"W": 1080, "H": 1920, "pill_y": 250, "head_y": 332, "head_h": 250,
              "head_max": 96, "head_lines": 3, "box": (80, 640, 920, 700), "foot_y": 1560},
}


async def _make_headline(product: str) -> str:
    fallbacks = [
        f"{product} Bora Kwa Bei Nafuu", f"Pata {product} Leo!",
        f"{product} Mpya Imewasili", f"Usikose {product}!",
    ]
    if not _ai_allowed():
        return random.choice(fallbacks)
    try:
        resp = await _client.aio.models.generate_content(
            model="gemini-3.1-flash-lite",
            contents=(
                "Andika kichwa kimoja cha tangazo kwa Kiswahili cha kawaida cha mtaani "
                "(maneno 3 hadi 7) cha kumvutia mteja anunue: "
                f"{product}. Bila emoji, bila alama za nukuu. Toa kichwa pekee."
            ),
            config=types.GenerateContentConfig(temperature=0.9, max_output_tokens=80),
        )
        lines = (resp.text or "").strip().splitlines()
        if lines:
            text = lines[0].strip().strip("\"“”'*# ")
            if 3 <= len(text) <= 70:
                return text
    except Exception:
        pass
    return random.choice(fallbacks)


def _render_ad(photo, price, biz, phone, headline, offer, style_key, fmt) -> bytes:
    S = _STYLES.get(style_key, _STYLES["giza"])
    L = _AD_LAYOUT.get(fmt, _AD_LAYOUT["square"])
    W, H = L["W"], L["H"]

    # Blurred, tinted copy of the photo as the background
    small = _cover(photo, W // 4, H // 4).filter(ImageFilter.GaussianBlur(10))
    bg = small.resize((W, H), Image.Resampling.BICUBIC)
    bg = Image.blend(bg, Image.new("RGB", (W, H), S["overlay"]), S["overlay_a"])

    # Real product photo as a rounded, framed card
    px, py, pw, ph = L["box"]
    fg = _contain(photo, pw, ph)
    cw, ch = fg.size
    cx0, cy0 = px + (pw - cw) // 2, py + (ph - ch) // 2
    radius, ring = 40, 8
    ring_box = (cx0 - ring, cy0 - ring, cx0 + cw + ring, cy0 + ch + ring)
    _shadow(bg, ring_box, radius + ring)
    _paste_rr(bg, ring_box, radius + ring, S["ring"])
    bg.paste(fg, (cx0, cy0), _rr_mask(fg.size, radius))

    d = ImageDraw.Draw(bg)

    # Business pill
    bf = _F(26, True)
    btxt = _truncate(d, biz.upper(), bf, W - 220)
    bw = d.textlength(btxt, font=bf) + 56
    bx0 = (W - bw) / 2
    d.rounded_rectangle([bx0, L["pill_y"], bx0 + bw, L["pill_y"] + 56], radius=28, fill=S["accent"])
    _t(d, ((bx0 + bx0 + bw) / 2, L["pill_y"] + 28), btxt, bf, S["on_accent"], "mm")

    # Headline
    lines, hf, lh = _fit(d, headline, True, W - 140, L["head_h"], L["head_max"], 40, L["head_lines"])
    y = L["head_y"] + (L["head_h"] - len(lines) * lh) // 2
    for ln in lines:
        _ctext(d, W / 2, y, ln, hf, S["text"])
        y += lh

    # Offer tag (inside the card's top-right corner)
    if offer.strip():
        of = _F(30, True)
        ot = _truncate(d, offer.strip().upper(), of, min(380, cw - 80))
        ow = d.textlength(ot, font=of) + 48
        ox1 = cx0 + cw - 18
        ox0 = ox1 - ow
        oy0 = cy0 + 18
        d.rounded_rectangle([ox0, oy0, ox1, oy0 + 60], radius=30, fill=(239, 68, 68))
        _t(d, ((ox0 + ox1) / 2, oy0 + 30), ot, of, (255, 255, 255), "mm")

    # Price badge overlapping the card's bottom-left
    price_txt = _fmt_price(price)
    size = 54
    while size > 24 and d.textlength(price_txt, font=_F(size, True)) > 500:
        size -= 2
    prf, lab = _F(size, True), _F(22, False)
    badge_w = max(d.textlength(price_txt, font=prf), d.textlength("BEI", font=lab)) + 56
    badge_h = 112
    bx0 = max(24, cx0 - 16)
    by0 = cy0 + ch - badge_h // 2
    _shadow(bg, (bx0, by0, bx0 + badge_w, by0 + badge_h), 28, offset=(4, 10), blur=12, alpha=120)
    d.rounded_rectangle([bx0, by0, bx0 + badge_w, by0 + badge_h], radius=28, fill=S["accent"])
    _ctext(d, bx0 + badge_w / 2, by0 + 12, "BEI", lab, S["on_accent"])
    _ctext(d, bx0 + badge_w / 2, by0 + 40, price_txt, prf, S["on_accent"])

    # Contact pill
    if phone.strip():
        cf = _F(30, True)
        ctxt = _truncate(d, f"Piga / WhatsApp: {phone.strip()}", cf, W - 160)
        cwid = d.textlength(ctxt, font=cf) + 64
        cyy = py + ph + 84
        x0 = (W - cwid) / 2
        d.rounded_rectangle([x0, cyy, x0 + cwid, cyy + 66], radius=33, fill=S["pill"])
        _t(d, (W / 2, cyy + 33), ctxt, cf, S["on_pill"], "mm")

    # Footer (this single block is what a paid "no watermark" version would skip)
    _ctext(d, W / 2, L["foot_y"], "Imetengenezwa na Wakalabot  ·  wakalabot.co.tz", _F(22, False), S["muted"])
    return _jpeg(bg)


@router.post("/product-ad")
@limiter.limit("6/minute")
async def generate_product_ad(
    request: Request,
    image: UploadFile = File(...),
    price: str = Form(..., min_length=1, max_length=30),
    product_name: str = Form(..., min_length=2, max_length=80),
    business_name: str = Form(..., min_length=2, max_length=50),
    phone: str = Form(default="", max_length=20),
    headline: str = Form(default="", max_length=70),
    offer: str = Form(default="", max_length=24),
    style: str = Form(default="giza"),
    fmt: str = Form(default="square"),
):
    if image.content_type not in ("image/jpeg", "image/png", "image/webp"):
        raise HTTPException(status_code=400, detail="Tumia picha ya JPG, PNG au WebP.")
    data = await image.read()
    if len(data) > 8 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Picha ni kubwa mno. Tumia chini ya 8MB.")
    try:
        photo = _flatten(ImageOps.exif_transpose(Image.open(io.BytesIO(data))))
    except Exception:
        raise HTTPException(status_code=400, detail="Picha haisomeki. Jaribu nyingine.")
    photo.thumbnail((2000, 2000))   # uploads are processed in memory and never stored

    final_headline = headline.strip() or await _make_headline(product_name.strip())
    jpg = await asyncio.to_thread(
        _render_ad, photo, price, business_name.strip(), phone, final_headline, offer,
        style if style in _STYLES else "giza", fmt if fmt in _AD_LAYOUT else "square",
    )
    return Response(content=jpg, media_type="image/jpeg", headers={"Cache-Control": "no-store"})





from decimal import Decimal, ROUND_HALF_UP


class FeeCalcRequest(BaseModel):
    network: str = Field(..., pattern=r'^(mpesa|tigopesa|airtelmoney|halopesa)$')
    transaction_type: str = Field(..., pattern=r'^(send|withdraw)$')
    amount: int = Field(..., gt=0, le=10_000_000)


# Fee tables as of early 2026 — these change periodically, update the
# numbers here when networks announce new tariffs. Values are TZS.
# Each entry: (min_amount_inclusive, max_amount_inclusive, fee)
_FEE_TABLES = {
    "mpesa": {
        "send": [
            (1, 1000, 0), (1001, 1500, 30), (1501, 3000, 33), (3001, 5000, 55),
            (5001, 10000, 88), (10001, 20000, 165), (20001, 50000, 275),
            (50001, 150000, 440), (150001, 300000, 715), (300001, 500000, 935),
            (500001, 1000000, 1210), (1000001, 3000000, 3025), (3000001, 10_000_000, 5280),
        ],
        "withdraw": [
            (1, 1000, 0), (1001, 1500, 33), (1501, 5000, 55), (5001, 10000, 88),
            (10001, 20000, 165), (20001, 50000, 275), (50001, 150000, 440),
            (150001, 300000, 715), (300001, 500000, 935), (500001, 1000000, 1210),
            (1000001, 3000000, 3025), (3000001, 10_000_000, 5280),
        ],
    },
    "tigopesa": {
        "send": [
            (1, 1000, 0), (1001, 5000, 60), (5001, 20000, 180),
            (20001, 100000, 400), (100001, 500000, 850), (500001, 10_000_000, 1800),
        ],
        "withdraw": [
            (1, 1000, 0), (1001, 5000, 60), (5001, 20000, 180),
            (20001, 100000, 400), (100001, 500000, 850), (500001, 10_000_000, 1800),
        ],
    },
    "airtelmoney": {
        "send": [
            (1, 1000, 0), (1001, 5000, 55), (5001, 20000, 170),
            (20001, 100000, 390), (100001, 500000, 800), (500001, 10_000_000, 1700),
        ],
        "withdraw": [
            (1, 1000, 0), (1001, 5000, 55), (5001, 20000, 170),
            (20001, 100000, 390), (100001, 500000, 800), (500001, 10_000_000, 1700),
        ],
    },
    "halopesa": {
        "send": [
            (1, 1000, 0), (1001, 5000, 50), (5001, 20000, 160),
            (20001, 100000, 370), (100001, 500000, 780), (500001, 10_000_000, 1650),
        ],
        "withdraw": [
            (1, 1000, 0), (1001, 5000, 50), (5001, 20000, 160),
            (20001, 100000, 370), (100001, 500000, 780), (500001, 10_000_000, 1650),
        ],
    },
}

_NETWORK_LABELS = {
    "mpesa": "M-Pesa", "tigopesa": "Tigo Pesa",
    "airtelmoney": "Airtel Money", "halopesa": "HaloPesa",
}


def _lookup_fee(network: str, txn_type: str, amount: int) -> int:
    table = _FEE_TABLES[network][txn_type]
    for lo, hi, fee in table:
        if lo <= amount <= hi:
            return fee
    return table[-1][2]  # fallback to highest bracket fee if amount exceeds table


@router.post("/mobile-money-fee")
@limiter.limit("20/minute")
async def calculate_mobile_money_fee(request: Request, payload: FeeCalcRequest) -> dict:
    fee = _lookup_fee(payload.network, payload.transaction_type, payload.amount)
    net_amount = payload.amount - fee if payload.transaction_type == "withdraw" else payload.amount
    return {
        "network": _NETWORK_LABELS[payload.network],
        "transaction_type": payload.transaction_type,
        "amount": payload.amount,
        "fee": fee,
        "total_cost": payload.amount + fee if payload.transaction_type == "send" else payload.amount,
        "net_received": net_amount,
        "disclaimer": "Bei hizi ni makisio. Thibitisha na mtoa huduma wako kwa usahihi kamili.",
    }


@router.get("/mobile-money-fee/compare")
@limiter.limit("20/minute")
async def compare_all_networks(request: Request, amount: int, transaction_type: str = "send") -> dict:
    if transaction_type not in ("send", "withdraw"):
        raise HTTPException(status_code=400, detail="Invalid transaction_type")
    if amount <= 0 or amount > 10_000_000:
        raise HTTPException(status_code=400, detail="Invalid amount")

    results = []
    for network, label in _NETWORK_LABELS.items():
        fee = _lookup_fee(network, transaction_type, amount)
        results.append({"network": label, "network_id": network, "fee": fee})

    results.sort(key=lambda r: r["fee"])
    return {"amount": amount, "transaction_type": transaction_type, "networks": results}



from datetime import datetime

# ── Text-fitting helpers (shared by receipt and price list) ──────────────────

def _load_mono(size: int, bold: bool = False):
    names = (
        ["DejaVuSansMono-Bold.ttf", "DejaVuSans-Bold.ttf"]
        if bold else
        ["DejaVuSansMono.ttf", "DejaVuSans.ttf"]
    )
    for name in names:
        try:
            return ImageFont.truetype(name, size)
        except Exception:
            continue
    try:
        return ImageFont.load_default(size)
    except TypeError:
        return ImageFont.load_default()


def _truncate(draw, text: str, font, max_width: float) -> str:
    if draw.textlength(text, font=font) <= max_width:
        return text
    while text and draw.textlength(text + "...", font=font) > max_width:
        text = text[:-1]
    return text + "..."


def _wrap(draw, text: str, font, max_width: float, max_lines: int = 2) -> list[str]:
    lines, cur = [], ""
    for word in text.split():
        trial = f"{cur} {word}".strip()
        if draw.textlength(trial, font=font) <= max_width:
            cur = trial
        else:
            if cur:
                lines.append(cur)
            cur = word
            while draw.textlength(cur, font=font) > max_width and len(cur) > 1:
                cur = cur[:-1]
    if cur:
        lines.append(cur)
    if len(lines) > max_lines:
        lines = lines[:max_lines]
        lines[-1] = _truncate(draw, lines[-1] + "...", font, max_width)
    return lines or [""]


def _dashed(draw, y: int, x1: int, x2: int, color, dash: int = 8, gap: int = 6):
    x = x1
    while x < x2:
        draw.line([(x, y), (min(x + dash, x2), y)], fill=color, width=2)
        x += dash + gap



import io
import random
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse
from PIL import Image, ImageDraw, ImageFont
from pydantic import BaseModel, Field
from google import genai
from google.genai import types

from app.core import settings
from app.limiter import limiter


# ── Receipt / Invoice ─────────────────────────────────────────────────────────

class ReceiptItem(BaseModel):
    name: str = Field(..., min_length=1, max_length=80)
    quantity: int = Field(..., ge=1, le=9999)
    unit_price: int = Field(..., ge=0, le=1_000_000_000)


class ReceiptRequest(BaseModel):
    doc_type: str = Field(default="receipt", pattern=r'^(receipt|invoice)$')
    business_name: str = Field(..., min_length=2, max_length=60)
    customer_name: str = Field(default="", max_length=60)
    due_date: str = Field(default="", max_length=20)
    items: list[ReceiptItem] = Field(..., min_length=1, max_length=15)


@router.post("/receipt-image")
@limiter.limit("10/minute")
async def generate_receipt_image(request: Request, payload: ReceiptRequest):
    is_invoice = payload.doc_type == "invoice"
    now = datetime.now(timezone(timedelta(hours=3)))  # East Africa Time, no DST
    rng = random.Random(now.strftime("%y%m%d%H%M%S") + payload.business_name)
    doc_no = f"{now:%y%m%d}-{rng.randint(1000, 9999)}"

    PAPER_W, PAD, MARGIN = 580, 32, 30
    CW = PAPER_W - 2 * PAD
    ink, muted, rule = (28, 28, 30), (110, 110, 118), (150, 150, 158)

    # Draw on a tall scratch layer, track y, then crop to the real height.
    layer = Image.new("RGB", (PAPER_W, 3200), (255, 255, 255))
    d = ImageDraw.Draw(layer)
    y = 44

    def center(text, font, fill, gap):
        nonlocal y
        text = _truncate(d, text, font, CW)
        w = d.textlength(text, font=font)
        d.text(((PAPER_W - w) / 2, y), text, font=font, fill=fill)
        y += gap

    def meta_row(label, value):
        nonlocal y
        f = _load_mono(20)
        lw = d.textlength(label, font=f)
        value = _truncate(d, value, f, CW - lw - 12)
        vw = d.textlength(value, font=f)
        d.text((PAD, y), label, font=f, fill=muted)
        d.text((PAPER_W - PAD - vw, y), value, font=f, fill=ink)
        y += 30

    # Header
    name_font = _load_mono(32, bold=True)
    for line in _wrap(d, payload.business_name.upper(), name_font, CW, 2):
        center(line, name_font, ink, 40)
    y += 2
    center("INVOICE" if is_invoice else "RISITI YA MAUZO", _load_mono(20, bold=True), muted, 36)
    _dashed(d, y, PAD, PAPER_W - PAD, rule)
    y += 20

    # Meta
    meta_row("Tarehe:", now.strftime("%d/%m/%Y"))
    meta_row("Saa:", now.strftime("%H:%M"))
    meta_row("Na.:", doc_no)
    if payload.customer_name.strip():
        meta_row("Mteja:", payload.customer_name.strip())
    if is_invoice and payload.due_date.strip():
        meta_row("Lipa kabla ya:", payload.due_date.strip())
    y += 4
    _dashed(d, y, PAD, PAPER_W - PAD, rule)
    y += 22

    # Items — stacked so large numbers can never collide
    total, units = 0, 0
    item_font = _load_mono(22, bold=True)
    for it in payload.items:
        line_total = it.quantity * it.unit_price
        total += line_total
        units += it.quantity

        for ln in _wrap(d, it.name, item_font, CW, 2):
            d.text((PAD, y), ln, font=item_font, fill=ink)
            y += 28

        left, right = f"{it.quantity} x {it.unit_price:,}", f"{line_total:,}"
        size = 22
        while size > 12:
            lf, rf = _load_mono(size), _load_mono(size, bold=True)
            if d.textlength(left, font=lf) + d.textlength(right, font=rf) + 20 <= CW:
                break
            size -= 1
        lf, rf = _load_mono(size), _load_mono(size, bold=True)
        d.text((PAD, y), left, font=lf, fill=muted)
        d.text((PAPER_W - PAD - d.textlength(right, font=rf), y), right, font=rf, fill=ink)
        y += 42

    _dashed(d, y, PAD, PAPER_W - PAD, rule)
    y += 20
    d.text((PAD, y), f"Bidhaa: {len(payload.items)}   Idadi: {units:,}", font=_load_mono(18), fill=muted)
    y += 38

    # Total — font shrinks until label + amount fit on one line
    total_text = f"{total:,} TZS"
    size = 34
    while size > 12:
        f = _load_mono(size, bold=True)
        if d.textlength("JUMLA", font=f) + d.textlength(total_text, font=f) + 16 <= CW:
            break
        size -= 1
    f = _load_mono(size, bold=True)
    d.text((PAD, y), "JUMLA", font=f, fill=ink)
    d.text((PAPER_W - PAD - d.textlength(total_text, font=f), y), total_text, font=f, fill=ink)
    y += size + 18
    d.line([(PAD, y), (PAPER_W - PAD, y)], fill=ink, width=3)
    y += 28

    # Footer
    if is_invoice:
        center("TAFADHALI LIPA KWA WAKATI", _load_mono(22, bold=True), ink, 32)
        center("Asante!", _load_mono(19), muted, 36)
    else:
        center("ASANTE KWA KUNUNUA!", _load_mono(24, bold=True), ink, 32)
        center("Karibu tena.", _load_mono(19), muted, 36)

    # Decorative barcode, seeded by the document number
    brng = random.Random(doc_no)
    x, x_end = PAD + 70, PAPER_W - PAD - 70
    while x < x_end:
        bw = brng.choice([2, 2, 3, 4, 6])
        d.rectangle([x, y, x + bw - 1, y + 52], fill=ink)
        x += bw + brng.choice([2, 3, 4])
    y += 62
    center(doc_no, _load_mono(16), muted, 30)
    center("Imetengenezwa na Wakalabot", _load_mono(16), muted, 22)
    center("wakalabot.co.tz", _load_mono(16, bold=True), ink, 0)
    y += 40

    # Compose: paper with torn zigzag edges and a soft shadow
    H = int(y)
    layer = layer.crop((0, 0, PAPER_W, H))
    canvas = Image.new("RGB", (PAPER_W + 2 * MARGIN, H + 2 * MARGIN), (228, 230, 235))
    n, depth = 40, 9

    def zig(x0, top, bottom):
        pts = [(x0 + i * PAPER_W / n, top + (depth if i % 2 else 0)) for i in range(n + 1)]
        pts += [(x0 + i * PAPER_W / n, bottom - (depth if i % 2 else 0)) for i in range(n, -1, -1)]
        return pts

    ImageDraw.Draw(canvas).polygon(zig(MARGIN + 4, MARGIN + 6, MARGIN + H + 6), fill=(205, 207, 213))
    mask = Image.new("L", (PAPER_W, H), 0)
    ImageDraw.Draw(mask).polygon(zig(0, 0, H), fill=255)
    canvas.paste(layer, (MARGIN, MARGIN), mask)

    buf = io.BytesIO()
    canvas.save(buf, format="PNG")
    buf.seek(0)
    return StreamingResponse(
        buf, media_type="image/png",
        headers={"Content-Disposition": "inline; filename=receipt.png"},
    )