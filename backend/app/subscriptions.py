from datetime import datetime, timezone
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models import Subscription


async def get_current_subscription(db: AsyncSession, tenant_id):
    """Duplicates allowed. Returns the newest active row that hasn't expired.
    If none is running, returns the newest active-status row so callers can
    show it as expired. Returns None if the tenant has never had a plan."""
    now = datetime.now(timezone.utc)
    result = await db.execute(
        select(Subscription)
        .where(Subscription.tenant_id == tenant_id, Subscription.status == "active")
        .order_by(Subscription.started_at.desc())
    )
    rows = result.scalars().all()
    for s in rows:
        if s.expires_at > now:
            return s
    return rows[0] if rows else None