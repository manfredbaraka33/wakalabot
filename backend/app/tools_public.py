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


class PriceListRequest(BaseModel):
    business_name: str = Field(..., min_length=2, max_length=60)
    items: list[PriceListItem] = Field(..., min_length=1, max_length=10)
    theme: str = Field(default="indigo")  # indigo | emerald | amber


_THEMES = {
    "indigo": {"bg": (15, 15, 20), "accent": (99, 102, 241), "text": (240, 240, 245)},
    "emerald": {"bg": (10, 20, 16), "accent": (16, 185, 129), "text": (235, 245, 240)},
    "amber": {"bg": (20, 16, 10), "accent": (245, 158, 11), "text": (245, 240, 235)},
}


def _load_font(size: int, bold: bool = False):
    # DejaVuSans ships with Pillow by default and supports Latin + basic
    # Swahili characters cleanly — no external font file needed.
    try:
        name = "DejaVuSans-Bold.ttf" if bold else "DejaVuSans.ttf"
        return ImageFont.truetype(name, size)
    except Exception:
        return ImageFont.load_default()


@router.post("/price-list-image")
@limiter.limit("10/minute")
async def generate_price_list_image(request: Request, payload: PriceListRequest):
    theme = _THEMES.get(payload.theme, _THEMES["indigo"])
    width = 900
    row_height = 70
    header_height = 160
    footer_height = 80
    height = header_height + (row_height * len(payload.items)) + footer_height

    img = Image.new("RGB", (width, height), theme["bg"])
    draw = ImageDraw.Draw(img)

    # Header
    title_font = _load_font(42, bold=True)
    subtitle_font = _load_font(22)
    draw.text((40, 40), payload.business_name[:40], font=title_font, fill=theme["text"])
    draw.text((40, 95), "Orodha ya Bei", font=subtitle_font, fill=theme["accent"])
    draw.line([(40, header_height - 20), (width - 40, header_height - 20)], fill=theme["accent"], width=2)

    # Rows
    item_font = _load_font(28)
    price_font = _load_font(28, bold=True)
    y = header_height
    for item in payload.items:
        price_width = int(draw.textlength(item.price, font=price_font))
        name_text = _truncate(draw, item.name, item_font, width - 100 - price_width - 30)
        draw.text((50, y + 18), name_text, font=item_font, fill=theme["text"])
        draw.text((width - 50 - price_width, y + 16), item.price, font=price_font, fill=theme["accent"])
        y += row_height
        if item != payload.items[-1]:
            draw.line([(50, y), (width - 50, y)], fill=(40, 40, 45), width=1)

    # Footer branding
    footer_font = _load_font(18)
    footer_text = "Imetengenezwa na Wakalabot — wakalabot.co.tz"
    footer_bbox = draw.textbbox((0, 0), footer_text, font=footer_font)
    footer_width = footer_bbox[2] - footer_bbox[0]
    draw.text(((width - footer_width) / 2, height - 50), footer_text, font=footer_font, fill=(100, 100, 110))

    buf = io.BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)

    return StreamingResponse(
        buf,
        media_type="image/png",
        headers={"Content-Disposition": "inline; filename=price-list.png"},
    )



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
        center("Asante kwa biashara yako.", _load_mono(19), muted, 36)
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