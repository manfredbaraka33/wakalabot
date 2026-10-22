"""studio_pricelist_watermark

Revision ID: 82004fc0d93b
Revises: 0512a9701324
Create Date: 2026-10-22 08:56:58.141473

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '82004fc0d93b'
down_revision: Union[str, Sequence[str], None] = '0512a9701324'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
        INSERT INTO creator_services (key, label, cost, watermark_cost, est_cost_tzs, active, sort)
        VALUES ('pricelist', 'Orodha ya Bei', 1, 0, 20, true, 0)
        ON CONFLICT (key) DO UPDATE SET label = 'Orodha ya Bei', cost = 1, watermark_cost = 0
    """)


def downgrade() -> None:
    op.execute("""
        UPDATE creator_services
        SET label = 'Orodha ya Bei (bure)', cost = 0, watermark_cost = NULL
        WHERE key = 'pricelist'
    """)
