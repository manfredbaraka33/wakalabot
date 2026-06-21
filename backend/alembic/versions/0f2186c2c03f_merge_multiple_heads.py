"""merge_multiple_heads

Revision ID: 0f2186c2c03f
Revises: 12cda2ee8b4c, ce6ec7726929
Create Date: 2026-06-21 09:44:01.379472

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0f2186c2c03f'
down_revision: Union[str, Sequence[str], None] = ('12cda2ee8b4c', 'ce6ec7726929')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass