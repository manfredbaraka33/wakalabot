"""
Knowledge Base CRUD endpoints.
All operations are scoped to the authenticated tenant.
"""
import uuid

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_tenant
from app.db import get_db
from app.models import KnowledgeBase, Tenant
from app.schemas import KBCreateRequest, KBEntryResponse, KBListResponse, KBUpdateRequest
from app.services import ai_engine
from app.models import Tenant as TenantModel

router = APIRouter(prefix="/knowledge", tags=["knowledge"])




import cloudinary.uploader

@router.post("/shop-logo")
async def upload_shop_logo(
    file: UploadFile = File(...),
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
) -> dict:
    if file.content_type not in ("image/jpeg", "image/png", "image/webp"):
        raise HTTPException(status_code=400, detail="Picha lazima iwe JPEG, PNG, au WebP.")

    contents = await file.read()
    if len(contents) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Picha ni kubwa mno. Tafadhali chagua picha chini ya 5MB.")

    upload_result = cloudinary.uploader.upload(
        contents,
        folder=f"wakalabot/logos/{tenant.id}",
        transformation=[{"width": 300, 
                         "height": 300, 
                         "crop": "pad", 
                         "background": "auto"
                         }],
    )
    tenant.logo_url = upload_result["secure_url"]
    await db.commit()
    return {"logo_url": tenant.logo_url}


@router.delete("/shop-logo")
async def remove_shop_logo(
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
) -> dict:
    tenant.logo_url = None
    await db.commit()
    return {"logo_url": None}




# ── GET /knowledge — list all entries for the tenant ──────────────────────────
@router.get("", response_model=KBListResponse)
async def list_knowledge(
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
) -> KBListResponse:
    result = await db.execute(
        select(KnowledgeBase)
        .where(KnowledgeBase.tenant_id == tenant.id)
        .order_by(KnowledgeBase.id)
    )
    rows = result.scalars().all()
    entries = [KBEntryResponse(id=str(r.id), content=r.content) for r in rows]
    return KBListResponse(entries=entries, total=len(entries))


# ── POST /knowledge — create new entry ────────────────────────────────────────
@router.post("", response_model=KBEntryResponse, status_code=status.HTTP_201_CREATED)
async def create_knowledge(
    payload: KBCreateRequest,
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
) -> KBEntryResponse:
    kb_id = await ai_engine.add_knowledge(db, tenant.id, payload.content)
    return KBEntryResponse(id=str(kb_id), content=payload.content)


# ── PUT /knowledge/{entry_id} — update text + regenerate embedding ────────────
@router.put("/{entry_id}", response_model=KBEntryResponse)
async def update_knowledge(
    entry_id: uuid.UUID,
    payload: KBUpdateRequest,
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
) -> KBEntryResponse:
    result = await db.execute(
        select(KnowledgeBase).where(
            KnowledgeBase.id == entry_id,
            KnowledgeBase.tenant_id == tenant.id,
        )
    )
    row = result.scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Knowledge entry not found")

    # Regenerate embedding for the new content
    new_embedding = await ai_engine._embed(payload.content)
    row.content = payload.content
    row.embedding = new_embedding
    await db.commit()
    await db.refresh(row)
    return KBEntryResponse(id=str(row.id), content=row.content)


# ── DELETE /knowledge/{entry_id} — remove entry ───────────────────────────────
@router.delete("/{entry_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_knowledge(
    entry_id: uuid.UUID,
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
) -> None:
    result = await db.execute(
        select(KnowledgeBase).where(
            KnowledgeBase.id == entry_id,
            KnowledgeBase.tenant_id == tenant.id,
        )
    )
    row = result.scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Knowledge entry not found")

    await db.delete(row)
    await db.commit()


from app.schemas import ShopSettingsRequest, ShopSettingsResponse

# ── Shop settings marker ───────────────────────────────────────────────────────
_SHOP_SETTINGS_MARKER = "__SHOP_SETTINGS__"


def _build_shop_settings_content(data: ShopSettingsRequest) -> str:
    opening_time = data.opening_time
    closing_time = data.closing_time
    
    hours = (
        "Saa 24 (hatufungi)"
        if opening_time == "24h"
        else f"{opening_time} - {closing_time}"
    )

    return (
        f"{_SHOP_SETTINGS_MARKER}\n"
        f"Business Hours: {hours}\n"
        f"Location: {data.location}\n"
        f"Contact Phone: {data.contact_phone}\n"
        f"Website URL: {data.website_url or ''}\n"
        f"Delivery Zones: {data.delivery_zones or ''}\n"
        f"Business Description: {data.business_description or ''}"
    )



