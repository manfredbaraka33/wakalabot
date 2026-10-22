"""Models for Wakalabot Studio (creator accounts, credits, generation jobs)."""
import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import (
    JSON, Boolean, CheckConstraint, DateTime, ForeignKey, Integer, Numeric, String, Text, func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models import Base  # if your Base lives in app.db, change this one import


class Creator(Base):
    __tablename__ = "creators"
    __table_args__ = (CheckConstraint("credits >= 0", name="ck_creators_credits_nonneg"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    username: Mapped[str] = mapped_column(String(30), unique=True, nullable=False)
    phone: Mapped[str] = mapped_column(String(15), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    brand_name: Mapped[Optional[str]] = mapped_column(String(80))
    contact_phone: Mapped[Optional[str]] = mapped_column(String(20))
    default_style: Mapped[str] = mapped_column(String(20), nullable=False, default="giza")
    credits: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    status: Mapped[str] = mapped_column(String(12), nullable=False, default="active")
    referral_code: Mapped[str] = mapped_column(String(12), unique=True, nullable=False)
    referred_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("creators.id", ondelete="SET NULL"))
    referral_rewarded: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    tos_version: Mapped[str] = mapped_column(String(10), nullable=False)
    tos_accepted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    failed_logins: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    locked_until: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    last_login_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))


class CreatorOtp(Base):
    __tablename__ = "creator_otps"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    phone: Mapped[str] = mapped_column(String(15), nullable=False, index=True)
    purpose: Mapped[str] = mapped_column(String(10), nullable=False)
    code_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    attempts: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    used: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())


class CreditLedger(Base):
    __tablename__ = "credit_ledger"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    creator_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("creators.id", ondelete="CASCADE"), nullable=False, index=True)
    delta: Mapped[int] = mapped_column(Integer, nullable=False)
    balance_after: Mapped[int] = mapped_column(Integer, nullable=False)
    kind: Mapped[str] = mapped_column(String(20), nullable=False)
    job_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), index=True)
    ref: Mapped[Optional[str]] = mapped_column(String(40))
    note: Mapped[Optional[str]] = mapped_column(String(200))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())


class CreatorJob(Base):
    __tablename__ = "creator_jobs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    creator_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("creators.id", ondelete="CASCADE"), nullable=False, index=True)
    kind: Mapped[str] = mapped_column(String(20), nullable=False)
    mode: Mapped[str] = mapped_column(String(12), nullable=False)
    status: Mapped[str] = mapped_column(String(12), nullable=False, default="queued")
    params: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    cost: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    free: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    watermark: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    attempts: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    api_cost_usd: Mapped[float] = mapped_column(Numeric(8, 4), nullable=False, default=0)
    result_path: Mapped[Optional[str]] = mapped_column(String(200))
    result_meta: Mapped[Optional[dict]] = mapped_column(JSON)
    error: Mapped[Optional[str]] = mapped_column(Text)
    moderation_flag: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    files_deleted: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    started_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    finished_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))


class CreatorService(Base):
    __tablename__ = "creator_services"

    key: Mapped[str] = mapped_column(String(40), primary_key=True)
    label: Mapped[str] = mapped_column(String(120), nullable=False)
    cost: Mapped[int] = mapped_column(Integer, nullable=False)
    watermark_cost: Mapped[Optional[int]] = mapped_column(Integer)
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    sort: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    est_cost_tzs: Mapped[int] = mapped_column(Integer, nullable=False, default=0)


class CreditPack(Base):
    __tablename__ = "credit_packs"

    id: Mapped[str] = mapped_column(String(20), primary_key=True)
    label: Mapped[str] = mapped_column(String(60), nullable=False)
    price_tzs: Mapped[int] = mapped_column(Integer, nullable=False)
    credits: Mapped[int] = mapped_column(Integer, nullable=False)
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    sort: Mapped[int] = mapped_column(Integer, nullable=False, default=0)


class CreatorPayment(Base):
    __tablename__ = "creator_payments"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    creator_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("creators.id", ondelete="CASCADE"), nullable=False, index=True)
    pack_id: Mapped[str] = mapped_column(String(20), nullable=False)
    amount_tzs: Mapped[int] = mapped_column(Integer, nullable=False)
    credits: Mapped[int] = mapped_column(Integer, nullable=False)
    bonus_credits: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    method: Mapped[str] = mapped_column(String(12), nullable=False, default="manual")
    reference: Mapped[str] = mapped_column(String(30), unique=True, nullable=False)
    status: Mapped[str] = mapped_column(String(10), nullable=False, default="pending")
    admin_note: Mapped[Optional[str]] = mapped_column(String(200))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    reviewed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))