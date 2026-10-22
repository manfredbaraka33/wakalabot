"""merge 49a8 and 71f7

Revision ID: 4aad84a2c343
Revises: 49a8e08a1adb, 71f753c16cd1
Create Date: 2026-10-20 07:20:13.721265

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '4aad84a2c343'
down_revision: Union[str, Sequence[str], None] = ('49a8e08a1adb', '71f753c16cd1')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