# ── GET /knowledge/shop-settings ──────────────────────────────────────────────
@router.get("/shop-settings", response_model=ShopSettingsResponse)
async def get_shop_settings(
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
) -> ShopSettingsResponse:
    result = await db.execute(
        select(KnowledgeBase).where(
            KnowledgeBase.tenant_id == tenant.id,
            KnowledgeBase.content.like(f"{_SHOP_SETTINGS_MARKER}%"),
        )
    )
    row = result.scalar_one_or_none()
    
    # Default values if no entry exists
    if not row:
        return ShopSettingsResponse(
            opening_time="",
            closing_time="",
            location="",
            contact_phone="",
        )

    # Improved multi-line parsing
    content = row.content
    def get_field(field_name: str) -> str:
        # Look for "Field Name: [content]"
        # If it's a multi-line field, it continues until the next known field
        prefix = f"{field_name}: "
        if prefix not in content:
            return ""
        
        start = content.find(prefix) + len(prefix)
        # Find the end by looking for the next field marker
        remaining = content[start:]
        next_markers = [
            "\nBusiness Hours:", "\nLocation:", "\nContact Phone:", 
            "\nWebsite URL:", "\nDelivery Zones:", "\nBusiness Description:"
        ]
        
        end = len(content)
        for marker in next_markers:
            marker_pos = remaining.find(marker)
            if marker_pos != -1:
                # We found a potential next field
                # Keep the earliest one found as the end
                if start + marker_pos < end:
                    end = start + marker_pos
        
        return content[start:end].strip()

    # Parse hours separately as before
    hours_raw = get_field("Business Hours")
    parts = hours_raw.split(" - ") if " - " in hours_raw else ["08:00", "18:00"]

    return ShopSettingsResponse(
        opening_time=parts[0].strip(),
        closing_time=parts[1].strip() if len(parts) > 1 else "18:00",
        location=get_field("Location"),
        contact_phone=get_field("Contact Phone"),
        website_url=get_field("Website URL"),
        delivery_zones=get_field("Delivery Zones"),
        business_description=get_field("Business Description"),
    )






# ── POST /knowledge/shop-settings ─────────────────────────────────────────────

@router.post("/shop-settings", status_code=200)
async def save_shop_settings(
    payload: ShopSettingsRequest,
    tenant: TenantModel = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
) -> dict:
    # Save hours/location/contact to KB
    content = _build_shop_settings_content(payload)
    embedding = await ai_engine._embed(content)
    result = await db.execute(
        select(KnowledgeBase).where(
            KnowledgeBase.tenant_id == tenant.id,
            KnowledgeBase.content.like(f"{_SHOP_SETTINGS_MARKER}%"),
        )
    )
    row = result.scalar_one_or_none()
    if row:
        row.content = content
        row.embedding = embedding
    else:
        db.add(KnowledgeBase(
            tenant_id=tenant.id,
            content=content,
            embedding=embedding,
        ))
    # Save extra fields to tenant model
    if hasattr(tenant, "website_url"):
        tenant.website_url = payload.website_url
    if hasattr(tenant, "delivery_zones"):
        tenant.delivery_zones = payload.delivery_zones
    if hasattr(tenant, "business_description"):
        tenant.business_description = payload.business_description

    await db.commit()
    return {"status": "saved"}



NOTICE_PREFIX = "__CUSTOMER_NOTICE__:"

@router.get("/shop-notice")
async def get_shop_notice(
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
) -> dict:
    result = await db.execute(
        select(KnowledgeBase).where(
            KnowledgeBase.tenant_id == tenant.id,
            KnowledgeBase.content.like(f"{NOTICE_PREFIX}%"),
        )
    )
    row = result.scalar_one_or_none()
    if not row:
        return {"notice": None, "id": None}
    return {
        "notice": row.content[len(NOTICE_PREFIX):].strip(),
        "id": str(row.id),
    }


