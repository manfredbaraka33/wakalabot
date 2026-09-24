"""info_bot_subscription_only_directory

Revision ID: 71f753c16cd1
Revises: 0f51228f1d7c
Create Date: 2026-09-07 16:20:19.317259

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '71f753c16cd1'
down_revision: Union[str, Sequence[str], None] = '0f51228f1d7c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None




def upgrade() -> None:
    # Directory opt-in — public discoverability
    op.add_column('tenants', sa.Column(
        'directory_visible', sa.Boolean(), nullable=False, server_default='true'
    ))
    op.add_column('tenants', sa.Column(
        'directory_category', sa.String(50), nullable=True
    ))
    op.add_column('tenants', sa.Column(
        'directory_tagline', sa.String(200), nullable=True
    ))

    # Subscription bundle duration support
    op.add_column('subscriptions', sa.Column(
        'duration_days', sa.Integer(), nullable=False, server_default='30'
    ))
    op.add_column('subscriptions', sa.Column(
        'auto_renew_prompted', sa.Boolean(), nullable=False, server_default='false'
    ))


def downgrade() -> None:
    op.drop_column('tenants', 'directory_visible')
    op.drop_column('tenants', 'directory_category')
    op.drop_column('tenants', 'directory_tagline')
    op.drop_column('subscriptions', 'duration_days')
    op.drop_column('subscriptions', 'auto_renew_prompted')
