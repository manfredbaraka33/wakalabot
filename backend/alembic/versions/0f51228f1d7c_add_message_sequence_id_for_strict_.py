"""add_message_sequence_id_for_strict_ordering

Revision ID: 0f51228f1d7c
Revises: 9cf55663d6e0
Create Date: 2026-07-29 18:35:59.799500

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0f51228f1d7c'
down_revision: Union[str, Sequence[str], None] = '9cf55663d6e0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None





def upgrade() -> None:
    # Add the column as nullable first — required since existing rows have no value yet
    op.add_column(
        'messages',
        sa.Column('sequence_id', sa.BigInteger(), nullable=True)
    )

    # Create a dedicated Postgres sequence to drive this column
    op.execute("CREATE SEQUENCE IF NOT EXISTS messages_sequence_id_seq")

    # Backfill existing rows in their current chronological order (by timestamp, then id)
    # so history that's already correct stays correct after the migration
    op.execute("""
        WITH ordered AS (
            SELECT id, ROW_NUMBER() OVER (ORDER BY timestamp ASC, id ASC) AS rn
            FROM messages
        )
        UPDATE messages
        SET sequence_id = ordered.rn
        FROM ordered
        WHERE messages.id = ordered.id
    """)

    # Advance the sequence past the highest backfilled value so future inserts continue correctly
    op.execute("""
        SELECT setval(
            'messages_sequence_id_seq',
            COALESCE((SELECT MAX(sequence_id) FROM messages), 0) + 1,
            false
        )
    """)

    # Attach the sequence as the column's default for all future inserts
    op.execute("""
        ALTER TABLE messages
        ALTER COLUMN sequence_id
        SET DEFAULT nextval('messages_sequence_id_seq')
    """)

    # Now safe to enforce NOT NULL since every row has a value
    op.alter_column('messages', 'sequence_id', nullable=False)

    # Index for fast ordering queries
    op.create_index('ix_messages_sequence_id', 'messages', ['sequence_id'])


def downgrade() -> None:
    op.drop_index('ix_messages_sequence_id', table_name='messages')
    op.execute("ALTER TABLE messages ALTER COLUMN sequence_id DROP DEFAULT")
    op.drop_column('messages', 'sequence_id')
    op.execute("DROP SEQUENCE IF EXISTS messages_sequence_id_seq")
