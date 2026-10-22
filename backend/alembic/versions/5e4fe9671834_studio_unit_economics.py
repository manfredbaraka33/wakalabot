"""studio_unit_economics

Revision ID: 5e4fe9671834
Revises: f0c02ee0c42a
Create Date: 2026-10-20 09:33:33.229218

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '5e4fe9671834'
down_revision: Union[str, Sequence[str], None] = 'f0c02ee0c42a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None



def upgrade() -> None:
    op.add_column("creator_services",
                  sa.Column("est_cost_tzs", sa.Integer, nullable=False, server_default="0"))
    op.execute("""
        UPDATE creator_services SET est_cost_tzs = CASE key
            WHEN 'poster_template' THEN 50
            WHEN 'poster_ai'       THEN 150
            WHEN 'poster_ai_voice' THEN 170
            WHEN 'video_lite'      THEN 1200
            WHEN 'video_fast'      THEN 2500
            WHEN 'video_pro'       THEN 9500
            ELSE 0 END
    """)
    op.execute("UPDATE credit_packs SET credits = 115 WHERE id = 'pro'")
    op.execute("UPDATE credit_packs SET active = false WHERE id = 'biashara'")  # the old TZS 5,000 pack
    op.execute("UPDATE credit_packs SET label = 'Biashara', sort = 3 WHERE id = 'studio'")
    op.execute("UPDATE credit_packs SET sort = 2 WHERE id = 'pro'")


def downgrade() -> None:
    op.drop_column("creator_services", "est_cost_tzs")