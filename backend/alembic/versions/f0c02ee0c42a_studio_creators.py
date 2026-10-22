"""studio_creators

Revision ID: f0c02ee0c42a
Revises: 4aad84a2c343
Create Date: 2026-10-20 07:21:30.084983

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'f0c02ee0c42a'
down_revision: Union[str, Sequence[str], None] = '4aad84a2c343'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None



UUID = postgresql.UUID(as_uuid=True)


def upgrade() -> None:
    now = sa.text("now()")

    op.create_table(
        "creators",
        sa.Column("id", UUID, primary_key=True),
        sa.Column("username", sa.String(30), nullable=False, unique=True),
        sa.Column("phone", sa.String(15), nullable=False, unique=True),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column("brand_name", sa.String(80)),
        sa.Column("contact_phone", sa.String(20)),
        sa.Column("default_style", sa.String(20), nullable=False, server_default="giza"),
        sa.Column("credits", sa.Integer, nullable=False, server_default="0"),
        sa.Column("status", sa.String(12), nullable=False, server_default="active"),
        sa.Column("referral_code", sa.String(12), nullable=False, unique=True),
        sa.Column("referred_by", UUID, sa.ForeignKey("creators.id", ondelete="SET NULL")),
        sa.Column("referral_rewarded", sa.Boolean, nullable=False, server_default=sa.false()),
        sa.Column("tos_version", sa.String(10), nullable=False),
        sa.Column("tos_accepted_at", sa.DateTime(timezone=True), nullable=False, server_default=now),
        sa.Column("failed_logins", sa.Integer, nullable=False, server_default="0"),
        sa.Column("locked_until", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=now),
        sa.Column("last_login_at", sa.DateTime(timezone=True)),
        sa.CheckConstraint("credits >= 0", name="ck_creators_credits_nonneg"),
    )

    op.create_table(
        "creator_otps",
        sa.Column("id", UUID, primary_key=True),
        sa.Column("phone", sa.String(15), nullable=False, index=True),
        sa.Column("purpose", sa.String(10), nullable=False),
        sa.Column("code_hash", sa.String(64), nullable=False),
        sa.Column("attempts", sa.Integer, nullable=False, server_default="0"),
        sa.Column("used", sa.Boolean, nullable=False, server_default=sa.false()),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=now),
    )

    op.create_table(
        "credit_ledger",
        sa.Column("id", UUID, primary_key=True),
        sa.Column("creator_id", UUID, sa.ForeignKey("creators.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("delta", sa.Integer, nullable=False),
        sa.Column("balance_after", sa.Integer, nullable=False),
        sa.Column("kind", sa.String(20), nullable=False),
        sa.Column("job_id", UUID, index=True),
        sa.Column("ref", sa.String(40)),
        sa.Column("note", sa.String(200)),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=now),
    )

    op.create_table(
        "creator_jobs",
        sa.Column("id", UUID, primary_key=True),
        sa.Column("creator_id", UUID, sa.ForeignKey("creators.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("kind", sa.String(20), nullable=False),
        sa.Column("mode", sa.String(12), nullable=False),
        sa.Column("status", sa.String(12), nullable=False, server_default="queued"),
        sa.Column("params", sa.JSON, nullable=False),
        sa.Column("cost", sa.Integer, nullable=False, server_default="0"),
        sa.Column("free", sa.Boolean, nullable=False, server_default=sa.false()),
        sa.Column("watermark", sa.Boolean, nullable=False, server_default=sa.false()),
        sa.Column("attempts", sa.Integer, nullable=False, server_default="0"),
        sa.Column("api_cost_usd", sa.Numeric(8, 4), nullable=False, server_default="0"),
        sa.Column("result_path", sa.String(200)),
        sa.Column("result_meta", sa.JSON),
        sa.Column("error", sa.Text),
        sa.Column("moderation_flag", sa.Boolean, nullable=False, server_default=sa.false()),
        sa.Column("files_deleted", sa.Boolean, nullable=False, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=now),
        sa.Column("started_at", sa.DateTime(timezone=True)),
        sa.Column("finished_at", sa.DateTime(timezone=True)),
    )
    op.create_index("ix_creator_jobs_status_created", "creator_jobs", ["status", "created_at"])

    op.create_table(
        "creator_services",
        sa.Column("key", sa.String(40), primary_key=True),
        sa.Column("label", sa.String(120), nullable=False),
        sa.Column("cost", sa.Integer, nullable=False),
        sa.Column("watermark_cost", sa.Integer),
        sa.Column("active", sa.Boolean, nullable=False, server_default=sa.true()),
        sa.Column("sort", sa.Integer, nullable=False, server_default="0"),
    )

    op.create_table(
        "credit_packs",
        sa.Column("id", sa.String(20), primary_key=True),
        sa.Column("label", sa.String(60), nullable=False),
        sa.Column("price_tzs", sa.Integer, nullable=False),
        sa.Column("credits", sa.Integer, nullable=False),
        sa.Column("active", sa.Boolean, nullable=False, server_default=sa.true()),
        sa.Column("sort", sa.Integer, nullable=False, server_default="0"),
    )

    op.create_table(
        "creator_payments",
        sa.Column("id", UUID, primary_key=True),
        sa.Column("creator_id", UUID, sa.ForeignKey("creators.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("pack_id", sa.String(20), nullable=False),
        sa.Column("amount_tzs", sa.Integer, nullable=False),
        sa.Column("credits", sa.Integer, nullable=False),
        sa.Column("bonus_credits", sa.Integer, nullable=False, server_default="0"),
        sa.Column("method", sa.String(12), nullable=False, server_default="manual"),
        sa.Column("reference", sa.String(30), nullable=False, unique=True),
        sa.Column("status", sa.String(10), nullable=False, server_default="pending"),
        sa.Column("admin_note", sa.String(200)),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=now),
        sa.Column("reviewed_at", sa.DateTime(timezone=True)),
    )

    services = sa.table(
        "creator_services",
        sa.column("key", sa.String), sa.column("label", sa.String), sa.column("cost", sa.Integer),
        sa.column("watermark_cost", sa.Integer), sa.column("active", sa.Boolean), sa.column("sort", sa.Integer),
    )
    op.bulk_insert(services, [
        {"key": "poster_template", "label": "Tangazo la Template", "cost": 2, "watermark_cost": 0, "active": True, "sort": 1},
        {"key": "poster_ai", "label": "Tangazo la AI (andika maelezo)", "cost": 10, "watermark_cost": None, "active": True, "sort": 2},
        {"key": "poster_ai_voice", "label": "Tangazo la AI (sema kwa sauti)", "cost": 14, "watermark_cost": None, "active": True, "sort": 3},
        {"key": "video_lite", "label": "Video ya AI (sekunde 8, kawaida)", "cost": 40, "watermark_cost": None, "active": False, "sort": 4},
        {"key": "video_fast", "label": "Video ya AI (sekunde 8, haraka)", "cost": 70, "watermark_cost": None, "active": False, "sort": 5},
        {"key": "video_pro", "label": "Video ya AI (sekunde 8, ubora wa juu + sauti)", "cost": 200, "watermark_cost": None, "active": False, "sort": 6},
    ])

    packs = sa.table(
        "credit_packs",
        sa.column("id", sa.String), sa.column("label", sa.String), sa.column("price_tzs", sa.Integer),
        sa.column("credits", sa.Integer), sa.column("active", sa.Boolean), sa.column("sort", sa.Integer),
    )
    op.bulk_insert(packs, [
        {"id": "anza", "label": "Anza", "price_tzs": 2000, "credits": 20, "active": True, "sort": 1},
        {"id": "biashara", "label": "Biashara", "price_tzs": 5000, "credits": 55, "active": True, "sort": 2},
        {"id": "pro", "label": "Pro", "price_tzs": 10000, "credits": 120, "active": True, "sort": 3},
        {"id": "studio", "label": "Studio", "price_tzs": 25000, "credits": 325, "active": True, "sort": 4},
    ])


def downgrade() -> None:
    for t in ("creator_payments", "credit_packs", "creator_services", "creator_jobs",
              "credit_ledger", "creator_otps", "creators"):
        op.drop_table(t)