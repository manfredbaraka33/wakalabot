"""add_billing_wallet_transactions

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-04-27 00:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = 'c3d4e5f6a7b8'
down_revision: Union[str, Sequence[str], None] = 'b2c3d4e5f6a7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── Alter wallets.balance from Numeric → Integer and add last_updated ──────
    op.alter_column(
        'wallets', 'balance',
        existing_type=sa.Numeric(12, 2),
        type_=sa.Integer(),
        existing_nullable=False,
        postgresql_using='balance::integer',
    )
    op.add_column(
        'wallets',
        sa.Column(
            'last_updated',
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )

    # ── Create transaction_status enum (idempotent) ───────────────────────────
    # Use raw SQL with PL/pgSQL exception block so this is safe to re-run.
    op.execute(sa.text(
        "DO $$ BEGIN "
        "CREATE TYPE transaction_status AS ENUM ('pending', 'success', 'failed'); "
        "EXCEPTION WHEN duplicate_object THEN null; "
        "END $$;"
    ))

    # ── Create transactions table ──────────────────────────────────────────────
    # Use postgresql.ENUM with create_type=False so Alembic does not attempt to
    # re-create the type we just ensured exists above.
    txn_status_type = postgresql.ENUM(
        'pending', 'success', 'failed',
        name='transaction_status',
        create_type=False,
    )
    op.create_table(
        'transactions',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            'tenant_id',
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey('tenants.id', ondelete='CASCADE'),
            nullable=False,
        ),
        sa.Column(
            'wallet_id',
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey('wallets.id', ondelete='CASCADE'),
            nullable=False,
        ),
        sa.Column('amount_tzs', sa.Integer(), nullable=False),
        sa.Column('coin_amount', sa.Integer(), nullable=False),
        sa.Column(
            'status',
            txn_status_type,
            nullable=False,
            server_default='pending',
        ),
        sa.Column('azampay_reference', sa.String(255), nullable=True),
        sa.Column('package_id', sa.String(50), nullable=False),
        sa.Column('phone_number', sa.String(50), nullable=False),
        sa.Column(
            'created_at',
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index('ix_transactions_tenant_id', 'transactions', ['tenant_id'])
    op.create_index('ix_transactions_wallet_id', 'transactions', ['wallet_id'])


def downgrade() -> None:
    op.drop_index('ix_transactions_wallet_id', table_name='transactions')
    op.drop_index('ix_transactions_tenant_id', table_name='transactions')
    op.drop_table('transactions')

    sa.Enum(name='transaction_status').drop(op.get_bind(), checkfirst=True)

    op.drop_column('wallets', 'last_updated')
    op.alter_column(
        'wallets', 'balance',
        existing_type=sa.Integer(),
        type_=sa.Numeric(12, 2),
        existing_nullable=False,
        postgresql_using='balance::numeric(12,2)',
    )
