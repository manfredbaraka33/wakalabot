"""
Support Ticket API endpoints.

POST /api/v1/support/tickets    — Submit a new ticket (authenticated tenant)
GET  /api/v1/support/tickets    — List tenant's own tickets with status
"""
import uuid
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_tenant
from app.db import get_db
from app.models import SupportTicket, Tenant
from app.schemas import SupportTicketCreate, SupportTicketOut

router = APIRouter(prefix="/support", tags=["support"])


@router.post("/tickets", response_model=SupportTicketOut, status_code=status.HTTP_201_CREATED)
async def create_ticket(
    payload: SupportTicketCreate,
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
) -> Any:
    ticket = SupportTicket(
        id=uuid.uuid4(),
        tenant_id=tenant.id,
        subject=payload.subject,
        category=payload.category,
        message=payload.message,
    )
    db.add(ticket)
    await db.commit()
    await db.refresh(ticket)

    return SupportTicketOut(
        id=str(ticket.id),
        subject=ticket.subject,
        category=ticket.category,
        message=ticket.message,
        status=ticket.status,
        admin_reply=ticket.admin_reply,
        created_at=ticket.created_at,
        updated_at=ticket.updated_at,
    )


@router.get("/tickets", response_model=list[SupportTicketOut])
async def list_my_tickets(
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
) -> Any:
    stmt = (
        select(SupportTicket)
        .where(SupportTicket.tenant_id == tenant.id)
        .order_by(SupportTicket.created_at.desc())
    )
    tickets = (await db.scalars(stmt)).all()

    return [
        SupportTicketOut(
            id=str(t.id),
            subject=t.subject,
            category=t.category,
            message=t.message,
            status=t.status,
            admin_reply=t.admin_reply,
            created_at=t.created_at,
            updated_at=t.updated_at,
        )
        for t in tickets
    ]
