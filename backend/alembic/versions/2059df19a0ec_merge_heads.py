"""merge heads

Revision ID: 2059df19a0ec
Revises: 59b0aa80e40d, e092f6d1950e
Create Date: 2026-10-25 14:42:28.179037

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '2059df19a0ec'
down_revision: Union[str, Sequence[str], None] = ('59b0aa80e40d', 'e092f6d1950e')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass