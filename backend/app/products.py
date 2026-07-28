"""
Products CRUD endpoints.
All operations are scoped to the authenticated tenant.
POST and PUT accept multipart/form-data so clients can upload an image file;
the image is stored in Cloudinary and the secure URL is saved to the DB.
On create/update, product data is synced to pgvector via ai_engine
so the RAG system can answer stock-aware queries.
"""
import json
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_tenant
from app.db import get_db
from app.models import KnowledgeBase, Product, Tenant
from app.schemas import ProductListResponse, ProductResponse
from app.services import ai_engine
from app.utils.storage import delete_image, optimise_url, public_id_from_url, upload_image

router = APIRouter(prefix="/products", tags=["products"])


def _serialize(p: Product) -> dict:
    """Serialize a Product model into a dictionary with all formatted display fields."""
    all_images = []
    if p.image_url:
        all_images.append(p.image_url)
    if p.extra_images:
        all_images.extend(p.extra_images)

    # Calculate price display string and price range status
    if p.price_min is not None and p.price_max is not None:
        price_display = f"{int(p.price_min):,}–{int(p.price_max):,} TZS"
        has_range = True
    else:
        price_display = f"{int(p.price):,} TZS" if p.price else "Bei kwa ombi"
        has_range = False

    return {
        "id": str(p.id),
        "name": p.name,
        "description": p.description or "",
        "price": float(p.price) if p.price else 0.0,
        "price_min": float(p.price_min) if p.price_min is not None else None,
        "price_max": float(p.price_max) if p.price_max is not None else None,
        "price_display": price_display,
        "has_price_range": has_range,
        "stock_quantity": p.stock_quantity,
        "category": p.category,
        "image_url": p.image_url,
        "extra_images": p.extra_images or [],
        "all_images": all_images,
        "image_count": len(all_images),
        "is_active": p.is_active,
        "last_updated": p.last_updated.isoformat() if p.last_updated else None,
    }


def _to_response(p: Product) -> ProductResponse:
    """Convert a Product instance into the standard API response schema."""
    return ProductResponse(**_serialize(p))


async def update_tenant_master_catalog(db: AsyncSession, tenant_id: uuid.UUID):
    """Refreshes the MASTER_CATALOG knowledge base entry by querying the current DB state."""
    # 1. Fetch the absolute latest product list from the DB
    result = await db.execute(
        select(Product)
        .where(Product.tenant_id == tenant_id)
        .where(Product.is_active == True)
    )
    products = result.scalars().all()

    # 2. Build the exact content string
    lines = [f"{p.name}: {p.price} TZS" for p in products]
    catalog_text = "[MASTER_CATALOG]\n" + "\n".join(lines)

    # 3. Find the specific KB entry for the master catalog
    kb_result = await db.execute(
        select(KnowledgeBase).where(
            KnowledgeBase.tenant_id == tenant_id,
            KnowledgeBase.content.like("[MASTER_CATALOG]%"),
        )
    )
    kb = kb_result.scalar_one_or_none()

    # 4. Generate the embedding for the latest content
    new_embedding = await ai_engine._embed(catalog_text)

    if kb:
        # Update existing record
        kb.content = catalog_text
        kb.embedding = new_embedding
    else:
        # Create new record if it doesn't exist
        kb = KnowledgeBase(
            tenant_id=tenant_id,
            content=catalog_text,
            embedding=new_embedding,
        )
        db.add(kb)

    # Commit changes so they persist
    await db.commit()


async def trigger_catalog_sync(db: AsyncSession, tenant_id: uuid.UUID):
    """Safely trigger the KB catalog update."""
    try:
        await update_tenant_master_catalog(db, tenant_id)
    except Exception as e:
        print(f"Catalog sync failed for tenant {tenant_id}: {e}")


