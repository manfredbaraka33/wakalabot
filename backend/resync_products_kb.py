"""
resync_products_kb.py — Re-embed all products using the new KB text format.

Run once after deploying the IMAGE_LINK embedding update:

    cd backend
    env\Scripts\python.exe resync_products_kb.py

What it does:
  1. Loads every product row from the `products` table.
  2. Rebuilds the KB text in the new format:
       "Product: [Name], Price: [Price] TZS, Stock: [Qty] available.
        IMAGE_LINK: [URL]. Description: [Desc]"
  3. Re-computes the embedding vector.
  4. Updates (or creates) the linked KnowledgeBase row.
  5. Commits each product individually so a failure won't roll back everything.

Progress is printed to stdout; errors are printed to stderr and skipped.
"""

import asyncio
import sys
from typing import Optional

from sqlalchemy import select, update

# Bootstrap the path so imports work when run directly from /backend
import os
sys.path.insert(0, os.path.dirname(__file__))

from app.db import AsyncSessionLocal
from app.models import KnowledgeBase, Product
from app.services import ai_engine
from app.utils.storage import optimise_url


def _kb_text(
    name: str,
    price: float,
    stock: int,
    description: str,
    image_url: Optional[str] = None,
) -> str:
    img_part = f" IMAGE_LINK: {optimise_url(image_url)}" if image_url else ""
    return (
        f"Product: {name}, Price: {price} TZS, Stock: {stock} available."
        f"{img_part}. Description: {description}"
    )


async def resync() -> None:
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(Product))
        products = result.scalars().all()

    total = len(products)
    print(f"Found {total} product(s) to re-sync.\n")

    updated = 0
    errors = 0

    for i, product in enumerate(products, start=1):
        try:
            new_text = _kb_text(
                product.name,
                float(product.price),
                product.stock_quantity,
                product.description,
                product.image_url,
            )
            new_embedding = await ai_engine._embed(new_text)

            async with AsyncSessionLocal() as db:
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
                        # KB row was deleted; create a fresh one
                        kb = KnowledgeBase(
                            id=product.kb_entry_id,
                            tenant_id=product.tenant_id,
                            content=new_text,
                            embedding=new_embedding,
                            image_url=product.image_url,
                        )
                        db.add(kb)
                else:
                    # Product never had a KB entry; create one now
                    kb = KnowledgeBase(
                        tenant_id=product.tenant_id,
                        content=new_text,
                        embedding=new_embedding,
                        image_url=product.image_url,
                    )
                    db.add(kb)
                    await db.flush()
                    # Update the product with the new kb_entry_id
                    await db.execute(
                        update(Product)
                        .where(Product.id == product.id)
                        .values(kb_entry_id=kb.id)
                    )

                await db.commit()

            print(f"  [{i}/{total}] ✓ {product.name}")
            updated += 1

        except Exception as exc:  # noqa: BLE001
            print(f"  [{i}/{total}] ✗ {product.name} — {exc}", file=sys.stderr)
            errors += 1

    print(f"\nDone. Updated: {updated}  Errors: {errors}")


if __name__ == "__main__":
    asyncio.run(resync())
