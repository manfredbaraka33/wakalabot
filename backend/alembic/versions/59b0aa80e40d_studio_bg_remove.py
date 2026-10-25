"""studio_bg_remove

Revision ID: 59b0aa80e40d
Revises: 82004fc0d93b
Create Date: 2026-10-25 13:06:41.958991

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '59b0aa80e40d'
down_revision: Union[str, Sequence[str], None] = '82004fc0d93b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
       op.execute("""
           INSERT INTO creator_services (key, label, cost, watermark_cost, est_cost_tzs, active, sort)
           VALUES ('bg_remove', 'Ondoa mandhari ya picha', 2, NULL, 10, true, 9)
           ON CONFLICT (key) DO NOTHING
       """)


def downgrade() -> None:
       op.execute("DELETE FROM creator_services WHERE key = 'bg_remove'")
