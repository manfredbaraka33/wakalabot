"""add_subscription_usage_to_transaction_type_enum

Revision ID: ce6ec7726929
Revises: 26c6099086f0
Create Date: 2026-06-19 10:27:14.447533

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'ce6ec7726929'
down_revision: Union[str, Sequence[str], None] = '26c6099086f0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.execute("ALTER TYPE transaction_type ADD VALUE IF NOT EXISTS 'subscription_usage'")


def downgrade() -> None:
    """Downgrade schema."""
    pass
