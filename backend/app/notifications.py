"""Notifications endpoints."""
from fastapi import APIRouter, Depends
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_tenant
from app.db import get_db
from app.models import Notification, Tenant
from app.schemas import NotificationOut

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("", response_model=list[NotificationOut])
async def list_notifications(
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Notification)
        .where(Notification.tenant_id == tenant.id)
        .order_by(Notification.created_at.desc())
        .limit(30)
    )
    items = result.scalars().all()
    return [
        NotificationOut(
            id=str(n.id),
            type=n.type,
            message=n.message,
            is_read=n.is_read,
            created_at=n.created_at,
        )
        for n in items
    ]


@router.get("/unread-count")
async def unread_count(
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Notification).where(
            Notification.tenant_id == tenant.id,
            Notification.is_read == False,
        )
    )
    count = len(result.scalars().all())
    return {"count": count}


@router.post("/mark-all-read")
async def mark_all_read(
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
):
    await db.execute(
        update(Notification)
        .where(Notification.tenant_id == tenant.id, Notification.is_read == False)
        .values(is_read=True)
    )
    await db.commit()
    return {"status": "ok"}


@router.post("/{notification_id}/read")
async def mark_read(
    notification_id: str,
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Notification).where(
            Notification.id == notification_id,
            Notification.tenant_id == tenant.id,
        )
    )
    n = result.scalar_one_or_none()
    if n:
        n.is_read = True
        await db.commit()
    return {"status": "ok"}