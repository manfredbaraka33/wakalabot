"""Studio price lists: 6 designs x 8 palettes x 4 sizes. Free, with an optional small watermark.
Text shrinks and wraps to fit; it is never cut with "..."."""
import io
import random
import re
from functools import lru_cache
from types import SimpleNamespace

from PIL import Image, ImageDraw, ImageStat

from app.studio_draw import _F, _cover, _gradient, _jpeg, _paste_circle, _paste_rr, _t
from app.studio_templates import (
    PALETTES, PALETTE_IDS, SIZES, _circle_mask, _fit_block, _fit_line, _glow,
)

PL_TEMPLATE_NAMES = {
    "orodha": "Kadi", "menyu": "Menyu", "jedwali": "Jedwali",
    "bango": "Bango", "gridi": "Gridi", "neon": "Neon",
}
PL_TEMPLATE_IDS = tuple(PL_TEMPLATE_NAMES)
PL_TEMPLATE_LIST = [{"id": k, "name": v} for k, v in PL_TEMPLATE_NAMES.items()]


def _num(raw):
    return raw.replace(",", "").replace(".", "").replace(" ", "")


def _price(raw):
    s = raw.strip()
    m = re.match(r"^(kuanzia|ada)\s+([\d][\d,. ]*)$", s, re.IGNORECASE)
    if m and _num(m.group(2)).isdigit():
        return f"{m.group(1).capitalize()} {int(_num(m.group(2))):,}"
    return f"{int(_num(s)):,}" if _num(s).isdigit() else s


def _ctx(items, biz, title, tagline, phone, logo, pal, fmt, watermark=False):
    W, H = SIZES.get(fmt, SIZES["square"])
    if fmt == "story":
        top, bot = 250, H - 340            # Instagram Story safe zones
    elif fmt == "a4":
        top, bot = 70, H - 70              # print margin
    else:
        top, bot = 48, H - 48
    wm_y = bot                              # where the watermark line sits
    if watermark:
        bot -= 44                           # reserve room so rows never touch it
    numeric = any(_num(i["price"]).isdigit() for i in items)
    raw_title = (title.strip() or "Orodha ya Bei").upper()
    dark = pal["dark"]
    return SimpleNamespace(
        items=items, n=len(items), biz=biz.strip() or "Biashara Yangu",
        title_raw=raw_title, title=raw_title + ("  ·  TZS" if numeric else ""), numeric=numeric,
        tagline=tagline.strip(), phone=phone.strip(), logo=logo, p=pal, fmt=fmt,
        W=W, H=H, top=top, bot=bot, wm_y=wm_y, tall=H > 1300, compact=(H < 1200 and len(items) > 8),
        card=((255, 255, 255), 24) if dark else ((255, 255, 255), 235),
        edge=None if dark else (214, 218, 240),
    )


def _logo(img, logo, cx, cy, size):
    r = size // 2
    _paste_circle(img, cx, cy, r + 6, (255, 255, 255))
    img.paste(_cover(logo, size, size), (int(cx - r), int(cy - r)), _circle_mask(size))


