import uuid
from typing import Optional

from pgvector.sqlalchemy import Vector
from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, Index, Integer, Numeric, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db import Base


class Tenant(Base):
    __tablename__ = "tenants"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    biz_name: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[Optional[str]] = mapped_column(
        String(100), unique=True, nullable=True, index=True
    )

    # ── App Auth ───────────────────────────────────────────────────────────────
    email: Mapped[str] = mapped_column(
        String(255), unique=True, nullable=False, index=True
    )
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    phone: Mapped[Optional[str]] = mapped_column(
        String(50), unique=True, nullable=True, index=True
    )

    # ── Widget CORS ────────────────────────────────────────────────────────────
    # Comma-separated list of allowed domains for the embeddable widget
    widget_domains: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # ── AI Model preference ────────────────────────────────────────────────────
    # 'eco' = llama-3.1-8b-instant | 'smart' = meta-llama/llama-4-scout-17b-16e-instruct
    ai_mode: Mapped[str] = mapped_column(
        String(20), nullable=False, default="eco"
    )
    is_verified: Mapped[bool] = mapped_column(
    Boolean, nullable=False, default=False
)

    wallet: Mapped["Wallet"] = relationship(
        "Wallet", back_populates="tenant", uselist=False, cascade="all, delete-orphan"
    )
    knowledge_base: Mapped[list["KnowledgeBase"]] = relationship(
        "KnowledgeBase", back_populates="tenant", cascade="all, delete-orphan"
    )
    products: Mapped[list["Product"]] = relationship(
        "Product", back_populates="tenant", cascade="all, delete-orphan"
    )
    conversations: Mapped[list["Conversation"]] = relationship(
        "Conversation", back_populates="tenant", cascade="all, delete-orphan"
    )
    support_tickets: Mapped[list["SupportTicket"]] = relationship(
        "SupportTicket", back_populates="tenant", cascade="all, delete-orphan"
    )
    website_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    delivery_zones: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    business_description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)


class Wallet(Base):
    __tablename__ = "wallets"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
    )
    balance: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    last_updated: Mapped[object] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    tenant: Mapped["Tenant"] = relationship("Tenant", back_populates="wallet")
    transactions: Mapped[list["Transaction"]] = relationship(
        "Transaction", back_populates="wallet", cascade="all, delete-orphan"
    )


class Transaction(Base):
    """Coin credit/deduction record."""

    __tablename__ = "transactions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    wallet_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("wallets.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    # positive = credit (admin top-up), negative = deduction (AI usage)
    coin_amount: Mapped[int] = mapped_column(Integer, nullable=False)
    # 'credit' = admin top-up | 'deduction' = AI usage
    tx_type: Mapped[str] = mapped_column(
        Enum("credit", "deduction", name="transaction_type"),
        nullable=False,
        default="credit",
    )
    # For deductions: raw token counts and USD cost for transparency
    prompt_tokens: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    completion_tokens: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    usd_cost: Mapped[Optional[float]] = mapped_column(Numeric(10, 8), nullable=True)
    # For credits: TZS amount paid and package reference
    amount_tzs: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    package_id: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    note: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    created_at: Mapped[object] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    wallet: Mapped["Wallet"] = relationship("Wallet", back_populates="transactions")


class KnowledgeBase(Base):
    __tablename__ = "knowledge_base"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    content: Mapped[str] = mapped_column(Text, nullable=False)
    embedding: Mapped[list] = mapped_column(Vector(384), nullable=True)
    image_url: Mapped[Optional[str]] = mapped_column(String(2048), nullable=True)

    tenant: Mapped["Tenant"] = relationship("Tenant", back_populates="knowledge_base")


class Product(Base):
    __tablename__ = "products"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")
    category: Mapped[str] = mapped_column(String(50), nullable=False, default="product")
    price: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=0.00)
    stock_quantity: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    image_url: Mapped[Optional[str]] = mapped_column(String(2048), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    kb_entry_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), nullable=True
    )
    last_updated: Mapped[Optional[object]] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    tenant: Mapped["Tenant"] = relationship("Tenant", back_populates="products")


