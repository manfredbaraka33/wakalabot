"""instagram_integration_and_conversation_channel

Revision ID: f19409cb7132
Revises: 85a0ac1bf81a
Create Date: 2026-07-09 07:10:15.234143

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f19409cb7132'
down_revision: Union[str, Sequence[str], None] = '85a0ac1bf81a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Instagram credentials per tenant
    op.add_column('tenants', sa.Column('instagram_page_id', sa.String(100), nullable=True))
    op.add_column('tenants', sa.Column('instagram_access_token', sa.Text(), nullable=True))
    op.add_column('tenants', sa.Column('instagram_account_id', sa.String(100), nullable=True))
    # Channel tracking on conversations — where did this customer come from
    op.add_column('conversations', sa.Column(
        'channel', sa.String(20), nullable=True, server_default='web'
    ))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('tenants', 'instagram_page_id')
    op.drop_column('tenants', 'instagram_access_token')
    op.drop_column('tenants', 'instagram_account_id')
    op.drop_column('conversations', 'channel')
