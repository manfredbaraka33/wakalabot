"""studio_shot_label

Revision ID: 2e65e229b8c1
Revises: 2059df19a0ec
Create Date: 2026-10-25 20:42:58.953650

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '2e65e229b8c1'
down_revision: Union[str, Sequence[str], None] = '2059df19a0ec'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
       op.execute("""
           UPDATE creator_services
           SET label = 'Picha ya studio (AI)', cost = 4, est_cost_tzs = 95
           WHERE key = 'bg_remove'
       """)


def downgrade() -> None:
       op.execute("""
           UPDATE creator_services
           SET label = 'Ondoa mandhari ya picha', cost = 2, est_cost_tzs = 10
           WHERE key = 'bg_remove'
       """)