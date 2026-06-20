"""
Products CRUD endpoints.
All operations are scoped to the authenticated tenant.
POST and PUT accept multipart/form-data so clients can upload an image file;
the image is stored in Cloudinary and the secure URL is saved to the DB.
On create/update, product data is synced to pgvector via ai_engine
so the RAG system can answer stock-aware queries.
"""
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
            KnowledgeBase.content.like("[MASTER_CATALOG]%")
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
        # Call the local function defined above
        await update_tenant_master_catalog(db, tenant_id)
    except Exception as e:
        # Log the error so the request doesn't crash
        print(f"Catalog sync failed for tenant {tenant_id}: {e}")



def _kb_text(name: str, price: float, stock: int, description: str, category: str = "product", image_url: Optional[str] = None) -> str:
    """Canonical text embedded in pgvector for an item.
    Includes IMAGE_LINK so the AI can surface the URL in WhatsApp replies.
    """
    img_part = f" IMAGE_LINK: {optimise_url(image_url)}" if image_url else ""
    if category == "service":
        return f"Service: {name}, Price: {price} TZS.{img_part}. Description: {description}"
    
    return (
        f"Product: {name}, Price: {price} TZS, Stock: {stock} available."
        f"{img_part}. Description: {description}"
    )


def _to_response(p: Product) -> ProductResponse:
    return ProductResponse(
        id=str(p.id),
        name=p.name,
        description=p.description,
        price=float(p.price),
        stock_quantity=p.stock_quantity,
        category=p.category, # <-- INSERT THIS LINE
        image_url=p.image_url,
        is_active=p.is_active,
        last_updated=p.last_updated.isoformat() if p.last_updated else None,
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
    stock_quantity: int = Form(..., ge=0),
    category: str = Form(default="product"),
    is_active: bool = Form(default=True),
    image: Optional[UploadFile] = File(default=None),
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
) -> ProductResponse:
    # Upload image if provided
    image_url: Optional[str] = None
    if image and image.filename:
        try:
            image_url = await upload_image(image)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc))
        
    if category == "service":       
        stock_quantity = 0

    # Embed product text into KnowledgeBase for RAG (include image_url so AI can surface it)
    text = _kb_text(name, price, stock_quantity, description, category, image_url)
    embedding = await ai_engine._embed(text)

    kb = KnowledgeBase(
        tenant_id=tenant.id,
        content=text,
        embedding=embedding,
        image_url=image_url,
    )
    db.add(kb)
    await db.flush()

    product = Product(
        tenant_id=tenant.id,
        name=name,
        description=description,
        price=price,
        stock_quantity=stock_quantity,
        category=category,
        image_url=image_url,
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
    stock_quantity: Optional[int] = Form(default=None, ge=0),
    category: Optional[str] = Form(default=None),
    is_active: Optional[bool] = Form(default=None),
    image: Optional[UploadFile] = File(default=None),
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

    # Handle image upload (replace old image in Cloudinary)
    if image and image.filename:
        old_public_id = public_id_from_url(product.image_url)
        try:
            new_url = await upload_image(image)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc))
        product.image_url = new_url
        if old_public_id:
            await delete_image(old_public_id)

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

    product.last_updated = datetime.now(timezone.utc)

    # Re-embed with updated values (include current image_url)
    new_text = _kb_text(product.name, product.price, product.stock_quantity, product.description, product.category, product.image_url)
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

    # Remove the linked KB entry so it won't appear in RAG results
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