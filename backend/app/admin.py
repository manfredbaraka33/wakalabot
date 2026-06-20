"""
Admin / dashboard API endpoints for conversation history.

GET /api/v1/admin/chats
    Returns all conversations for the logged-in tenant, ordered by the most
    recent message timestamp.  Includes a last_message snippet and timestamp.

GET /api/v1/admin/chats/{conversation_id}
    Returns the full message history for one conversation.
"""
import uuid
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_tenant
from app.db import get_db
from app.models import Conversation, Message, Tenant

router = APIRouter(prefix="/admin", tags=["admin"])

@router.get("/chats", response_model=list[dict])
async def list_chats(
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
) -> list[dict[str, Any]]:

    # Step 1: last timestamp per conversation
    last_ts_sq = (
        select(
            Message.conversation_id,
            func.max(Message.timestamp).label("last_ts"),
        )
        .group_by(Message.conversation_id)
        .subquery()
    )

    # Step 2: one message id per conversation matching that timestamp
    last_msg_id_sq = (
        select(
            Message.id.label("last_id"),
            Message.conversation_id.label("conv_id"),
        )
        .join(
            last_ts_sq,
            (Message.conversation_id == last_ts_sq.c.conversation_id)
            & (Message.timestamp == last_ts_sq.c.last_ts),
        )
        .distinct(Message.conversation_id)
        .subquery()
    )

    # Step 3: join everything together
    stmt = (
        select(Conversation, Message, last_ts_sq.c.last_ts)
        .join(
            last_ts_sq,
            last_ts_sq.c.conversation_id == Conversation.id,
            isouter=True,
        )
        .join(
            last_msg_id_sq,
            last_msg_id_sq.c.conv_id == Conversation.id,
            isouter=True,
        )
        .join(
            Message,
            Message.id == last_msg_id_sq.c.last_id,
            isouter=True,
        )
        .where(Conversation.tenant_id == tenant.id)
        .order_by(last_ts_sq.c.last_ts.desc().nullslast())
    )

    rows = (await db.execute(stmt)).all()

    result = []
    for row in rows:
        conv: Conversation = row[0]
        last_msg: Message | None = row[1]
        last_ts = row[2]
        result.append(
            {
                "id": str(conv.id),
                "customer_phone": conv.customer_phone,
                "customer_name": conv.customer_name,
                "created_at": conv.created_at.isoformat() if conv.created_at else None,
                "last_message": last_msg.content if last_msg else None,
                "last_message_role": last_msg.role if last_msg else None,
                "last_timestamp": last_ts.isoformat() if last_ts else None,
            }
        )

    return result


@router.get("/chats/{conversation_id}", response_model=dict)
async def get_chat(
    conversation_id: uuid.UUID,
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """Return the full message history for a single conversation."""

    conv_result = await db.execute(
        select(Conversation).where(
            Conversation.id == conversation_id,
            Conversation.tenant_id == tenant.id,
        )
    )
    conv = conv_result.scalar_one_or_none()
    if conv is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found",
        )

    msgs_result = await db.execute(
        select(Message)
        .where(Message.conversation_id == conversation_id)
        .order_by(Message.timestamp.asc())
    )
    messages = msgs_result.scalars().all()

    return {
        "id": str(conv.id),
        "customer_phone": conv.customer_phone,
        "customer_name": conv.customer_name,
        "created_at": conv.created_at.isoformat() if conv.created_at else None,
        "messages": [
            {
                "id": str(m.id),
                "role": m.role,
                "content": m.content,
                "image_url": m.image_url,
                "timestamp": m.timestamp.isoformat() if m.timestamp else None,
            }
            for m in messages
        ],
    }