def _header(c, img, d, y, align="left", color=None, muted=None):
    color, muted = color or c.p["text"], muted or c.p["muted"]
    pad = 64
    ls = ((84 if c.compact else 128) if c.logo else 0)
    name_max, name_h = (50, 70) if c.compact else (64, 130)
    show_tag = bool(c.tagline) and not c.compact
    if align == "center":
        if ls:
            _logo(img, c.logo, c.W / 2, y + ls / 2, ls)
            y += ls + 18
        lines, f, lh = _fit_block(d, c.biz, True, c.W - 2 * pad, name_h, name_max, 28, 2)
        for ln in lines:
            _t(d, (c.W / 2, y), ln, f, color, "ma")
            y += lh
        if show_tag:
            tl, tf, tlh = _fit_block(d, c.tagline, False, c.W - 2 * pad, 70, 30, 18, 2)
            y += 4
            for ln in tl:
                _t(d, (c.W / 2, y), ln, tf, muted, "ma")
                y += tlh
        return y
    x = pad
    if ls:
        _logo(img, c.logo, x + ls / 2, y + ls / 2, ls)
        x += ls + 26
    w = c.W - pad - x
    lines, f, lh = _fit_block(d, c.biz, True, w, name_h, name_max, 28, 2)
    tl, tf, tlh = ([], None, 0)
    if show_tag:
        tl, tf, tlh = _fit_block(d, c.tagline, False, w, 70, 30, 18, 2)
    block = len(lines) * lh + (6 + len(tl) * tlh if tl else 0)
    yy = y + max(0, (ls - block) // 2)
    for ln in lines:
        _t(d, (x, yy), ln, f, color, "la")
        yy += lh
    if tl:
        yy += 6
        for ln in tl:
            _t(d, (x, yy), ln, tf, muted, "la")
            yy += tlh
    return max(y + ls, yy)


def _title_pill(c, d, y, align="left", fill=None, color=None):
    txt, f, _sz = _fit_line(d, c.title, True, c.W - 200, 26, 14)
    w = d.textlength(txt, font=f) + 56
    x0 = 64 if align == "left" else (c.W - w) / 2
    d.rounded_rectangle([x0, y, x0 + w, y + 56], radius=28, fill=fill or c.p["accent"])
    _t(d, (x0 + w / 2, y + 28), txt, f, color or c.p["on_accent"], "mm")
    return y + 56


def _footer(c, d, fill=None, color=None):
    """Draws the phone pill; returns the y where the rows must stop."""
    if not c.phone:
        return c.bot
    txt, f, _sz = _fit_line(d, f"Piga / WhatsApp: {c.phone}", True, c.W - 180, 32, 16)
    w = d.textlength(txt, font=f) + 64
    y = c.bot - 66
    x0 = (c.W - w) / 2
    d.rounded_rectangle([x0, y, x0 + w, y + 66], radius=33, fill=fill or c.p["pill"])
    _t(d, (c.W / 2, y + 33), txt, f, color or c.p["on_pill"], "mm")
    return y - 20


def _rows_box(c, y_start, y_end, cap=130):
    avail = y_end - y_start
    rh = max(40, min(cap, avail // c.n))
    return y_start + max(0, (avail - rh * c.n) // 2), rh


def _name_lines(d, text, max_w, rh, size=36):
    return _fit_block(d, text, False, max_w, max(24, rh - 14), size, 18, 2)


# ── The 6 designs ─────────────────────────────────────────────────────────────
def _orodha(c):                                   # cards with numbered badges and price pills
    p = c.p
    img = _gradient(c.W, c.H, p["bg1"], p["bg2"])
    _paste_circle(img, c.W - 40, 60, 240, p["accent"], 34)
    _paste_circle(img, 0, c.H, 200, p["accent"], 26)
    d = ImageDraw.Draw(img)
    y = _header(c, img, d, c.top, "left")
    y = _title_pill(c, d, y + 18, "left") + 26
    y0, rh = _rows_box(c, y, _footer(c, d))
    pad = 64
    for i, it in enumerate(c.items):
        r0, r1 = y0 + i * rh, y0 + (i + 1) * rh - 12
        _paste_rr(img, (pad, r0, c.W - pad, r1), 26, c.card[0], c.card[1])
        if c.edge:
            d.rounded_rectangle([pad, r0, c.W - pad, r1], radius=26, outline=c.edge, width=2)
        cy = (r0 + r1) // 2
        d.ellipse([pad + 18, cy - 24, pad + 66, cy + 24], fill=p["accent"])
        _t(d, (pad + 42, cy), str(i + 1), _F(24, True), p["on_accent"], "mm")
        ptxt, pf, _ps = _fit_line(d, _price(it["price"]), True, 300, 36, 16)
        pw = d.textlength(ptxt, font=pf) + 40
        px1 = c.W - pad - 18
        d.rounded_rectangle([px1 - pw, cy - 28, px1, cy + 28], radius=28, fill=p["accent"])
        _t(d, (px1 - pw / 2, cy), ptxt, pf, p["on_accent"], "mm")
        lines, nf, lh = _name_lines(d, it["name"], px1 - pw - 24 - (pad + 90), r1 - r0)
        ty = cy - len(lines) * lh / 2
        for ln in lines:
            _t(d, (pad + 90, ty), ln, nf, p["text"], "la")
            ty += lh
    return img


def _menyu(c):                                    # restaurant menu: dotted leaders
    p = c.p
    img = _gradient(c.W, c.H, p["bg1"], p["bg2"])
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([34, 34, c.W - 34, c.H - 34], radius=40, outline=p["accent"], width=4)
    y = _header(c, img, d, c.top + 26, "center")
    d.line([(c.W / 2 - 120, y + 18), (c.W / 2 + 120, y + 18)], fill=p["accent"], width=4)
    y = _title_pill(c, d, y + 36, "center") + 30
    fy = _footer(c, d)
    y0, rh = _rows_box(c, y, fy - 10, 112)
    pad = 96
    for i, it in enumerate(c.items):
        cy = y0 + i * rh + rh // 2
        ptxt, pf, _ps = _fit_line(d, _price(it["price"]), True, 300, 40, 18)
        pw = d.textlength(ptxt, font=pf)
        _t(d, (c.W - pad, cy), ptxt, pf, p["accent"], "rm")
        name, nf, _ns = _fit_line(d, it["name"], False, c.W - 2 * pad - pw - 60, 38, 16)
        nw = d.textlength(name, font=nf)
        _t(d, (pad, cy), name, nf, p["text"], "lm")
        x, end = pad + nw + 16, c.W - pad - pw - 16
        while x < end:
            d.ellipse([x, cy + 8, x + 4, cy + 12], fill=p["muted"])
            x += 14
    return img


def _jedwali(c):                                  # table with a coloured header band + zebra rows
    p = c.p
    img = Image.new("RGB", (c.W, c.H), p["bg1"])
    scratch = Image.new("RGB", (c.W, c.H))
    sy = _header(c, scratch, ImageDraw.Draw(scratch), c.top, "left", p["on_accent"], p["on_accent"])
    band_end = sy + 18 + 56 + 30
    d = ImageDraw.Draw(img)
    d.rectangle([0, 0, c.W, band_end], fill=p["accent"])
    y = _header(c, img, d, c.top, "left", p["on_accent"], p["on_accent"])
    _title_pill(c, d, y + 18, "left", fill=p["on_accent"], color=p["accent"])
    y = band_end + 26
    pad = 56
    _t(d, (pad + 20, y), "NA", _F(22, True), p["muted"], "la")
    _t(d, (pad + 100, y), "BIDHAA", _F(22, True), p["muted"], "la")
    _t(d, (c.W - pad - 20, y), "BEI (TZS)" if c.numeric else "BEI", _F(22, True), p["muted"], "ra")
    y += 44
    d.line([(pad, y), (c.W - pad, y)], fill=p["accent"], width=3)
    y += 8
    y0, rh = _rows_box(c, y, _footer(c, d), 104)
    for i, it in enumerate(c.items):
        r0 = y0 + i * rh
        cy = r0 + rh // 2
        if i % 2 == 0:
            _paste_rr(img, (pad, r0, c.W - pad, r0 + rh), 14, c.card[0], c.card[1])
        _t(d, (pad + 20, cy), str(i + 1), _F(26, True), p["accent"], "lm")
        ptxt, pf, _ps = _fit_line(d, _price(it["price"]), True, 280, 38, 18)
        pw = d.textlength(ptxt, font=pf)
        _t(d, (c.W - pad - 20, cy), ptxt, pf, p["text"], "rm")
        lines, nf, lh = _name_lines(d, it["name"], c.W - 2 * pad - 100 - pw - 60, rh)
        ty = cy - len(lines) * lh / 2
        for ln in lines:
            _t(d, (pad + 100, ty), ln, nf, p["text"], "la")
            ty += lh
    return img


def _bango(c):                                    # big sign: huge title, bold prices
    p = c.p
    img = _gradient(c.W, c.H, p["bg1"], p["bg2"])
    d = ImageDraw.Draw(img)
    pad, y = 64, c.top
    ls = ((72 if c.compact else 96) if c.logo else 0)
    x = pad
    if ls:
        _logo(img, c.logo, x + ls / 2, y + ls / 2, ls)
        x += ls + 22
    bt, bf, _sz = _fit_line(d, c.biz.upper(), True, c.W - x - pad, 34, 16)
    _t(d, (x, y + max(ls, 36) / 2), bt, bf, p["accent"], "lm")
    y += max(ls, 36) + 20
    lines, tf, tlh = _fit_block(d, c.title_raw, True, c.W - 2 * pad, 150 if c.compact else 290,
                                84 if c.compact else 124, 40, 2)
    for ln in lines:
        _t(d, (pad, y), ln, tf, p["text"], "la")
        y += tlh
    d.rectangle([pad, y + 6, pad + 220, y + 16], fill=p["accent"])
    y += 34
    if c.tagline and not c.compact:
        tl, tgf, tgh = _fit_block(d, c.tagline, False, c.W - 2 * pad, 70, 30, 18, 2)
        for ln in tl:
            _t(d, (pad, y), ln, tgf, p["muted"], "la")
            y += tgh
        y += 6
    if c.numeric:
        _t(d, (c.W - pad, y), "BEI KWA TZS", _F(22, True), p["muted"], "ra")
        y += 34
    y0, rh = _rows_box(c, y, _footer(c, d), 124)
    for i, it in enumerate(c.items):
        r0 = y0 + i * rh
        cy = r0 + rh // 2
        if i:
            d.line([(pad, r0), (c.W - pad, r0)], fill=p["muted"], width=1)
        ptxt, pf, _ps = _fit_line(d, _price(it["price"]), True, 360, 46, 18)
        pw = d.textlength(ptxt, font=pf)
        _t(d, (c.W - pad, cy), ptxt, pf, p["accent"], "rm")
        nl, nf, lh = _fit_block(d, it["name"], False, c.W - 2 * pad - pw - 40, max(24, rh - 14), 42, 18, 2)
        ty = cy - len(nl) * lh / 2
        for ln in nl:
            _t(d, (pad, ty), ln, nf, p["text"], "la")
            ty += lh
    return img


def _gridi(c):                                    # 2-column grid of cards
    p = c.p
    img = _gradient(c.W, c.H, p["bg1"], p["bg2"])
    _paste_circle(img, c.W - 30, 40, 200, p["accent"], 30)
    d = ImageDraw.Draw(img)
    y = _header(c, img, d, c.top, "center")
    y = _title_pill(c, d, y + 18, "center") + 26
    fy = _footer(c, d)
    pad, gap = 56, 20
    cw = (c.W - 2 * pad - gap) // 2
    rows = (c.n + 1) // 2
    avail = fy - y
    ch = max(64, min(330, (avail - gap * (rows - 1)) // rows))
    y0 = y + max(0, (avail - (rows * ch + (rows - 1) * gap)) // 2)
    for i, it in enumerate(c.items):
        r, k = divmod(i, 2)
        x0, r0 = pad + k * (cw + gap), y0 + r * (ch + gap)
        _paste_rr(img, (x0, r0, x0 + cw, r0 + ch), 28, c.card[0], c.card[1])
        if c.edge:
            d.rounded_rectangle([x0, r0, x0 + cw, r0 + ch], radius=28, outline=c.edge, width=2)
        d.rounded_rectangle([x0, r0 + 18, x0 + 8, r0 + ch - 18], radius=4, fill=p["accent"])
        ptxt = _price(it["price"])
        if ch < 120:                              # short cards: name left, price right
            ptxt, pf, _ps = _fit_line(d, ptxt, True, cw * 0.42, 34, 16)
            pw = d.textlength(ptxt, font=pf)
            _t(d, (x0 + cw - 22, r0 + ch / 2), ptxt, pf, p["accent"], "rm")
            lines, nf, lh = _fit_block(d, it["name"], False, cw - pw - 80, max(24, ch - 16), 30, 16, 2)
            ty = r0 + ch / 2 - len(lines) * lh / 2
            for ln in lines:
                _t(d, (x0 + 28, ty), ln, nf, p["text"], "la")
                ty += lh
        else:                                     # tall cards: name on top, price below
            lines, nf, lh = _fit_block(d, it["name"], False, cw - 60, max(24, ch - 100), 34, 18, 3)
            ty = r0 + 20
            for ln in lines:
                _t(d, (x0 + 30, ty), ln, nf, p["text"], "la")
                ty += lh
            ptxt, pf, _ps = _fit_line(d, ptxt, True, cw - 60, 42, 16)
            _t(d, (x0 + 30, r0 + ch - 20), ptxt, pf, p["accent"], "ls")
    return img


def _neon(c):                                     # dark with a glowing frame
    glow = c.p["accent"]
    img = _gradient(c.W, c.H, (8, 8, 14), (24, 12, 36))
    d = ImageDraw.Draw(img)
    y = _header(c, img, d, c.top, "center", (255, 255, 255), (170, 170, 190))
    y = _title_pill(c, d, y + 18, "center", fill=(18, 18, 28), color=glow) + 30
    fy = _footer(c, d, fill=(18, 18, 28), color=glow)
    _glow(img, (46, int(y), c.W - 46, int(fy)), 36, glow)
    y0, rh = _rows_box(c, y + 16, fy - 16, 112)
    pad = 84
    for i, it in enumerate(c.items):
        r0 = y0 + i * rh
        cy = r0 + rh // 2
        if i:
            d.line([(pad, r0), (c.W - pad, r0)], fill=(60, 60, 80), width=2)
        ptxt, pf, _ps = _fit_line(d, _price(it["price"]), True, 300, 40, 18)
        pw = d.textlength(ptxt, font=pf)
        _t(d, (c.W - pad, cy), ptxt, pf, glow, "rm")
        lines, nf, lh = _fit_block(d, it["name"], False, c.W - 2 * pad - pw - 40, max(24, rh - 14), 38, 18, 2)
        ty = cy - len(lines) * lh / 2
        for ln in lines:
            _t(d, (pad, ty), ln, nf, (255, 255, 255), "la")
            ty += lh
    return img


_RENDERERS = {
    "orodha": _orodha, "menyu": _menyu, "jedwali": _jedwali,
    "bango": _bango, "gridi": _gridi, "neon": _neon,
}


def resolve_choice(template, palette):
    tid = template if template in PL_TEMPLATE_IDS else random.choice(PL_TEMPLATE_IDS)
    pid = palette if palette in PALETTES else random.choice(PALETTE_IDS)
    return tid, pid


WM_TEXT = "Imetengenezwa na Wakalabot Studio  ·  wakalabot.co.tz/studio"


def _stamp(img, y_bottom):
    """Small footer line. Colour adapts to whatever is behind it."""
    d = ImageDraw.Draw(img)
    f = _F(22, False)
    w = d.textlength(WM_TEXT, font=f)
    y = y_bottom - 30
    x0 = max(0, int((img.width - w) / 2) - 10)
    x1 = min(img.width, int((img.width + w) / 2) + 10)
    lum = ImageStat.Stat(img.crop((x0, y, x1, y + 28)).convert("L")).mean[0]
    color = (86, 90, 104) if lum > 135 else (190, 194, 206)
    _t(d, (img.width / 2, y), WM_TEXT, f, color, "ma")


def _render(template_id, palette_id, items, biz, title, tagline, phone, logo, fmt, watermark=False):
    pal = PALETTES.get(palette_id, PALETTES["giza"])
    c = _ctx(items, biz, title, tagline, phone, logo, pal, fmt, watermark)
    img = _RENDERERS.get(template_id, _orodha)(c)
    if watermark:
        _stamp(img, c.wm_y)
    return img


def render_pricelist(template_id, palette_id, items, biz, title, tagline, phone, logo, fmt, watermark=False) -> bytes:
    return _jpeg(_render(template_id, palette_id, items, biz, title, tagline, phone, logo, fmt, watermark))


_SAMPLE = [("Kitenge cha Ankara", "25000"), ("Gauni la Kitenge", "45000"), ("Shati la Kiume", "30000"),
           ("Viatu vya Ngozi", "60000"), ("Mkoba wa Mkono", "35000")]


@lru_cache(maxsize=256)
def preview_jpeg(template_id: str, palette_id: str, fmt: str) -> bytes:
    items = [{"name": n, "price": pr} for n, pr in _SAMPLE]
    img = _render(template_id, palette_id, items, "Amina Fashion", "Orodha ya Bei",
                  "Ubora kwa bei nafuu", "0712 345 678", None, fmt)
    img.thumbnail((420, 760))
    out = io.BytesIO()
    img.save(out, "JPEG", quality=80)
    return out.getvalue()