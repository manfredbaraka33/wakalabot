"""add_tenant_logo_url

Revision ID: 85a0ac1bf81a
Revises: 344bbea8cb80
Create Date: 2026-06-30 07:15:48.612720

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '85a0ac1bf81a'
down_revision: Union[str, Sequence[str], None] = '344bbea8cb80'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('tenants', sa.Column('logo_url', sa.String(2048), nullable=True))


def downgrade() -> None:
    op.drop_column('tenants', 'logo_url')
