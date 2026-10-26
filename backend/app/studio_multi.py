"""Studio posters with 2 or 3 photos: 4 designs for each count, x 8 palettes x 4 sizes.
The first photo is the main one. Text shrinks and wraps; it is never cut with "..."."""
import io
import random
from functools import lru_cache

from PIL import Image, ImageDraw

from app.studio_draw import _cover, _gradient, _jpeg, _paste_rr, _rr_mask, _shadow
from app.studio_templates import (
    PALETTES, PALETTE_IDS, _band, _biz_pill, _contact, _ctx, _footer, _headline, _offer,
    _price_circle, _tilted,
)

MULTI_NAMES = {
    2: {"pacha": "Pacha", "ndani": "Picha Ndani", "mshazari": "Mshazari", "mapacha": "Polaroid Mbili"},
    3: {"kuu": "Kuu na Mbili", "filamu": "Filamu", "shabiki": "Polaroid Tatu", "mozaiki": "Mozaiki"},
}
MULTI_IDS = {n: tuple(names) for n, names in MULTI_NAMES.items()}
MULTI_LIST = {str(n): [{"id": k, "name": v} for k, v in names.items()] for n, names in MULTI_NAMES.items()}


# ── helpers ───────────────────────────────────────────────────────────────────
def _base(c):
    p = c.p
    img = _gradient(c.W, c.H, p["bg1"], p["bg2"])
    d = ImageDraw.Draw(img)
    y = _biz_pill(c, d, c.top) + 22
    return img, d, y


def _head(c, d, y, color=None):
    hh = 220 if c.tall else 150
    kw = {} if color is None else {"color": color}
    _headline(c, d, 70, y, c.W - 140, hh, 80 if c.tall else 70, **kw)
    return y + hh + 12


def _zone(c, y, reserve):
    """(top of the contact pill, last y a photo may reach). `reserve` leaves room for a price circle."""
    cy = c.cbot - 66
    return cy, cy - 36 - reserve


def _photo(img, photo, box, radius, ring=None, ring_w=0):
    x0, y0, x1, y1 = [int(v) for v in box]
    w, h = x1 - x0, y1 - y0
    if w < 20 or h < 20:
        return
    _shadow(img, (x0, y0, x1, y1), radius, offset=(0, 14), blur=16, alpha=120)
    if ring:
        _paste_rr(img, (x0 - ring_w, y0 - ring_w, x1 + ring_w, y1 + ring_w), radius + ring_w, ring)
    img.paste(_cover(photo, w, h), (x0, y0), _rr_mask((w, h), radius))


def _polaroid(photo, cw, chh, m=16, cap=42):
    layer = Image.new("RGBA", (cw, chh), (0, 0, 0, 0))
    ImageDraw.Draw(layer).rounded_rectangle([0, 0, cw - 1, chh - 1], radius=16, fill=(250, 250, 248, 255))
    layer.paste(_cover(photo, cw - 2 * m, chh - 2 * m - cap).convert("RGBA"), (m, m))
    return layer


