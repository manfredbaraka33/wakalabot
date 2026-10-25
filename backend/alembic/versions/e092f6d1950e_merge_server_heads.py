"""merge server heads

Revision ID: e092f6d1950e
Revises: 82004fc0d93b, e9b94f5def92
Create Date: 2026-10-22 11:31:17.653865

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e092f6d1950e'
down_revision: Union[str, Sequence[str], None] = ('82004fc0d93b', 'e9b94f5def92')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass