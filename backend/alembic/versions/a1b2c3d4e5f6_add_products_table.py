"""add_products_table

Revision ID: a1b2c3d4e5f6
Revises: 58ccad3320e9
Create Date: 2026-04-26 13:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, Sequence[str], None] = '58ccad3320e9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'products',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('tenants.id', ondelete='CASCADE'),
                  nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('description', sa.Text(), nullable=False, server_default=''),
        sa.Column('price', sa.Numeric(12, 2), nullable=False, server_default='0.00'),
        sa.Column('stock_quantity', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('image_url', sa.String(2048), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column('kb_entry_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('last_updated', sa.DateTime(timezone=True),
                  server_default=sa.func.now(), nullable=False),
    )
    op.create_index('ix_products_tenant_id', 'products', ['tenant_id'])


def downgrade() -> None:
    op.drop_index('ix_products_tenant_id', table_name='products')
    op.drop_table('products')