class Conversation(Base):
    """One conversation thread per unique customer per tenant."""

    __tablename__ = "conversations"
    __table_args__ = (
        Index("ix_conversations_tenant_phone", "tenant_id", "customer_phone"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    customer_phone: Mapped[str] = mapped_column(String(50), nullable=False)
    customer_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    created_at: Mapped[object] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    tenant: Mapped["Tenant"] = relationship("Tenant", back_populates="conversations")
    messages: Mapped[list["Message"]] = relationship(
        "Message", back_populates="conversation", cascade="all, delete-orphan",
        order_by="Message.timestamp",
    )

    lead_events: Mapped[list["LeadEvent"]] = relationship(
        "LeadEvent", back_populates="conversation", cascade="all, delete-orphan",
    )


class Message(Base):
    """A single chat turn stored for conversation history."""

    __tablename__ = "messages"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    conversation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("conversations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    role: Mapped[str] = mapped_column(String(20), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    image_url: Mapped[Optional[str]] = mapped_column(String(2048), nullable=True)
    timestamp: Mapped[object] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    conversation: Mapped["Conversation"] = relationship(
        "Conversation", back_populates="messages"
    )
    tool_summary: Mapped[Optional[str]] = mapped_column(Text, nullable=True)


class OTPCode(Base):
    """Short-lived OTP codes for phone-based authentication."""

    __tablename__ = "otp_codes"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    phone: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    code: Mapped[str] = mapped_column(String(10), nullable=False)
    expires_at: Mapped[object] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    used: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[object] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )



class PaymentRequest(Base):
    """Merchant manual payment top-up request."""

    __tablename__ = "payment_requests"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    amount_tzs: Mapped[int] = mapped_column(Integer, nullable=False)
    coins_requested: Mapped[int] = mapped_column(Integer, nullable=False)
    package_id: Mapped[str] = mapped_column(String(50), nullable=False)
    mpesa_ref: Mapped[str] = mapped_column(String(100), nullable=False)
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="pending"
    )
    admin_note: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    created_at: Mapped[object] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[object] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    tenant: Mapped["Tenant"] = relationship("Tenant")





class SupportTicket(Base):
    """User-submitted support ticket linked to a Tenant."""

    __tablename__ = "support_tickets"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    subject: Mapped[str] = mapped_column(String(255), nullable=False)
    category: Mapped[str] = mapped_column(
        Enum(
            "billing", "technical", "feature_request", "general",
            name="ticket_category",
        ),
        nullable=False,
        default="general",
    )
    message: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(
        Enum("pending", "in_progress", "resolved", name="ticket_status"),
        nullable=False,
        default="pending",
    )
    admin_reply: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[object] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[object] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    tenant: Mapped["Tenant"] = relationship("Tenant", back_populates="support_tickets")


class LeadEvent(Base):
        """Captured customer intent during a conversation."""

        __tablename__ = "lead_events"

        id: Mapped[uuid.UUID] = mapped_column(
            UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
        )
        tenant_id: Mapped[uuid.UUID] = mapped_column(
            UUID(as_uuid=True),
            ForeignKey("tenants.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        )
        conversation_id: Mapped[uuid.UUID] = mapped_column(
            UUID(as_uuid=True),
            ForeignKey("conversations.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        )
        customer_phone: Mapped[str] = mapped_column(String(50), nullable=False)
        customer_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
        # order_intent | appointment_intent | price_inquiry | general_interest
        event_type: Mapped[str] = mapped_column(String(50), nullable=False)
        product_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
        # Allowed: pending / hot / cold / resolved
        status: Mapped[str] = mapped_column(
            String(20), nullable=False, default="pending"
        )
        customer_response: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
        created_at: Mapped[object] = mapped_column(
            DateTime(timezone=True), server_default=func.now(), nullable=False
        )

        conversation: Mapped["Conversation"] = relationship(
            "Conversation", back_populates="lead_events"
        )



class CustomerNote(Base):
    """Agent-written observations about a customer."""

    __tablename__ = "customer_notes"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    conversation_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("conversations.id", ondelete="SET NULL"),
        nullable=True, index=True,
    )
    customer_phone: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[object] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class Notification(Base):
    """Merchant notifications generated by the agent."""

    __tablename__ = "notifications"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    type: Mapped[str] = mapped_column(String(50), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    is_read: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[object] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class MessageFeedback(Base):
    """Customer feedback on AI responses."""

    __tablename__ = "message_feedback"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    conversation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("conversations.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    message_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("messages.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    rating: Mapped[str] = mapped_column(String(10), nullable=False)
    comment: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[object] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )



class Customer(Base):
    """Consumer/customer accounts for chat."""

    __tablename__ = "customers"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    phone: Mapped[str] = mapped_column(String(20), nullable=False, unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[object] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class NumberClaim(Base):
    """Customer number ownership dispute claims."""

    __tablename__ = "number_claims"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    phone: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    claimant_name: Mapped[str] = mapped_column(String(100), nullable=False)
    claimant_contact: Mapped[str] = mapped_column(String(200), nullable=False)
    claim_code: Mapped[str] = mapped_column(String(20), nullable=False, unique=True, index=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending")
    admin_note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[object] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )



class Subscription(Base):
    """Tenant monthly flat-fee subscription."""

    __tablename__ = "subscriptions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False, unique=True, index=True,
    )
    plan_id: Mapped[str] = mapped_column(String(50), nullable=False)
    messages_included: Mapped[int] = mapped_column(Integer, nullable=False)
    messages_used: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="active")
    # active / expired / cancelled
    started_at: Mapped[object] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    expires_at: Mapped[object] = mapped_column(
        DateTime(timezone=True), nullable=False
    )


class UnansweredQuestion(Base):
    """Questions customers asked that the agent could not answer."""

    __tablename__ = "unanswered_questions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    question: Mapped[str] = mapped_column(Text, nullable=False)
    category: Mapped[str] = mapped_column(String(50), nullable=False, default="other")
    customer_phone: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    is_resolved: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[object] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )