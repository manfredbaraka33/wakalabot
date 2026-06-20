"""add_support_tickets

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6a7b8
Create Date: 2026-04-28 00:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = 'd4e5f6a7b8c9'
down_revision: Union[str, Sequence[str], None] = 'c3d4e5f6a7b8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create ticket_category enum (idempotent)
    op.execute(sa.text(
        "DO $$ BEGIN "
        "CREATE TYPE ticket_category AS ENUM ('billing', 'technical', 'feature_request', 'general'); "
        "EXCEPTION WHEN duplicate_object THEN null; "
        "END $$;"
    ))

    # Create ticket_status enum (idempotent)
    op.execute(sa.text(
        "DO $$ BEGIN "
        "CREATE TYPE ticket_status AS ENUM ('pending', 'in_progress', 'resolved'); "
        "EXCEPTION WHEN duplicate_object THEN null; "
        "END $$;"
    ))

    # Create table idempotently
    op.execute(sa.text("""
        CREATE TABLE IF NOT EXISTS support_tickets (
            id UUID PRIMARY KEY,
            tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
            subject VARCHAR(255) NOT NULL,
            category ticket_category NOT NULL DEFAULT 'general',
            message TEXT NOT NULL,
            status ticket_status NOT NULL DEFAULT 'pending',
            admin_reply TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """))

    # Idempotent index
    op.execute(sa.text(
        "CREATE INDEX IF NOT EXISTS ix_support_tickets_tenant_id "
        "ON support_tickets (tenant_id)"
    ))


def downgrade() -> None:
    op.drop_index('ix_support_tickets_tenant_id', table_name='support_tickets')
    op.drop_table('support_tickets')
    op.execute(sa.text("DROP TYPE IF EXISTS ticket_status"))
    op.execute(sa.text("DROP TYPE IF EXISTS ticket_category"))