def _kb_text(
    name: str,
    price: float,
    price_min: Optional[float],
    price_max: Optional[float],
    stock: int,
    description: str,
    category: str = "product",
    image_url: Optional[str] = None,
) -> str:
    """Canonical text embedded in pgvector for an item."""
    img_part = f" IMAGE_LINK: {optimise_url(image_url)}" if image_url else ""

    if price_min is not None and price_max is not None:
        price_str = f"Range {price_min}-{price_max} TZS (Avg {price} TZS)"
    else:
        price_str = f"{price} TZS"

    if category == "service":
        return f"Service: {name}, Price: {price_str}.{img_part}. Description: {description}"

    return (
        f"Product: {name}, Price: {price_str}, Stock: {stock} available."
        f"{img_part}. Description: {description}"
    )


# ── GET /products ─────────────────────────────────────────────────────────────
@router.get("", response_model=ProductListResponse)
async def list_products(
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
) -> ProductListResponse:
    result = await db.execute(
        select(Product)
        .where(Product.tenant_id == tenant.id)
        .order_by(Product.last_updated.desc())
    )
    rows = result.scalars().all()
    return ProductListResponse(products=[_to_response(r) for r in rows], total=len(rows))


# ── POST /products ────────────────────────────────────────────────────────────
@router.post("", response_model=ProductResponse, status_code=status.HTTP_201_CREATED)
async def create_product(
    name: str = Form(..., min_length=1, max_length=255),
    description: str = Form(default="", max_length=5000),
    price: float = Form(..., ge=0),
    price_min: Optional[float] = Form(default=None),
    price_max: Optional[float] = Form(default=None),
    stock_quantity: int = Form(..., ge=0),
    category: str = Form(default="product"),
    is_active: bool = Form(default=True),
    image: Optional[UploadFile] = File(default=None),
    image2: Optional[UploadFile] = File(default=None),
    image3: Optional[UploadFile] = File(default=None),
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
) -> ProductResponse:

    # Upload main image
    main_url = None
    if image and image.filename:
        main_url = await upload_image(image)

    # Upload extra images
    extra_urls = []
    for extra in [image2, image3]:
        if extra and extra.filename:
            url = await upload_image(extra)
            extra_urls.append(url)

    # Validate price range if provided
    if price_min is not None and price_max is not None:
        if price_min >= price_max:
            raise HTTPException(
                status_code=400,
                detail="Bei ya chini lazima iwe ndogo kuliko bei ya juu.",
            )
        price = (price_min + price_max) / 2

    if category == "service":
        stock_quantity = 0

    # Embed product text into KnowledgeBase for RAG
    text = _kb_text(
        name, price, price_min, price_max, stock_quantity, description, category, main_url
    )
    embedding = await ai_engine._embed(text)

    kb = KnowledgeBase(
        tenant_id=tenant.id,
        content=text,
        embedding=embedding,
        image_url=main_url,
    )
    db.add(kb)
    await db.flush()

    product = Product(
        tenant_id=tenant.id,
        name=name,
        description=description,
        price=price,
        price_min=price_min,
        price_max=price_max,
        stock_quantity=stock_quantity,
        category=category,
        image_url=main_url,
        extra_images=extra_urls if extra_urls else None,
        is_active=is_active,
        kb_entry_id=kb.id,
        last_updated=datetime.now(timezone.utc),
    )
    db.add(product)
    await db.commit()
    await db.refresh(product)
    await trigger_catalog_sync(db, tenant.id)
    return _to_response(product)


# ── GET /products/{product_id} ────────────────────────────────────────────────
@router.get("/{product_id}", response_model=ProductResponse)
async def get_product(
    product_id: uuid.UUID,
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
) -> ProductResponse:
    result = await db.execute(
        select(Product).where(
            Product.id == product_id,
            Product.tenant_id == tenant.id,
        )
    )
    product = result.scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return _to_response(product)


