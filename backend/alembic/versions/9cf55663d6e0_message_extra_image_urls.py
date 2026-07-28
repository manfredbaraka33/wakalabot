"""message_extra_image_urls

Revision ID: 9cf55663d6e0
Revises: 7142bdbd2a34
Create Date: 2026-07-23 08:45:41.859072

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '9cf55663d6e0'
down_revision: Union[str, Sequence[str], None] = '7142bdbd2a34'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'messages',
        sa.Column('extra_image_urls', sa.JSON(), nullable=True)
    )


def downgrade() -> None:
    op.drop_column('messages', 'extra_image_urls')