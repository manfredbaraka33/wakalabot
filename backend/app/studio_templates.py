"""Studio poster engine: 7 layouts x 8 colour palettes, square + story.
Text is never cut with "...": it shrinks, wraps onto more lines, and only then
shrinks to a hard floor. Form limits keep input sensible on top of that."""
import io
import math
import random
from functools import lru_cache
from types import SimpleNamespace

from PIL import Image, ImageDraw, ImageFilter

from app.studio_draw import (
    _F, _STYLES, _cover, _gradient, _jpeg, _paste_circle, _paste_rr, _rr_mask, _shadow, _t, _fmt_price,
)


# ── Palettes ──────────────────────────────────────────────────────────────────
PALETTES = {k: dict(v) for k, v in _STYLES.items()}   # giza, zumaridi, machweo, safi
PALETTES.update({
    "bahari": {"bg1": (6, 24, 48), "bg2": (10, 62, 110), "accent": (56, 189, 248), "on_accent": (4, 28, 50),
               "text": (255, 255, 255), "muted": (148, 190, 220), "pill": (255, 255, 255), "on_pill": (8, 40, 72),
               "overlay": (6, 26, 52), "ring": (56, 189, 248), "dark": True},
    "waridi": {"bg1": (48, 10, 32), "bg2": (131, 24, 67), "accent": (244, 114, 182), "on_accent": (60, 8, 36),
               "text": (255, 255, 255), "muted": (251, 191, 219), "pill": (255, 255, 255), "on_pill": (80, 10, 45),
               "overlay": (50, 10, 34), "ring": (244, 114, 182), "dark": True},
    "jua": {"bg1": (255, 251, 235), "bg2": (253, 230, 138), "accent": (245, 158, 11), "on_accent": (30, 20, 0),
            "text": (28, 25, 23), "muted": (120, 100, 60), "pill": (28, 25, 23), "on_pill": (255, 251, 235),
            "overlay": (255, 248, 220), "ring": (255, 255, 255), "dark": False},
    "zambarau": {"bg1": (24, 10, 50), "bg2": (76, 29, 149), "accent": (192, 132, 252), "on_accent": (36, 10, 70),
                 "text": (255, 255, 255), "muted": (209, 184, 250), "pill": (255, 255, 255), "on_pill": (40, 12, 80),
                 "overlay": (28, 12, 56), "ring": (192, 132, 252), "dark": True},
})
PALETTE_NAMES = {
    "giza": "Giza", "zumaridi": "Zumaridi", "machweo": "Machweo", "safi": "Safi",
    "bahari": "Bahari", "waridi": "Waridi", "jua": "Jua", "zambarau": "Zambarau",
}
PALETTE_IDS = tuple(PALETTE_NAMES)
PALETTE_LIST = [{
    "id": k, "name": PALETTE_NAMES[k],
    "from": "#%02x%02x%02x" % PALETTES[k]["bg1"], "to": "#%02x%02x%02x" % PALETTES[k]["bg2"],
    "accent": "#%02x%02x%02x" % PALETTES[k]["accent"],
} for k in PALETTE_IDS]


# ── Text fitting (never "...") ────────────────────────────────────────────────
def _wrap(d, text, font, max_w):
    lines, cur = [], ""
    for word in text.split():
        trial = f"{cur} {word}".strip()
        if d.textlength(trial, font=font) <= max_w:
            cur = trial
            continue
        if cur:
            lines.append(cur)
        cur = word
        while d.textlength(cur, font=font) > max_w and len(cur) > 1:  # one huge word: break by characters
            cut = len(cur)
            while cut > 1 and d.textlength(cur[:cut], font=font) > max_w:
                cut -= 1
            lines.append(cur[:cut])
            cur = cur[cut:]
    if cur:
        lines.append(cur)
    return lines or [""]


def _fit_block(d, text, bold, max_w, max_h, max_size, min_size=22, max_lines=3):
    size = max_size
    while True:
        f = _F(size, bold)
        lines, lh = _wrap(d, text, f, max_w), int(size * 1.18)
        if len(lines) <= max_lines and len(lines) * lh <= max_h:
            return lines, f, lh
        if size <= min_size:
            break
        size -= 2
    size = min_size                      # allow more lines, keep shrinking to a hard floor
    while size >= 14:
        f = _F(size, bold)
        lines, lh = _wrap(d, text, f, max_w), int(size * 1.18)
        if len(lines) * lh <= max_h:
            return lines, f, lh
        size -= 1
    f = _F(14, bold)
    return _wrap(d, text, f, max_w), f, 17


def _fit_line(d, text, bold, max_w, max_size, min_size=14):
    size = max_size
    while size > min_size and d.textlength(text, font=_F(size, bold)) > max_w:
        size -= 2
    f = _F(size, bold)
    while len(text) > 1 and d.textlength(text, font=f) > max_w:   # unreachable with the form limits
        text = text[:-1]
    return text, f, size


# ── Drawing primitives ────────────────────────────────────────────────────────
SIZES = {
    "square": (1080, 1080),     # Instagram / Facebook post
    "portrait": (1080, 1350),   # Instagram 4:5 portrait
    "a4": (1080, 1527),         # A4 print flyer (A3 and A5 share the same proportions)
    "story": (1080, 1920),      # Story / WhatsApp Status
}


def _ctx(photo, headline, price, offer, biz, phone, pal, fmt, watermark):
    W, H = SIZES.get(fmt, SIZES["square"])
    tall = H > 1300                                   # roomier text blocks on tall formats
    if fmt == "story":                                # Instagram Story safe zones
        top, bot = 250, H - 340
    elif fmt == "a4":                                 # print margin
        top, bot = 70, H - 70
    else:
        top, bot = 48, H - 48
    return SimpleNamespace(
        photo=photo, headline=" ".join(headline.split()), price=price.strip(), offer=offer.strip(),
        biz=biz.strip(), phone=phone.strip(), p=pal, fmt=fmt, wm=watermark, W=W, H=H,
        story=tall, tall=tall, top=top, bot=bot, cbot=bot - (38 if watermark else 0),
    )