@router.post("/shop-notice")
async def set_shop_notice(
    payload: dict,
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
) -> dict:
    text = (payload.get("notice") or "").strip()[:280]  # hard cap

    # Find existing
    result = await db.execute(
        select(KnowledgeBase).where(
            KnowledgeBase.tenant_id == tenant.id,
            KnowledgeBase.content.like(f"{NOTICE_PREFIX}%"),
        )
    )
    row = result.scalar_one_or_none()

    if not text:
        # Empty = delete the notice
        if row:
            await db.delete(row)
            await db.commit()
        return {"notice": None}

    if row:
        row.content = f"{NOTICE_PREFIX}{text}"
    else:
        db.add(KnowledgeBase(
            tenant_id=tenant.id,
            content=f"{NOTICE_PREFIX}{text}",
            embedding=None,
        ))
    await db.commit()
    return {"notice": text}



import io
import httpx
import qrcode
from PIL import Image, ImageDraw
from reportlab.lib.pagesizes import A6
from reportlab.lib.units import mm
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas
from fastapi.responses import StreamingResponse


@router.get("/qr-pdf")
async def generate_qr_pdf(
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
):
    if not tenant.slug:
        raise HTTPException(status_code=400, detail="Tenant has no slug configured.")

    chat_link = f"https://wakalabot.co.tz/chat/{tenant.slug}"

    # ── Build QR code with high error correction (allows logo overlay) ──────
    qr = qrcode.QRCode(error_correction=qrcode.constants.ERROR_CORRECT_H, box_size=10, border=2)
    qr.add_data(chat_link)
    qr.make(fit=True)
    qr_img = qr.make_image(fill_color="#1e1b4b", back_color="white").convert("RGBA")

    # ── Embed logo at center if available ────────────────────────────────────
    if tenant.logo_url:
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(tenant.logo_url)
                logo = Image.open(io.BytesIO(resp.content)).convert("RGBA")

            qr_w, qr_h = qr_img.size
            logo_size = int(qr_w * 0.22)
            logo = logo.resize((logo_size, logo_size))

            # White circular backing so logo stands out from QR pattern
            pad = 16
            backing_size = logo_size + pad
            mask = Image.new("L", (backing_size, backing_size), 0)
            ImageDraw.Draw(mask).ellipse((0, 0, backing_size, backing_size), fill=255)
            backing = Image.new("RGBA", (backing_size, backing_size), "white")
            backing.putalpha(mask)

            center = ((qr_w - backing_size) // 2, (qr_h - backing_size) // 2)
            qr_img.paste(backing, center, backing)
            logo_pos = (center[0] + pad // 2, center[1] + pad // 2)
            qr_img.paste(logo, logo_pos, logo)
        except Exception:
            pass  # logo fetch failed — ship plain QR rather than error out

    qr_buf = io.BytesIO()
    qr_img.save(qr_buf, format="PNG")
    qr_buf.seek(0)

    # ── Compose into a print-ready PDF ───────────────────────────────────────
    pdf_buf = io.BytesIO()
    width, height = A6  # ~105mm x 148mm, postcard-sized — easy to print and stick at counter
    c = canvas.Canvas(pdf_buf, pagesize=A6)

    c.setFillColorRGB(1, 1, 1)
    c.rect(0, 0, width, height, fill=1, stroke=0)

    biz_name = tenant.biz_name[:32]
    c.setFont("Helvetica-Bold", 16)
    c.setFillColorRGB(0.12, 0.11, 0.29)
    c.drawCentredString(width / 2, height - 22 * mm, biz_name)

    qr_size = 65 * mm
    qr_x = (width - qr_size) / 2
    qr_y = height / 2 - qr_size / 2 + 6 * mm
    c.drawImage(ImageReader(qr_buf), qr_x, qr_y, width=qr_size, height=qr_size, mask='auto')

    c.setFont("Helvetica-Bold", 13)
    c.setFillColorRGB(0.39, 0.40, 0.95)
    c.drawCentredString(width / 2, qr_y - 11 * mm, f"Scan hapa kuchati na {biz_name}")

    c.setFont("Helvetica", 8)
    c.setFillColorRGB(0.45, 0.45, 0.45)
    c.drawCentredString(width / 2, qr_y - 17 * mm, "Tunajibu papo hapo, muda wowote")

    c.setFont("Helvetica", 7)
    c.setFillColorRGB(0.6, 0.6, 0.6)
    c.drawCentredString(width / 2, 8 * mm, "Powered by Wakalabot")

    c.showPage()
    c.save()
    pdf_buf.seek(0)

    return StreamingResponse(
        pdf_buf,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={tenant.slug}-qrcode.pdf"},
    )