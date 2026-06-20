"""
Knowledge Base CRUD endpoints.
All operations are scoped to the authenticated tenant.
"""
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_tenant
from app.db import get_db
from app.models import KnowledgeBase, Tenant
from app.schemas import KBCreateRequest, KBEntryResponse, KBListResponse, KBUpdateRequest
from app.services import ai_engine
from app.models import Tenant as TenantModel

router = APIRouter(prefix="/knowledge", tags=["knowledge"])


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
    return (
        f"{_SHOP_SETTINGS_MARKER}\n"
        f"Business Hours: {data.opening_time} - {data.closing_time}\n"
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
            opening_time="08:00",
            closing_time="18:00",
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