# ── 2 photos ──────────────────────────────────────────────────────────────────
def _pacha(c):                       # two framed photos side by side, price at the seam
    p = c.p
    img, d, y = _base(c)
    y = _head(c, d, y)
    cy, y_end = _zone(c, y, 100 if c.price else 0)
    pad, gap = 56, 24
    pw = (c.W - 2 * pad - gap) // 2
    avail = max(260, int(y_end - y))
    ph = min(avail, int(pw * 1.7))
    top = int(y + (avail - ph) // 2)
    for i in range(2):
        x0 = pad + i * (pw + gap)
        _photo(img, c.photos[i], (x0, top, x0 + pw, top + ph), 30, p["accent"], 6)
    d = ImageDraw.Draw(img)
    if c.price:
        _price_circle(c, img, d, c.W / 2, top + ph, 92 if c.tall else 86)
    _offer(c, d, c.W - pad - 14, top + 22)
    _contact(c, d, cy)
    _footer(c, d, p["muted"])
    return img


def _ndani(c):                       # main photo full-bleed, second photo as a tilted polaroid
    p = c.p
    img = _cover(c.photos[0], c.W, c.H)
    _band(img, 0, int(c.H * 0.36), 195, 0)
    _band(img, int(c.H * 0.52), c.H, 0, 230)
    d = ImageDraw.Draw(img)
    y = _biz_pill(c, d, c.top) + 22
    hh = 220 if c.tall else 150
    _headline(c, d, 70, y, c.W - 140, hh, 80 if c.tall else 70, color=(255, 255, 255), shadow=True)
    cy = c.cbot - 66
    cw = int(c.W * 0.42)
    chh = int(cw * 1.2)
    ccx, ccy = c.W - 60 - cw / 2, cy - 34 - chh / 2
    _tilted(img, _polaroid(c.photos[1], cw, chh, 16, 40), ccx, ccy, 5)
    d = ImageDraw.Draw(img)
    if c.price:
        _price_circle(c, img, d, 60 + 96, cy - 30 - 96, 96)
    _offer(c, d, c.W - 60, int(ccy - chh / 2 - 66))
    _contact(c, d, cy)
    _footer(c, d, (205, 205, 210))
    return img


def _mshazari(c):                    # diagonal split with an accent seam
    p = c.p
    img, d, y = _base(c)
    y = _head(c, d, y)
    cy, y_end = _zone(c, y, 100 if c.price else 0)
    y0 = int(y + 4)
    band_h = max(300, int(y_end - y0))
    mid = c.W / 2
    s = int(band_h * 0.16)
    rx = int(mid - s)
    canvas = Image.new("RGB", (c.W, band_h))
    canvas.paste(_cover(c.photos[1], c.W - rx, band_h), (rx, 0))
    left = Image.new("RGB", (c.W, band_h))
    left.paste(_cover(c.photos[0], int(mid + s), band_h), (0, 0))
    mask = Image.new("L", (c.W, band_h), 0)
    ImageDraw.Draw(mask).polygon([(0, 0), (mid + s, 0), (mid - s, band_h), (0, band_h)], fill=255)
    canvas.paste(left, (0, 0), mask)
    ImageDraw.Draw(canvas).polygon(
        [(mid + s - 9, 0), (mid + s + 9, 0), (mid - s + 9, band_h), (mid - s - 9, band_h)], fill=p["accent"])
    img.paste(canvas, (0, y0))
    d = ImageDraw.Draw(img)
    if c.price:
        _price_circle(c, img, d, mid - s, y0 + band_h, 92 if c.tall else 86)
    _offer(c, d, c.W - 50, y0 + 22)
    _contact(c, d, cy)
    _footer(c, d, p["muted"])
    return img


def _mapacha(c):                     # two overlapping tilted polaroids
    p = c.p
    img, d, y = _base(c)
    y = _head(c, d, y)
    cy, y_end = _zone(c, y, 100 if c.price else 0)
    area = max(300, int(y_end - y))
    cw = int(min(c.W * 0.50, area * 0.80))
    chh = int(cw * 1.22)
    mid_y = y + area / 2
    for i, (ang, dx) in enumerate(((-6, -0.17), (6, 0.17))):
        _tilted(img, _polaroid(c.photos[i], cw, chh, 18, 44), c.W / 2 + dx * c.W, mid_y, ang)
    d = ImageDraw.Draw(img)
    if c.price:
        _price_circle(c, img, d, c.W / 2, mid_y + chh / 2 - 4, 90 if c.tall else 84)
    _offer(c, d, c.W - 56, int(mid_y - chh / 2 - 8))
    _contact(c, d, cy)
    _footer(c, d, p["muted"])
    return img


# ── 3 photos ──────────────────────────────────────────────────────────────────
def _kuu(c):                         # one big photo on top, two below
    p = c.p
    img, d, y = _base(c)
    y = _head(c, d, y)
    cy, y_end = _zone(c, y, 0)
    pad, gap = 56, 22
    avail = max(380, int(y_end - y))
    hero_h = int(avail * 0.58)
    small_h = avail - hero_h - gap
    x0, x1 = pad, c.W - pad
    _photo(img, c.photos[0], (x0, y, x1, y + hero_h), 32, p["accent"], 6)
    sw = (x1 - x0 - gap) // 2
    ys = y + hero_h + gap
    for i in range(2):
        xx = x0 + i * (sw + gap)
        _photo(img, c.photos[i + 1], (xx, ys, xx + sw, ys + small_h), 26, p["accent"], 5)
    d = ImageDraw.Draw(img)
    if c.price:
        _price_circle(c, img, d, x1 - 74, y + hero_h, 94 if c.tall else 86)
    _offer(c, d, x1 - 14, y + 20)
    _contact(c, d, cy)
    _footer(c, d, p["muted"])
    return img


def _filamu(c):                      # three tall panels, the middle one lower
    p = c.p
    img, d, y = _base(c)
    y = _head(c, d, y)
    cy, y_end = _zone(c, y, 100 if c.price else 0)
    pad, gap, stag = 52, 20, 44
    pw = (c.W - 2 * pad - 2 * gap) // 3
    avail = max(300, int(y_end - y))
    ph = min(avail - stag, int(pw * 2.3))
    top = int(y + (avail - stag - ph) // 2)
    for i in range(3):
        xx = pad + i * (pw + gap)
        off = stag if i == 1 else 0
        _photo(img, c.photos[i], (xx, top + off, xx + pw, top + off + ph), 36, p["accent"], 5)
    d = ImageDraw.Draw(img)
    if c.price:
        _price_circle(c, img, d, c.W / 2, top + stag + ph, 90)
    _offer(c, d, c.W - pad - 12, top + 18)
    _contact(c, d, cy)
    _footer(c, d, p["muted"])
    return img


def _shabiki(c):                     # fan of three polaroids, the main photo in the middle
    p = c.p
    img, d, y = _base(c)
    y = _head(c, d, y)
    cy, y_end = _zone(c, y, 100 if c.price else 0)
    area = max(300, int(y_end - y))
    cw = int(min(c.W * 0.33, area * 0.74))
    chh = int(cw * 1.25)
    mid_y = y + area / 2
    for idx, dx, ang, dy, sc in ((1, -0.265, -8, 14, 1.0), (2, 0.265, 8, 14, 1.0), (0, 0.0, 0, -8, 1.08)):
        w, h = int(cw * sc), int(chh * sc)
        _tilted(img, _polaroid(c.photos[idx], w, h, 16, 42), c.W / 2 + dx * c.W, mid_y + dy, ang)
    d = ImageDraw.Draw(img)
    if c.price:
        _price_circle(c, img, d, c.W / 2, mid_y - 8 + chh * 1.08 / 2 - 4, 90 if c.tall else 84)
    _offer(c, d, c.W - 56, int(mid_y - chh / 2))
    _contact(c, d, cy)
    _footer(c, d, p["muted"])
    return img


def _mozaiki(c):                     # one tall photo on the left, two stacked on the right
    p = c.p
    img, d, y = _base(c)
    y = _head(c, d, y)
    cy, y_end = _zone(c, y, 100 if c.price else 0)
    pad, gap = 56, 22
    area = max(320, int(y_end - y))
    inner = c.W - 2 * pad - gap
    big_w = int(inner * 0.58)
    small_w = inner - big_w
    _photo(img, c.photos[0], (pad, y, pad + big_w, y + area), 34, p["accent"], 6)
    sh = (area - gap) // 2
    sx = pad + big_w + gap
    for i in range(2):
        yy = y + i * (sh + gap)
        _photo(img, c.photos[i + 1], (sx, yy, sx + small_w, yy + sh), 28, p["accent"], 5)
    d = ImageDraw.Draw(img)
    if c.price:
        _price_circle(c, img, d, pad + big_w, y + area, 96 if c.tall else 88)
    _offer(c, d, c.W - pad - 14, y + 20)
    _contact(c, d, cy)
    _footer(c, d, p["muted"])
    return img


_RENDERERS = {
    "pacha": _pacha, "ndani": _ndani, "mshazari": _mshazari, "mapacha": _mapacha,
    "kuu": _kuu, "filamu": _filamu, "shabiki": _shabiki, "mozaiki": _mozaiki,
}


def resolve_multi_choice(template, palette, n):
    ids = MULTI_IDS.get(n) or MULTI_IDS[2]
    tid = template if template in ids else random.choice(ids)
    pid = palette if palette in PALETTES else random.choice(PALETTE_IDS)
    return tid, pid


def _render_img(template_id, palette_id, photos, headline, price, offer, biz, phone, fmt, watermark):
    photos = list(photos)[:3]
    while len(photos) < 2:
        photos.append(photos[0])
    n = 3 if len(photos) >= 3 else 2
    ids = MULTI_IDS[n]
    fn = _RENDERERS[template_id if template_id in ids else ids[0]]
    pal = PALETTES.get(palette_id, PALETTES["giza"])
    c = _ctx(photos[0], headline, price, offer, biz, phone, pal, fmt, watermark)
    c.photos = photos
    return fn(c)


def render_multi(template_id, palette_id, photos, *, headline, price, offer, biz, phone, fmt, watermark=False) -> bytes:
    return _jpeg(_render_img(template_id, palette_id, photos, headline, price, offer, biz, phone, fmt, watermark))


def _sample_photo(i):
    cols = [((255, 190, 120), (240, 120, 90)), ((140, 200, 255), (90, 120, 230)), ((170, 230, 170), (60, 150, 110))]
    a, b = cols[i % 3]
    img = _gradient(800, 800, a, b)
    d = ImageDraw.Draw(img)
    d.ellipse([220, 190, 580, 550], fill=(255, 255, 255))
    d.rounded_rectangle([300, 500, 500, 700], radius=30, fill=(40, 40, 60))
    return img


@lru_cache(maxsize=512)
def preview_multi_jpeg(template_id: str, palette_id: str, fmt: str, n: int) -> bytes:
    photos = [_sample_photo(i) for i in range(n)]
    img = _render_img(template_id, palette_id, photos, "Bidhaa Bora Kwa Bei Nafuu", "25000", "Punguzo 20%",
                      "Amina Fashion", "0712 345 678", fmt, False)
    img.thumbnail((420, 760))
    out = io.BytesIO()
    img.save(out, "JPEG", quality=80)
    return out.getvalue()