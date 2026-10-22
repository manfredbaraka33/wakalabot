"""studio_pricelist

Revision ID: 0512a9701324
Revises: 5e4fe9671834
Create Date: 2026-10-22 07:17:46.208943

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0512a9701324'
down_revision: Union[str, Sequence[str], None] = '5e4fe9671834'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    op.execute("""
        INSERT INTO creator_services (key, label, cost, watermark_cost, est_cost_tzs, active, sort)
        VALUES ('pricelist', 'Orodha ya Bei (bure)', 0, NULL, 20, true, 0)
        ON CONFLICT (key) DO NOTHING
    """)


def downgrade() -> None:
    op.execute("DELETE FROM creator_services WHERE key = 'pricelist'")