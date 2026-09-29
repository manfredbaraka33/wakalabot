from collections import Counter
from datetime import datetime, time, timedelta, timezone
import re
from typing import Any

from fastapi import APIRouter, Depends
from sqlalchemy import Date, Integer, case, cast, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_tenant
from app.db import get_db
from app.models import Conversation, Message, Product, Tenant

router = APIRouter(prefix="/admin/analytics", tags=["analytics"])


def _empty_trend_map(now: datetime) -> dict[str, int]:
    days = [(now - timedelta(days=offset)).date() for offset in range(6, -1, -1)]
    return {day.isoformat(): 0 for day in days}


def _empty_hour_buckets() -> list[dict[str, int]]:
    return [{"hour": hour, "count": 0} for hour in range(24)]


@router.get("/stats", response_model=dict)
async def get_analytics_stats(
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    now = datetime.now(timezone.utc)
    last_24_hours = now - timedelta(hours=24)
    trend_start_date = now.date() - timedelta(days=6)
    trend_start_dt = datetime.combine(trend_start_date, time.min, tzinfo=timezone.utc)

    total_chats_stmt = select(func.count(Conversation.id)).where(
        Conversation.tenant_id == tenant.id
    )
    total_chats = int((await db.scalar(total_chats_stmt)) or 0)

    active_customers_stmt = (
        select(func.count(func.distinct(Message.conversation_id)))
        .select_from(Message)
        .join(Conversation, Message.conversation_id == Conversation.id)
        .where(
            Conversation.tenant_id == tenant.id,
            Message.timestamp >= last_24_hours,
        )
    )
    active_customers_today = int((await db.scalar(active_customers_stmt)) or 0)

    message_stats_stmt = (
        select(
            func.count(Message.id).label("total_messages"),
            func.sum(
                case(
                    (Message.timestamp >= last_24_hours, 1),
                    else_=0,
                )
            ).label("active_today"),
            func.sum(
                case(
                    (
                        (Message.timestamp >= last_24_hours)
                        & (Message.role == "user"),
                        1,
                    ),
                    else_=0,
                )
            ).label("customer_inquiries_today"),
            func.sum(case((Message.role == "assistant", 1), else_=0)).label(
                "assistant_messages"
            ),
        )
        .select_from(Message)
        .join(Conversation, Message.conversation_id == Conversation.id)
        .where(Conversation.tenant_id == tenant.id)
    )
    message_stats = (await db.execute(message_stats_stmt)).one()
    total_messages = int(message_stats.total_messages or 0)
    active_today = int(message_stats.active_today or 0)
    customer_inquiries_today = int(message_stats.customer_inquiries_today or 0)
    assistant_messages = int(message_stats.assistant_messages or 0)
    human_messages = max(total_messages - assistant_messages, 0)
    assistant_ratio = round((assistant_messages / total_messages) * 100, 1) if total_messages else 0.0
    human_ratio = round(100.0 - assistant_ratio, 1) if total_messages else 0.0

    tz_day_expr = cast(
        func.timezone("Africa/Dar_es_Salaam", Message.timestamp),
        Date,
    )

    trend_stmt = (
        select(
            tz_day_expr.label("day"),
            func.count(Message.id).label("count"),
        )
        .select_from(Message)
        .join(Conversation, Message.conversation_id == Conversation.id)
        .where(
            Conversation.tenant_id == tenant.id,
            Message.timestamp >= trend_start_dt,
            Message.role == "user",
        )
        .group_by(tz_day_expr)
        .order_by(tz_day_expr)
    )
    customer_inquiries_trend = _empty_trend_map(now)
    for day, count in (await db.execute(trend_stmt)).all():
        customer_inquiries_trend[day.isoformat()] = int(count)

        # Explicit timezone conversion — timestamptz already carries UTC info,
    # but extract("hour", ...) without conversion uses whatever timezone
    # the database session defaults to, which differs between environments.
    # Converting explicitly to Africa/Dar_es_Salaam (fixed UTC+3, no DST)
    # makes the result identical everywhere regardless of server config.
    tz_hour_expr = cast(
        func.extract("hour", func.timezone("Africa/Dar_es_Salaam", Message.timestamp)),
        Integer,
    )

    peak_hours_stmt = (
        select(
            tz_hour_expr.label("hour"),
            func.count(Message.id).label("count"),
        )
        .select_from(Message)
        .join(Conversation, Message.conversation_id == Conversation.id)
        .where(Conversation.tenant_id == tenant.id)
        .group_by(tz_hour_expr)
        .order_by(tz_hour_expr)
    )
    peak_hours = _empty_hour_buckets()
    for hour, count in (await db.execute(peak_hours_stmt)).all():
        peak_hours[int(hour)]["count"] = int(count)
    busiest_hour = max(peak_hours, key=lambda item: item["count"], default=None)

    product_names = [
        name.strip()
        for name in (await db.execute(select(Product.name).where(Product.tenant_id == tenant.id))).scalars().all()
        if name and name.strip()
    ]
    product_patterns = {
        name: re.compile(rf"(?<!\w){re.escape(name)}(?!\w)", re.IGNORECASE)
        for name in dict.fromkeys(product_names)
    }
    top_products_counter: Counter[str] = Counter()
    if product_patterns:
        user_messages_stmt = (
            select(Message.content)
            .select_from(Message)
            .join(Conversation, Message.conversation_id == Conversation.id)
            .where(
                Conversation.tenant_id == tenant.id,
                Message.role == "user",
            )
        )
        user_messages = (await db.execute(user_messages_stmt)).scalars().all()
        for content in user_messages:
            if not content:
                continue
            for name, pattern in product_patterns.items():
                if pattern.search(content):
                    top_products_counter[name] += 1

    top_products = [
        {"name": name, "count": count}
        for name, count in top_products_counter.most_common(5)
    ]

    avg_messages_per_chat = round(total_messages / total_chats, 1) if total_chats else 0.0

    return {
        "total_chats": total_chats,
        "active_today": active_today,
        "customer_inquiries_today": customer_inquiries_today,
        "active_customers_today": active_customers_today,
        "total_messages": total_messages,
        "avg_messages_per_chat": avg_messages_per_chat,
        "ai_vs_human_ratio": {
            "assistant_percentage": assistant_ratio,
            "human_percentage": human_ratio,
            "assistant_messages": assistant_messages,
            "human_messages": human_messages,
        },
        "top_products": top_products,
        "customer_inquiries_trend": customer_inquiries_trend,
        "peak_hours": peak_hours,
        "peak_hour": busiest_hour,
    }