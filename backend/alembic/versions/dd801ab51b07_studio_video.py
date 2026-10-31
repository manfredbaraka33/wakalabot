"""studio_video

Revision ID: dd801ab51b07
Revises: 2e65e229b8c1
Create Date: 2026-10-31 10:46:40.410194

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'dd801ab51b07'
down_revision: Union[str, Sequence[str], None] = '2e65e229b8c1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
        INSERT INTO creator_services (key, label, cost, watermark_cost, est_cost_tzs, active, sort) VALUES
        ('video_motion',    'Video ya Motion (picha 1)',      40, NULL, 1500, false, 20),
        ('video_extra',     'Picha ya ziada kwenye video',    20, NULL,  800, true,  21),
        ('video_persona',   'Video na Mtu (persona)',         70, NULL, 2500, false, 22),
        ('video_voiceover', 'Sauti ya maelezo (voice-over)',   5, NULL,   50, true,  23)
        ON CONFLICT (key) DO NOTHING
    """)


def downgrade() -> None:
    op.execute("DELETE FROM creator_services WHERE key IN ('video_motion','video_extra','video_persona','video_voiceover')")