"""product_price_range_and_multiple_images

Revision ID: 7142bdbd2a34
Revises: f19409cb7132
Create Date: 2026-07-21 18:40:14.741941

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '7142bdbd2a34'
down_revision: Union[str, Sequence[str], None] = 'f19409cb7132'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('products', sa.Column(
        'price_min', sa.Numeric(12, 2), nullable=True
    ))
    op.add_column('products', sa.Column(
        'price_max', sa.Numeric(12, 2), nullable=True
    ))
    op.add_column('products', sa.Column(
        'extra_images', sa.JSON(), nullable=True
    ))


def downgrade() -> None:
    op.drop_column('products', 'price_min')
    op.drop_column('products', 'price_max')
    op.drop_column('products', 'extra_images')