# ── PUT /products/{product_id} ────────────────────────────────────────────────
@router.put("/{product_id}", response_model=ProductResponse)
async def update_product(
    product_id: uuid.UUID,
    name: Optional[str] = Form(default=None, max_length=255),
    description: Optional[str] = Form(default=None, max_length=5000),
    price: Optional[float] = Form(default=None, ge=0),
    price_min: Optional[float] = Form(default=None),
    price_max: Optional[float] = Form(default=None),
    stock_quantity: Optional[int] = Form(default=None, ge=0),
    category: Optional[str] = Form(default=None),
    is_active: Optional[bool] = Form(default=None),
    image: Optional[UploadFile] = File(default=None),
    image2: Optional[UploadFile] = File(default=None),
    image3: Optional[UploadFile] = File(default=None),
    existing_image_url: Optional[str] = Form(default=None),
    existing_extra_images: Optional[str] = Form(default=None),
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
) -> ProductResponse:
    result = await db.execute(
        select(Product).where(
            Product.id == product_id,
            Product.tenant_id == tenant.id,
        )
    )
    product = result.scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    # Handle main image upload
    if image and image.filename:
        old_public_id = public_id_from_url(product.image_url)
        try:
            new_url = await upload_image(image)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc))
        product.image_url = new_url
        if old_public_id:
            await delete_image(old_public_id)

    # Handle extra images
    current_extras = []
    if existing_extra_images:
        try:
            current_extras = json.loads(existing_extra_images)
        except Exception:
            current_extras = []

    new_extras = list(current_extras)
    for extra in [image2, image3]:
        if extra and extra.filename:
            url = await upload_image(extra)
            new_extras.append(url)

    new_extras = new_extras[:2]
    product.extra_images = new_extras if new_extras else None

    # Price validation
    if price_min is not None and price_max is not None:
        if price_min >= price_max:
            raise HTTPException(
                status_code=400,
                detail="Bei ya chini lazima iwe ndogo kuliko bei ya juu.",
            )
        price = (price_min + price_max) / 2

    # Apply partial updates
    if category is not None:
        product.category = category
        if category == "service":
            product.stock_quantity = 0

    if name is not None:
        product.name = name
    if description is not None:
        product.description = description
    if price is not None:
        product.price = price
    if stock_quantity is not None:
        product.stock_quantity = stock_quantity
    if is_active is not None:
        product.is_active = is_active
    if price_min is not None:
        product.price_min = price_min
    if price_max is not None:
        product.price_max = price_max

    product.last_updated = datetime.now(timezone.utc)

    # Re-embed with updated values
    new_text = _kb_text(
        product.name,
        product.price,
        product.price_min,
        product.price_max,
        product.stock_quantity,
        product.description,
        product.category,
        product.image_url,
    )
    new_embedding = await ai_engine._embed(new_text)

    if product.kb_entry_id:
        kb_result = await db.execute(
            select(KnowledgeBase).where(KnowledgeBase.id == product.kb_entry_id)
        )
        kb = kb_result.scalar_one_or_none()
        if kb:
            kb.content = new_text
            kb.embedding = new_embedding
            kb.image_url = product.image_url
    else:
        kb = KnowledgeBase(
            tenant_id=tenant.id,
            content=new_text,
            embedding=new_embedding,
            image_url=product.image_url,
        )
        db.add(kb)
        await db.flush()
        product.kb_entry_id = kb.id

    await db.commit()
    await db.refresh(product)
    await trigger_catalog_sync(db, tenant.id)
    return _to_response(product)


# ── DELETE /products/{product_id} ─────────────────────────────────────────────
@router.delete("/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_product(
    product_id: uuid.UUID,
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
) -> None:
    result = await db.execute(
        select(Product).where(
            Product.id == product_id,
            Product.tenant_id == tenant.id,
        )
    )
    product = result.scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    # Remove linked KB entry
    if product.kb_entry_id:
        kb_result = await db.execute(
            select(KnowledgeBase).where(KnowledgeBase.id == product.kb_entry_id)
        )
        kb = kb_result.scalar_one_or_none()
        if kb:
            await db.delete(kb)

    # Best-effort Cloudinary cleanup
    public_id = public_id_from_url(product.image_url)
    if public_id:
        await delete_image(public_id)

    await db.delete(product)
    await db.commit()
    await trigger_catalog_sync(db, tenant.id)