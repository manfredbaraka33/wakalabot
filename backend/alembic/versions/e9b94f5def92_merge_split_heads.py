"""merge split heads

Revision ID: e9b94f5def92
Revises: 49a8e08a1adb, 71f753c16cd1
Create Date: 2026-09-25 07:50:38.478909

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e9b94f5def92'
down_revision: Union[str, Sequence[str], None] = ('49a8e08a1adb', '71f753c16cd1')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass