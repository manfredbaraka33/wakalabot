"""add_tenant_bot_type

Revision ID: 49a8e08a1adb
Revises: 0f51228f1d7c
Create Date: 2026-09-07 16:12:54.705530

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '49a8e08a1adb'
down_revision: Union[str, Sequence[str], None] = '0f51228f1d7c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None



def upgrade() -> None:
    op.add_column(
        'tenants',
        sa.Column('bot_type', sa.String(20), nullable=False, server_default='commerce')
    )


def downgrade() -> None:
    op.drop_column('tenants', 'bot_type')