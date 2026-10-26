"""Studio posters with 2 or 3 photos: 4 designs for each count, x 8 palettes x 4 sizes.
The first photo is the main one. Text shrinks and wraps; it is never cut with "..."."""
import io
import math
import random
from functools import lru_cache

from PIL import Image, ImageDraw, ImageFilter

from app.studio_draw import _cover, _gradient, _jpeg, _paste_circle, _paste_rr, _rr_mask, _shadow
from app.studio_templates import (
    PALETTES, PALETTE_IDS, _arch_mask, _band, _biz_pill, _circle_mask, _contact, _ctx, _footer,
    _headline, _offer, _price_circle, _tilted,
)

MULTI_NAMES = {
    2: {"pacha": "Pacha", "ndani": "Picha Ndani", "mshazari": "Mshazari", "mapacha": "Polaroid Mbili",
        "duara2": "Duara Mbili", "dirisha2": "Dirisha Mbili", "fremu2": "Fremu Mbili", "hexa2": "Pembe Sita"},
    3: {"kuu": "Kuu na Mbili", "filamu": "Filamu", "shabiki": "Polaroid Tatu", "mozaiki": "Mozaiki",
        "hexa3": "Sega la Asali", "penta": "Pembe Tano", "fremu3": "Fremu Tatu", "duara3": "Miduara Mitatu"},
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


# ── shape helpers for the newer designs ───────────────────────────────────────
def _ngon(cx, cy, r, n, rot=-90.0):
    """Corners of a regular polygon (n=5 pentagon, n=6 hexagon). rot=-90 points one corner up."""
    return [(cx + r * math.cos(math.radians(rot + 360.0 * k / n)),
             cy + r * math.sin(math.radians(rot + 360.0 * k / n))) for k in range(n)]


def _poly_mask(size, pts):
    s = 3                                    # draw 3x bigger, then shrink: smooth edges
    m = Image.new("L", (size * s, size * s), 0)
    ImageDraw.Draw(m).polygon([(x * s, y * s) for x, y in pts], fill=255)
    return m.resize((size, size), Image.Resampling.LANCZOS)


def _poly_photo(img, photo, cx, cy, r, n, rot=-90.0, ring=None, ring_w=0):
    r = int(r)
    if r < 24:
        return
    size = int(2 * (r + ring_w * 1.3)) + 10
    ox, oy = int(cx - size / 2), int(cy - size / 2)
    inner = [(x - ox, y - oy) for x, y in _ngon(cx, cy, r, n, rot)]
    mask = _poly_mask(size, inner)
    shadow = mask.filter(ImageFilter.GaussianBlur(14)).point(lambda v: int(v * 0.5))
    img.paste(Image.new("RGB", (size, size), (0, 0, 0)), (ox, oy + 12), shadow)
    if ring:
        outer = [(x - ox, y - oy) for x, y in _ngon(cx, cy, r + ring_w * 1.3, n, rot)]
        img.paste(Image.new("RGB", (size, size), tuple(ring)), (ox, oy), _poly_mask(size, outer))
    img.paste(_cover(photo, size, size), (ox, oy), mask)


def _frame_layer(photo, w, h, frame_rgb, fw=12, mw=14):
    """A picture frame (coloured border + white mat) as an RGBA layer, ready for _tilted()."""
    layer = Image.new("RGBA", (w, h), tuple(frame_rgb) + (255,))
    ImageDraw.Draw(layer).rectangle([fw, fw, w - 1 - fw, h - 1 - fw], fill=(250, 250, 247, 255))
    iw, ih = w - 2 * (fw + mw), h - 2 * (fw + mw)
    if iw > 10 and ih > 10:
        layer.paste(_cover(photo, iw, ih).convert("RGBA"), (fw + mw, fw + mw))
    return layer


# ── 4 more designs for 2 photos ───────────────────────────────────────────────
def _duara2(c):                      # two overlapping circles, the second a little lower
    p = c.p
    img, d, y = _base(c)
    y = _head(c, d, y)
    cy, y_end = _zone(c, y, 100 if c.price else 0)
    area = max(300, int(y_end - y))
    pad = 56
    stag = 0.16 if area > 640 else 0.0
    D = int(min((c.W - 2 * pad) / 1.85, area / (1 + stag) - 14))
    ov = int(D * 0.15)
    x0 = (c.W - (2 * D - ov)) // 2
    top = y + (area - D * (1 + stag)) / 2
    for i in range(2):
        ccx = x0 + D / 2 + i * (D - ov)
        ccy = top + D / 2 + i * D * stag
        _shadow(img, (ccx - D / 2, ccy - D / 2, ccx + D / 2, ccy + D / 2), D // 2, offset=(0, 14), blur=16, alpha=120)
        _paste_circle(img, ccx, ccy, D / 2 + 8, p["accent"])
        img.paste(_cover(c.photos[i], D, D), (int(ccx - D / 2), int(ccy - D / 2)), _circle_mask(D))
    d = ImageDraw.Draw(img)
    if c.price:
        _price_circle(c, img, d, x0 + D - ov / 2, top + D * (1 + stag) - 6, 90 if c.tall else 84)
    _offer(c, d, c.W - pad - 10, top + 20)
    _contact(c, d, cy)
    _footer(c, d, p["muted"])
    return img


def _dirisha2(c):                    # two arched windows, the second one a little lower
    p = c.p
    img, d, y = _base(c)
    y = _head(c, d, y)
    cy, y_end = _zone(c, y, 100 if c.price else 0)
    area = max(300, int(y_end - y))
    pad, gap, ring = 64, 28, 9
    pw = (c.W - 2 * pad - gap) // 2
    stag = 46 if area > 460 else 0
    ph = max(int(min(area - stag, pw * 1.6)), pw // 2 + 80)
    top = int(y + (area - stag - ph) / 2)
    for i in range(2):
        x0 = pad + i * (pw + gap)
        yy = top + i * stag
        rm = _arch_mask(pw + 2 * ring, ph + 2 * ring)
        img.paste(Image.new("RGB", rm.size, tuple(p["accent"])), (x0 - ring, yy - ring), rm)
        img.paste(_cover(c.photos[i], pw, ph), (x0, yy), _arch_mask(pw, ph))
    d = ImageDraw.Draw(img)
    if c.price:
        _price_circle(c, img, d, c.W / 2, top + stag + ph - 4, 90 if c.tall else 84)
    _offer(c, d, c.W - pad - 12, top + 20)
    _contact(c, d, cy)
    _footer(c, d, p["muted"])
    return img


def _fremu2(c):                      # two framed pictures, slightly tilted, like a gallery wall
    p = c.p
    img, d, y = _base(c)
    y = _head(c, d, y)
    cy, y_end = _zone(c, y, 100 if c.price else 0)
    area = max(300, int(y_end - y))
    pad, gap = 64, 36
    inner = c.W - 2 * pad
    wA, wB = int(inner * 0.55), int(inner * 0.39)
    hA = int(min(area - 40, wA * 1.3))
    hB = int(min(hA * 0.86, wB * 1.2))
    top = y + (area - (hA + 30)) / 2
    _tilted(img, _frame_layer(c.photos[0], wA, hA, p["accent"], 12, 14), pad + wA / 2, top + hA / 2, -2.5)
    _tilted(img, _frame_layer(c.photos[1], wB, hB, p["accent"], 10, 12),
            pad + inner - wB / 2, top + hA + 30 - hB / 2, 3)
    d = ImageDraw.Draw(img)
    if c.price:
        _price_circle(c, img, d, pad + wA + gap / 2, top + hA + 10, 88 if c.tall else 82)
    _offer(c, d, c.W - pad - 10, top + 16)
    _contact(c, d, cy)
    _footer(c, d, p["muted"])
    return img


def _hexa2(c):                       # two hexagon photos, the second one lower
    p = c.p
    img, d, y = _base(c)
    y = _head(c, d, y)
    cy, y_end = _zone(c, y, 100 if c.price else 0)
    area = max(300, int(y_end - y))
    gap = 26
    R = int(min((c.W - 120 - gap) / (2 * math.sqrt(3)), area / 2.6))
    hexw = math.sqrt(3) * R
    stag = 0.45 * R
    mid_y = y + area / 2 - stag / 2
    for i in range(2):
        ccx = c.W / 2 + (-1 if i == 0 else 1) * (hexw + gap) / 2
        _poly_photo(img, c.photos[i], ccx, mid_y + i * stag, R, 6, -90, p["accent"], 7)
    d = ImageDraw.Draw(img)
    if c.price:
        _price_circle(c, img, d, c.W / 2, mid_y + stag + R * 0.92, 90 if c.tall else 84)
    _offer(c, d, c.W - 64, y + 12)
    _contact(c, d, cy)
    _footer(c, d, p["muted"])
    return img


# ── 4 more designs for 3 photos ───────────────────────────────────────────────
def _hexa3(c):                       # honeycomb: a row of three on short posters, a triangle on tall ones
    p = c.p
    img, d, y = _base(c)
    y = _head(c, d, y)
    cy, y_end = _zone(c, y, 100 if c.price else 0)
    area = max(300, int(y_end - y))
    gap, s3 = 24, math.sqrt(3)
    inner = c.W - 120
    r_row = min((inner - 2 * gap) / (3 * s3), area / 2.3)
    r_tri = min((inner - gap) / (2 * s3), area / 3.7)
    if r_row >= r_tri:
        R = int(r_row)
        hexw = s3 * R
        mid = y + area / 2
        spots = [(c.W / 2 - hexw - gap, mid, 1), (c.W / 2, mid, 0), (c.W / 2 + hexw + gap, mid, 2)]
        price_at = (c.W / 2 + hexw / 2 + gap / 2, mid + R * 0.92)
    else:
        R = int(r_tri)
        hexw = s3 * R
        row_h = 1.5 * R + gap * 0.9
        top_y = y + (area - (2 * R + row_h)) / 2 + R
        spots = [(c.W / 2 - (hexw + gap) / 2, top_y, 0), (c.W / 2 + (hexw + gap) / 2, top_y, 1),
                 (c.W / 2, top_y + row_h, 2)]
        price_at = (c.W / 2 + hexw * 0.58, top_y + row_h + R * 0.72)
    for ccx, ccy, idx in spots:
        _poly_photo(img, c.photos[idx], ccx, ccy, R, 6, -90, p["accent"], 7)
    d = ImageDraw.Draw(img)
    if c.price:
        _price_circle(c, img, d, price_at[0], price_at[1], 90 if c.tall else 84)
    _offer(c, d, c.W - 64, y + 12)
    _contact(c, d, cy)
    _footer(c, d, p["muted"])
    return img


def _penta(c):                       # main photo in a pentagon, the other two as round photos at its feet
    p = c.p
    img, d, y = _base(c)
    y = _head(c, d, y)
    cy, y_end = _zone(c, y, 100 if c.price else 0)
    area = max(300, int(y_end - y))
    R = int(min((c.W - 140) / 2.75, area / 2.05))
    rc = int(R * 0.36)
    py = y + (area - 1.95 * R) / 2 + R
    _poly_photo(img, c.photos[0], c.W / 2, py, R, 5, -90, p["accent"], 8)
    for sgn, idx in ((-1, 1), (1, 2)):
        ccx, ccy = c.W / 2 + sgn * 0.98 * R, py + 0.58 * R
        _shadow(img, (ccx - rc, ccy - rc, ccx + rc, ccy + rc), rc, offset=(0, 12), blur=14, alpha=120)
        _paste_circle(img, ccx, ccy, rc + 8, p["accent"])
        img.paste(_cover(c.photos[idx], 2 * rc, 2 * rc), (int(ccx - rc), int(ccy - rc)), _circle_mask(2 * rc))
    d = ImageDraw.Draw(img)
    if c.price:
        _price_circle(c, img, d, c.W / 2, py + 0.84 * R, 88 if c.tall else 82)
    _offer(c, d, c.W - 64, y + 10)
    _contact(c, d, cy)
    _footer(c, d, p["muted"])
    return img


def _fremu3(c):                      # gallery wall: one large frame and two smaller ones, slightly tilted
    p = c.p
    img, d, y = _base(c)
    y = _head(c, d, y)
    cy, y_end = _zone(c, y, 100 if c.price else 0)
    area = max(320, int(y_end - y))
    pad, gap = 60, 34
    inner = c.W - 2 * pad
    wA = int(inner * 0.54)
    wB = inner - wA - gap
    hA = int(min(area - 24, wA * 1.3))
    hB = (hA - gap) // 2
    top = y + (area - hA) / 2
    bx = pad + wA + gap + wB / 2
    _tilted(img, _frame_layer(c.photos[0], wA, hA, p["accent"], 12, 14), pad + wA / 2, top + hA / 2, -2.2)
    _tilted(img, _frame_layer(c.photos[1], wB, hB, p["accent"], 10, 12), bx, top + hB / 2, 2.6)
    _tilted(img, _frame_layer(c.photos[2], wB, hB, p["accent"], 10, 12), bx, top + hB + gap + hB / 2, -2.6)
    d = ImageDraw.Draw(img)
    if c.price:
        _price_circle(c, img, d, pad + wA - 6, top + hA - 6, 90 if c.tall else 84)
    _offer(c, d, c.W - pad - 6, top + 16)
    _contact(c, d, cy)
    _footer(c, d, p["muted"])
    return img


def _duara3(c):                      # one big round photo and two smaller ones touching it
    p = c.p
    img, d, y = _base(c)
    y = _head(c, d, y)
    cy, y_end = _zone(c, y, 100 if c.price else 0)
    area = max(320, int(y_end - y))
    gap = 18
    Db = int(min((c.W - 120) / 1.5, (area - gap) / 1.2))
    Ds = int(Db * 0.6)
    ov = int(Db * 0.1)
    x0 = (c.W - (Db + Ds - ov)) // 2
    mid = y + area / 2
    spots = [(x0 + Db / 2, mid, Db, 0),
             (x0 + Db - ov + Ds / 2, mid - Ds / 2 - gap / 2, Ds, 1),
             (x0 + Db - ov + Ds / 2, mid + Ds / 2 + gap / 2, Ds, 2)]
    for ccx, ccy, dia, idx in spots:
        r = dia / 2
        _shadow(img, (ccx - r, ccy - r, ccx + r, ccy + r), int(r), offset=(0, 14), blur=16, alpha=120)
        _paste_circle(img, ccx, ccy, r + 8, p["accent"])
        img.paste(_cover(c.photos[idx], dia, dia), (int(ccx - r), int(ccy - r)), _circle_mask(dia))
    d = ImageDraw.Draw(img)
    if c.price:
        _price_circle(c, img, d, x0 + Db * 0.5, mid + Db / 2 + 4, 90 if c.tall else 84)
    _offer(c, d, c.W - 64, y + 12)
    _contact(c, d, cy)
    _footer(c, d, p["muted"])
    return img


_RENDERERS = {
    "pacha": _pacha, "ndani": _ndani, "mshazari": _mshazari, "mapacha": _mapacha,
    "duara2": _duara2, "dirisha2": _dirisha2, "fremu2": _fremu2, "hexa2": _hexa2,
    "kuu": _kuu, "filamu": _filamu, "shabiki": _shabiki, "mozaiki": _mozaiki,
    "hexa3": _hexa3, "penta": _penta, "fremu3": _fremu3, "duara3": _duara3,
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


@lru_cache(maxsize=1024)
def preview_multi_jpeg(template_id: str, palette_id: str, fmt: str, n: int) -> bytes:
    photos = [_sample_photo(i) for i in range(n)]
    img = _render_img(template_id, palette_id, photos, "Bidhaa Bora Kwa Bei Nafuu", "25000", "Punguzo 20%",
                      "Amina Fashion", "0712 345 678", fmt, False)
    img.thumbnail((420, 760))
    out = io.BytesIO()
    img.save(out, "JPEG", quality=80)
    return out.getvalue()