def _pill(d, cx, y, text, fill, color, max_w, size=26, h=56, pad=28):
    text, f, _ = _fit_line(d, text, True, max_w - 2 * pad, size)
    w = d.textlength(text, font=f) + 2 * pad
    x0 = cx - w / 2
    d.rounded_rectangle([x0, y, x0 + w, y + h], radius=h // 2, fill=fill)
    _t(d, (cx, y + h / 2), text, f, color, "mm")


def _biz_pill(c, d, y, fill=None, color=None):
    if not c.biz:
        return y
    _pill(d, c.W / 2, y, c.biz.upper(), fill or c.p["accent"], color or c.p["on_accent"], c.W - 200)
    return y + 56


def _headline(c, d, x, y, w, h, max_size, align="center", color=None, shadow=False):
    lines, f, lh = _fit_block(d, c.headline, True, w, h, max_size)
    yy = y + max(0, (h - len(lines) * lh) // 2)
    for ln in lines:
        lw = d.textlength(ln, font=f)
        tx = x + (w - lw) / 2 if align == "center" else x
        if shadow:
            _t(d, (tx + 3, yy + 3), ln, f, (0, 0, 0))
        _t(d, (tx, yy), ln, f, color or c.p["text"])
        yy += lh


def _contact(c, d, y, fill=None, color=None):
    if c.phone:
        _pill(d, c.W / 2, y, f"Piga / WhatsApp: {c.phone}", fill or c.p["pill"], color or c.p["on_pill"],
              c.W - 160, size=30, h=66, pad=32)


def _offer(c, d, x1, y, max_w=420):
    if not c.offer:
        return
    txt, f, _ = _fit_line(d, c.offer.upper(), True, max_w - 48, 30, 16)
    w = d.textlength(txt, font=f) + 48
    d.rounded_rectangle([x1 - w, y, x1, y + 60], radius=30, fill=(239, 68, 68))
    _t(d, (x1 - w / 2, y + 30), txt, f, (255, 255, 255), "mm")


def _footer(c, d, color):
    if c.wm:
               _t(d, (c.W / 2, c.bot - 28), "Imetengenezwa na Wakalabot Studio  ·  wakalabot.co.tz/studio", _F(22, False), color, "ma")


def _price_badge(c, img, d, x, y, size=56, max_w=520, align="left", vcenter=False, fill=None, ink=None, outline=None):
    txt, f, sz = _fit_line(d, _fmt_price(c.price), True, max_w - 64, size, 22)
    lab = _F(22, False)
    w = int(max(d.textlength(txt, font=f), d.textlength("BEI", font=lab)) + 64)
    h = sz + 62
    left = x - w if align == "right" else x
    top = y - h / 2 if vcenter else y
    box = (int(left), int(top), int(left + w), int(top + h))
    _shadow(img, box, 28, offset=(4, 10), blur=12, alpha=120)
    kw = {"outline": outline, "width": 4} if outline else {}
    d.rounded_rectangle(box, radius=28, fill=fill or c.p["accent"], **kw)
    ink = ink or c.p["on_accent"]
    _t(d, (left + w / 2, top + 12), "BEI", lab, ink, "ma")
    _t(d, (left + w / 2, top + 40), txt, f, ink, "ma")


def _price_circle(c, img, d, cx, cy, r):
    txt = _fmt_price(c.price)
    main, unit = (txt[:-4], "TZS") if txt.endswith(" TZS") else (txt, "")
    _shadow(img, (cx - r, cy - r, cx + r, cy + r), int(r), offset=(4, 10), blur=12, alpha=120)
    _paste_circle(img, cx, cy, r, c.p["accent"])
    main, f, size = _fit_line(d, main, True, r * 1.5, 50, 16)
    _t(d, (cx, cy - (8 if unit else 0)), main, f, c.p["on_accent"], "mm")
    if unit:
        _t(d, (cx, cy + size * 0.62), unit, _F(max(16, int(size * 0.45)), False), c.p["on_accent"], "mm")


def _band(img, y0, y1, a_top, a_bottom):
    h = max(1, y1 - y0)
    grad = Image.linear_gradient("L").resize((img.width, h))
    mask = grad.point(lambda v: int(a_top + (a_bottom - a_top) * v / 255))
    img.paste(Image.new("RGB", (img.width, h), (8, 8, 12)), (0, y0), mask)


def _glow(img, box, radius, color, width=6, blur=18):
    x0, y0, x1, y1 = box
    pad = blur * 3
    mask = Image.new("L", (x1 - x0 + 2 * pad, y1 - y0 + 2 * pad), 0)
    ImageDraw.Draw(mask).rounded_rectangle([pad, pad, pad + x1 - x0, pad + y1 - y0], radius=radius, outline=255, width=width)
    solid = Image.new("RGB", mask.size, color)
    img.paste(solid, (x0 - pad, y0 - pad), mask.filter(ImageFilter.GaussianBlur(blur)))
    img.paste(solid, (x0 - pad, y0 - pad), mask)


def _circle_mask(n):
    m = Image.new("L", (n, n), 0)
    ImageDraw.Draw(m).ellipse([0, 0, n - 1, n - 1], fill=255)
    return m


# ── The 7 layouts ─────────────────────────────────────────────────────────────
def _kadi(c):
    p = c.p
    img = _gradient(c.W, c.H, p["bg1"], p["bg2"])
    _paste_circle(img, c.W - 60, 120, 230, p["accent"], 34)
    _paste_circle(img, 20, c.H - 60, 200, p["accent"], 26)
    d = ImageDraw.Draw(img)
    y = _biz_pill(c, d, c.top) + 22
    hh = 250 if c.story else 170
    _headline(c, d, 70, y, c.W - 140, hh, 84 if c.story else 76)
    y += hh + 18
    cy = c.cbot - 66
    x0, y0, x1, y1 = 90, y, c.W - 90, cy - 90
    ring = 8
    _shadow(img, (x0 - ring, y0 - ring, x1 + ring, y1 + ring), 48, offset=(6, 16), blur=20, alpha=150)
    _paste_rr(img, (x0 - ring, y0 - ring, x1 + ring, y1 + ring), 48, p["ring"])
    img.paste(_cover(c.photo, x1 - x0, y1 - y0), (x0, y0), _rr_mask((x1 - x0, y1 - y0), 40))
    _offer(c, d, x1 - 18, y0 + 18)
    if c.price:
        _price_badge(c, img, d, max(24, x0 - 16), y1 - 56)
    _contact(c, d, cy)
    _footer(c, d, p["muted"])
    return img


def _kubwa(c):
    img = _cover(c.photo, c.W, c.H)
    _band(img, 0, int(c.H * 0.42), 205, 0)
    _band(img, int(c.H * 0.50), c.H, 0, 225)
    d = ImageDraw.Draw(img)
    y = _biz_pill(c, d, c.top) + 22
    hh = 250 if c.story else 190
    _headline(c, d, 70, y, c.W - 140, hh, 92 if c.story else 82, color=(255, 255, 255), shadow=True)
    _offer(c, d, c.W - 60, y + hh + 14)
    cy = c.cbot - 66
    if c.price:
        _price_badge(c, img, d, 60, cy - 150)
    _contact(c, d, cy)
    _footer(c, d, (205, 205, 210))
    return img


def _gawanya(c):
    p = c.p
    img = _gradient(c.W, c.H, p["bg1"], p["bg2"])
    split = int(c.H * (0.50 if c.story else 0.56))
    ph = _cover(c.photo, c.W, split + 70)
    mask = Image.new("L", (c.W, split + 70), 0)
    ImageDraw.Draw(mask).polygon([(0, 0), (c.W, 0), (c.W, split - 70), (0, split + 70)], fill=255)
    img.paste(ph, (0, 0), mask)
    d = ImageDraw.Draw(img)
    d.polygon([(0, split + 70), (c.W, split - 70), (c.W, split - 40), (0, split + 100)], fill=p["accent"])
    _biz_pill(c, d, c.top, fill=p["pill"], color=p["on_pill"])
    _offer(c, d, c.W - 50, split - 190)
    cy = c.cbot - 66
    y0 = split + 130
    block_h = max(120, cy - 24 - y0)
    _headline(c, d, 60, y0, 560 if c.price else c.W - 120, block_h, 70, align="left")
    if c.price:
        _price_badge(c, img, d, c.W - 60, y0 + block_h / 2, size=60, max_w=380, align="right", vcenter=True)
    _contact(c, d, cy)
    _footer(c, d, p["muted"])
    return img


def _duara(c):
    p = c.p
    img = _gradient(c.W, c.H, p["bg1"], p["bg2"])
    _paste_circle(img, c.W * 0.85, c.H * 0.12, 300, p["accent"], 28)
    _paste_circle(img, c.W * 0.10, c.H * 0.90, 260, p["accent"], 24)
    d = ImageDraw.Draw(img)
    y = _biz_pill(c, d, c.top) + 22
    hh = 220 if c.story else 150
    _headline(c, d, 70, y, c.W - 140, hh, 84 if c.story else 72)
    y += hh + 10
    cy = c.cbot - 66
    dia = int(min(c.W - 180, (cy - 30) - y))
    cx, ccy, r = c.W / 2, y + dia / 2, dia / 2
    _paste_circle(img, cx, ccy, r + 26, p["accent"], 70)
    _paste_circle(img, cx, ccy, r + 9, p["ring"])
    img.paste(_cover(c.photo, dia, dia), (int(cx - r), int(y)), _circle_mask(dia))
    _offer(c, d, min(c.W - 40, cx + r), y + 4)
    if c.price:
        _price_circle(c, img, d, cx + r * 0.72, ccy + r * 0.72, 120 if c.story else 96)
    _contact(c, d, cy)
    _footer(c, d, p["muted"])
    return img


def _gazeti(c):
    p = c.p
    img = _gradient(c.W, c.H, p["bg1"], p["bg2"])
    d = ImageDraw.Draw(img)
    y = _biz_pill(c, d, c.top, fill=p["pill"], color=p["on_pill"]) + 26
    d.rectangle([70, y, 230, y + 8], fill=p["accent"])
    y += 30
    hh = 270 if c.story else 190
    _headline(c, d, 70, y, c.W - 140, hh, 96 if c.story else 84, align="left")
    y += hh + 20
    cy = c.cbot - 66
    px0, px1, py1 = 120, c.W - 70, cy - 100
    _paste_rr(img, (px0 - 36, y + 36, px1 - 36, py1 + 36), 32, p["accent"])     # offset colour block
    img.paste(_cover(c.photo, px1 - px0, py1 - y), (px0, y), _rr_mask((px1 - px0, py1 - y), 32))
    _offer(c, d, px1 - 20, y + 20)
    if c.price:
        _price_circle(c, img, d, px1 - 70, py1 - 20, 100 if c.story else 92)
    _contact(c, d, cy)
    _footer(c, d, p["muted"])
    return img


def _neon(c):
    glow = c.p["accent"]
    img = _gradient(c.W, c.H, (8, 8, 14), (24, 12, 36))
    d = ImageDraw.Draw(img)
    y = _biz_pill(c, d, c.top, fill=(18, 18, 28), color=glow) + 22
    hh = 230 if c.story else 160
    _headline(c, d, 70, y, c.W - 140, hh, 88 if c.story else 76, color=(255, 255, 255))
    y += hh + 20
    cy = c.cbot - 66
    box = (110, y, c.W - 110, cy - 100)
    _glow(img, box, 40, glow)
    iw, ih = box[2] - box[0] - 24, box[3] - box[1] - 24
    img.paste(_cover(c.photo, iw, ih), (box[0] + 12, box[1] + 12), _rr_mask((iw, ih), 30))
    _offer(c, d, box[2] - 16, box[1] + 16)
    if c.price:
        _price_badge(c, img, d, box[0] - 10, box[3] - 56, fill=(14, 14, 22), ink=glow, outline=glow)
    _contact(c, d, cy, fill=(18, 18, 28), color=glow)
    _footer(c, d, (120, 120, 140))
    return img


def _mstari(c):
    p = c.p
    img = _gradient(c.W, c.H, p["bg1"], p["bg2"])
    cy = c.cbot - 66
    band_h = 330 if c.story else 270
    band_y = cy - 40 - band_h
    img.paste(_cover(c.photo, c.W, band_y), (0, 0))
    _band(img, 0, 340, 190, 0)
    d = ImageDraw.Draw(img)
    d.rectangle([0, band_y, c.W, band_y + band_h], fill=p["accent"])
    _biz_pill(c, d, c.top, fill=p["pill"], color=p["on_pill"])
    _offer(c, d, c.W - 50, band_y - 80)
    pad, text_w = 56, c.W - 112
    if c.price:
        txt = _fmt_price(c.price)
        main, unit = (txt[:-4], "TZS") if txt.endswith(" TZS") else (txt, "")
        main, f, sz = _fit_line(d, main, True, 420, 120 if c.story else 110, 28)
        right = c.W - pad
        _t(d, (right, band_y + 30), "BEI", _F(24, False), p["on_accent"], "ra")
        _t(d, (right, band_y + 62), main, f, p["on_accent"], "ra")
        if unit:
            _t(d, (right, band_y + 62 + int(sz * 1.25)), unit, _F(max(18, int(sz * 0.4)), True), p["on_accent"], "ra")
        text_w = c.W - 2 * pad - 440
    _headline(c, d, pad, band_y + 24, text_w, band_h - 48, 76, align="left", color=p["on_accent"])
    _contact(c, d, cy)
    _footer(c, d, p["muted"])
    return img



# ── New helpers ───────────────────────────────────────────────────────────────
def _arch_mask(w, h):
    m = Image.new("L", (w, h), 0)
    md = ImageDraw.Draw(m)
    md.ellipse([0, 0, w - 1, w - 1], fill=255)
    md.rectangle([0, w // 2, w - 1, h - 1], fill=255)
    return m


def _star(d, cx, cy, r_out, r_in, n, fill):
    pts = []
    for i in range(n * 2):
        ang = math.pi * i / n - math.pi / 2
        r = r_out if i % 2 == 0 else r_in
        pts.append((cx + r * math.cos(ang), cy + r * math.sin(ang)))
    d.polygon(pts, fill=fill)


def _tilted(img, layer, cx, cy, angle):
    """Paste an RGBA layer rotated by `angle`, centred on (cx, cy), with a soft shadow."""
    rot = layer.rotate(angle, resample=Image.Resampling.BICUBIC, expand=True)
    alpha = rot.split()[3]
    sh = Image.new("L", rot.size, 0)
    sh.paste(alpha.point(lambda v: int(v * 0.55)), (0, 0))
    sh = sh.filter(ImageFilter.GaussianBlur(16))
    x, y = int(cx - rot.width / 2), int(cy - rot.height / 2)
    img.paste(Image.new("RGB", rot.size, (0, 0, 0)), (x + 8, y + 16), sh)
    img.paste(rot.convert("RGB"), (x, y), alpha)


# ── 7 more layouts ────────────────────────────────────────────────────────────
def _fremu(c):                      # Polaroid
    p = c.p
    img = _gradient(c.W, c.H, p["bg1"], p["bg2"])
    d = ImageDraw.Draw(img)
    y = _biz_pill(c, d, c.top) + 28
    cy = c.cbot - 66
    card_h = cy - y - 70
    card_w = min(c.W - 230, int(card_h * 0.82))
    card_h = min(card_h, int(card_w * 1.3))
    m, cap_zone = 28, (190 if c.tall else 150)
    photo_w, photo_h = card_w - 2 * m, card_h - 2 * m - cap_zone
    layer = Image.new("RGBA", (card_w, card_h), (0, 0, 0, 0))
    ld = ImageDraw.Draw(layer)
    ld.rounded_rectangle([0, 0, card_w - 1, card_h - 1], radius=18, fill=(250, 250, 248, 255))
    layer.paste(_cover(c.photo, photo_w, photo_h).convert("RGBA"), (m, m))
    cap_y = m + photo_h + 8
    _headline(c, ld, m, cap_y, photo_w, card_h - cap_y - m + 6, 60, color=(34, 34, 44))
    _tilted(img, layer, c.W / 2, y + card_h / 2 + 10, 3)
    if c.price:
        _price_circle(c, img, d, c.W / 2 + card_w / 2 - 10, y + 90, 105 if c.tall else 92)
    _offer(c, d, c.W / 2 - card_w / 2 + 330, y + 40)
    _contact(c, d, cy)
    _footer(c, d, p["muted"])
    return img


def _dirisha(c):                    # arched window
    p = c.p
    img = _gradient(c.W, c.H, p["bg1"], p["bg2"])
    d = ImageDraw.Draw(img)
    y = _biz_pill(c, d, c.top) + 26
    cy = c.cbot - 66
    head_h = 230 if c.tall else 170
    arch_h = cy - 30 - head_h - y
    arch_w = min(c.W - 300, int(arch_h * 0.80))
    arch_h = max(arch_h, arch_w // 2 + 80)
    x0, ring = (c.W - arch_w) // 2, 12
    rm = _arch_mask(arch_w + 2 * ring, arch_h + 2 * ring)
    img.paste(Image.new("RGB", rm.size, p["accent"]), (x0 - ring, y - ring), rm)
    img.paste(_cover(c.photo, arch_w, arch_h), (x0, y), _arch_mask(arch_w, arch_h))
    _headline(c, d, 70, y + arch_h + 14, c.W - 140, head_h, 76)
    _offer(c, d, min(c.W - 40, x0 + arch_w + 120), y + 30)
    if c.price:
        _price_circle(c, img, d, x0 + arch_w - 10, y + arch_h - 20, 100 if c.tall else 90)
    _contact(c, d, cy)
    _footer(c, d, p["muted"])
    return img


def _lebo(c):                       # hanging price tag
    p = c.p
    img = _cover(c.photo, c.W, c.H)
    _band(img, int(c.H * 0.50), c.H, 0, 230)
    _band(img, 0, 260, 150, 0)
    d = ImageDraw.Draw(img)
    _biz_pill(c, d, c.top)
    cy = c.cbot - 66
    hh = 250 if c.tall else 190
    _headline(c, d, 70, cy - 30 - hh, c.W - 140, hh, 84, color=(255, 255, 255), shadow=True)
    if c.price:
        tx, ty, tw, th = 56, c.top + 110, 330, 400
        _shadow(img, (tx, ty, tx + tw, ty + th), 36, offset=(6, 14), blur=14, alpha=150)
        d.rounded_rectangle([tx, ty, tx + tw, ty + th], radius=36, fill=p["accent"])
        d.line([(tx + tw / 2, ty + 48), (tx + tw / 2 + 60, ty - 40)], fill=(235, 235, 235), width=5)
        d.ellipse([tx + tw / 2 - 22, ty + 26, tx + tw / 2 + 22, ty + 70], fill=(20, 20, 28))
        txt, f, _sz = _fit_line(d, _fmt_price(c.price).replace(" TZS", ""), True, tw - 50, 74, 20)
        _t(d, (tx + tw / 2, ty + 120), "BEI", _F(26, False), p["on_accent"], "ma")
        _t(d, (tx + tw / 2, ty + th / 2 + 14), txt, f, p["on_accent"], "mm")
        _t(d, (tx + tw / 2, ty + th - 70), "TZS", _F(30, True), p["on_accent"], "ma")
    _offer(c, d, c.W - 50, c.top + 110)
    _contact(c, d, cy)
    _footer(c, d, (205, 205, 210))
    return img


def _kioo(c):                       # frosted glass card over the photo
    p = c.p
    img = _cover(c.photo, c.W, c.H)
    _band(img, 0, 260, 150, 0)
    d = ImageDraw.Draw(img)
    _biz_pill(c, d, c.top)
    cy = c.cbot - 66
    card_h = 560 if c.tall else 440
    x0, x1 = 60, c.W - 60
    y1 = cy - 36
    y0 = y1 - card_h
    region = img.crop((x0, y0, x1, y1)).filter(ImageFilter.GaussianBlur(22))
    tint = Image.new("RGB", region.size, p["overlay"] if p["dark"] else (255, 255, 255))
    region = Image.blend(region, tint, 0.58)
    img.paste(region, (x0, y0), _rr_mask(region.size, 48))
    d.rounded_rectangle([x0, y0, x1, y1], radius=48, outline=(255, 255, 255), width=2)
    _headline(c, d, x0 + 40, y0 + 30, x1 - x0 - 80, card_h - 190, 74, align="left", color=p["text"])
    if c.price:
        _price_badge(c, img, d, x0 + 40, y1 - 40 - 118)
    _offer(c, d, x1 - 40, y1 - 40 - 90)
    _contact(c, d, cy)
    _footer(c, d, (230, 230, 235))
    return img


def _pop(c):                        # retro pop with starburst price
    p = c.p
    img = Image.new("RGB", (c.W, c.H), p["accent"])
    d = ImageDraw.Draw(img)
    dot = tuple(max(0, v - 18) for v in p["accent"])
    for gy in range(0, c.H, 54):
        for gx in range((gy // 54 % 2) * 27, c.W, 54):
            d.ellipse([gx, gy, gx + 12, gy + 12], fill=dot)
    y = _biz_pill(c, d, c.top, fill=p["on_accent"], color=p["accent"]) + 22
    hh = 250 if c.tall else 170
    _headline(c, d, 70, y, c.W - 140, hh, 88 if c.tall else 78, color=p["on_accent"])
    y += hh + 14
    cy = c.cbot - 66
    x0, x1, y0, y1 = 100, c.W - 100, y, cy - 50
    off = 18
    d.rounded_rectangle([x0 + off, y0 + off, x1 + off, y1 + off], radius=36, fill=p["on_accent"])
    img.paste(_cover(c.photo, x1 - x0, y1 - y0), (x0, y0), _rr_mask((x1 - x0, y1 - y0), 36))
    d.rounded_rectangle([x0, y0, x1, y1], radius=36, outline=p["on_accent"], width=8)
    _offer(c, d, x1 - 20, y0 + 20)
    if c.price:
        txt = _fmt_price(c.price)
        main, unit = (txt[:-4], "TZS") if txt.endswith(" TZS") else (txt, "")
        sx, sy = x1 - 60, y1 - 20
        _star(d, sx, sy, 150, 120, 14, (255, 255, 255))
        main, f, sz = _fit_line(d, main, True, 190, 52, 16)
        _t(d, (sx, sy - (10 if unit else 0)), main, f, p["on_accent"], "mm")
        if unit:
            _t(d, (sx, sy + sz * 0.7), unit, _F(max(16, int(sz * 0.4)), True), p["on_accent"], "mm")
    _contact(c, d, cy, fill=p["on_accent"], color=p["accent"])
    _footer(c, d, p["on_accent"])
    return img


def _minimal(c):                    # calm, lots of space
    p = c.p
    img = Image.new("RGB", (c.W, c.H), p["bg1"])
    d = ImageDraw.Draw(img)
    y = c.top + 6
    if c.biz:
        t, f, _sz = _fit_line(d, c.biz.upper(), True, c.W - 200, 28, 16)
        _t(d, (c.W / 2, y), t, f, p["accent"], "ma")
    y += 70
    cy = c.cbot - 66
    head_h = 200 if c.tall else 140
    price_h = 100 if c.price else 0
    ph_w = c.W - 200
    ph_h = max(260, cy - 40 - price_h - head_h - 40 - y)
    _shadow(img, (100, y, 100 + ph_w, y + ph_h), 28, offset=(0, 18), blur=22, alpha=110)
    img.paste(_cover(c.photo, ph_w, ph_h), (100, y), _rr_mask((ph_w, ph_h), 28))
    _offer(c, d, 100 + ph_w - 16, y + 16)
    y += ph_h + 26
    d.rectangle([c.W / 2 - 40, y, c.W / 2 + 40, y + 5], fill=p["accent"])
    y += 22
    _headline(c, d, 70, y, c.W - 140, head_h, 66)
    y += head_h
    if c.price:
        txt, f, _sz = _fit_line(d, _fmt_price(c.price), True, c.W - 200, 78, 24)
        _t(d, (c.W / 2, y), txt, f, p["accent"], "ma")
    if c.phone:
        t, f, _sz = _fit_line(d, f"Piga / WhatsApp: {c.phone}", True, c.W - 160, 32, 16)
        _t(d, (c.W / 2, cy + 18), t, f, p["text"], "ma")
    _footer(c, d, p["muted"])
    return img


def _kona(c):                       # big circle bleeding off the corner
    p = c.p
    img = _gradient(c.W, c.H, p["bg1"], p["bg2"])
    d = ImageDraw.Draw(img)
    dia = int(min(900, c.H * 0.56))
    cx, ccy = c.W - 120, c.top + int(dia * 0.42)
    _paste_circle(img, cx, ccy, dia / 2 + 26, p["accent"], 90)
    _paste_circle(img, cx, ccy, dia / 2 + 10, p["ring"])
    img.paste(_cover(c.photo, dia, dia), (int(cx - dia / 2), int(ccy - dia / 2)), _circle_mask(dia))
    if c.biz:
        t, f, _sz = _fit_line(d, c.biz.upper(), True, 380, 30, 16)
        _t(d, (70, c.top + 14), t, f, p["accent"], "la")
    _offer(c, d, 430, c.top + 70)
    cy = c.cbot - 66
    head_y = ccy + dia // 2 + 40
    head_h = max(120, cy - 160 - head_y)
    _headline(c, d, 70, head_y, c.W - 140, head_h, 80, align="left")
    if c.price:
        _price_badge(c, img, d, 70, cy - 135)
    _contact(c, d, cy)
    _footer(c, d, p["muted"])
    return img





_RENDERERS = {
    "kadi": _kadi, "kubwa": _kubwa, "gawanya": _gawanya, "duara": _duara,
    "gazeti": _gazeti, "neon": _neon, "mstari": _mstari,
    "fremu": _fremu, "dirisha": _dirisha, "lebo": _lebo, "kioo": _kioo,
    "pop": _pop, "minimal": _minimal, "kona": _kona,
}
TEMPLATE_NAMES = {
    "kadi": "Kadi", "kubwa": "Picha Kubwa", "gawanya": "Gawanyika", "duara": "Duara",
    "gazeti": "Jarida", "neon": "Neon", "mstari": "Bei Kubwa",
    "fremu": "Polaroid", "dirisha": "Dirisha", "lebo": "Lebo ya Bei", "kioo": "Kioo",
    "pop": "Pop", "minimal": "Minimal", "kona": "Kona",
}

TEMPLATE_IDS = tuple(TEMPLATE_NAMES)
TEMPLATE_LIST = [{"id": k, "name": v} for k, v in TEMPLATE_NAMES.items()]


# ── Public API ────────────────────────────────────────────────────────────────
def resolve_choice(template, palette, ai_palette=None):
    """'random' / 'auto' / unknown -> pick one. 'auto' palette uses the AI's suggestion when given."""
    tid = template if template in TEMPLATE_IDS else random.choice(TEMPLATE_IDS)
    if palette == "auto" and ai_palette in PALETTES:
        pid = ai_palette
    elif palette in PALETTES:
        pid = palette
    else:
        pid = random.choice(PALETTE_IDS)
    return tid, pid


def _render_image(template_id, palette_id, photo, *, headline, price, offer, biz, phone, fmt, watermark):
    pal = PALETTES.get(palette_id, PALETTES["giza"])
    c = _ctx(photo.convert("RGB"), headline, price, offer, biz, phone, pal, fmt, watermark)
    return _RENDERERS.get(template_id, _kadi)(c)


def render_template(template_id, palette_id, photo, *, headline, price, offer, biz, phone, fmt, watermark) -> bytes:
    return _jpeg(_render_image(template_id, palette_id, photo, headline=headline, price=price, offer=offer,
                               biz=biz, phone=phone, fmt=fmt, watermark=watermark))


@lru_cache(maxsize=1)
def _sample_photo():
    img = _gradient(1000, 1000, (255, 214, 170), (233, 120, 90))
    d = ImageDraw.Draw(img)
    d.ellipse([230, 560, 770, 700], fill=(190, 90, 70))
    d.rounded_rectangle([300, 230, 700, 640], radius=70, fill=(250, 250, 250))
    d.rounded_rectangle([340, 280, 660, 600], radius=50, fill=(45, 45, 70))
    d.rounded_rectangle([440, 130, 560, 260], radius=36, fill=(255, 255, 255))
    return img


@lru_cache(maxsize=512)
def preview_jpeg(template_id: str, palette_id: str, fmt: str) -> bytes:
    img = _render_image(template_id, palette_id, _sample_photo(), headline="Vitenge Vipya Vimewasili",
                        price="25000", offer="Punguzo 20%", biz="Amina Fashion", phone="0712 345 678",
                        fmt=fmt, watermark=False)
    img.thumbnail((420, 760))
    out = io.BytesIO()
    img.save(out, "JPEG", quality=80)
    return out.getvalue()