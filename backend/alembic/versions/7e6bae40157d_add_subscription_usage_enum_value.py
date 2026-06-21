"""add_subscription_usage_enum_value

Revision ID: 7e6bae40157d
Revises: 0f2186c2c03f
Create Date: 2026-06-21 09:44:37.653255

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '7e6bae40157d'
down_revision: Union[str, Sequence[str], None] = '0f2186c2c03f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ALTER TYPE ADD VALUE cannot run inside a normal transaction block —
    # this is the correct, safe pattern for Alembic + Postgres enums.
    with op.get_context().autocommit_block():
        op.execute(
            "ALTER TYPE transaction_type ADD VALUE IF NOT EXISTS 'subscription_usage'"
        )

def downgrade() -> None:
    # Postgres does not support removing enum values directly.
    pass