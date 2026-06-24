from typing import List, Optional
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator


class RegisterRequest(BaseModel):
    username: str = Field(
        ..., min_length=3, max_length=100,
        pattern=r'^[a-zA-Z0-9_]+$',
    )
    business_name: str = Field(..., min_length=2, max_length=255)
    phone: Optional[str] = Field(default=None, max_length=20)
    password: str = Field(..., min_length=8)


class LoginRequest(BaseModel):
    username: str
    password: str

    @field_validator("username")
    @classmethod
    def normalise_username(cls, v: str) -> str:
        return v.strip().lower()



class UserInfo(BaseModel):
    username: str
    email: Optional[str] = None
    business_name: str
    phone: Optional[str] = None
    slug: Optional[str] = None
    is_verified: bool = False
    ai_mode: str = "eco"


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(..., min_length=1)
    new_password: str = Field(..., min_length=8)


class TokenResponse(BaseModel):
    token: str
    tenant_id: str
    user: UserInfo


# ── Knowledge Base CRUD ───────────────────────────────────────────────────────

class KBEntryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    content: str


class KBCreateRequest(BaseModel):
    content: str = Field(..., min_length=1, max_length=10_000)


class KBUpdateRequest(BaseModel):
    content: str = Field(..., min_length=1, max_length=10_000)


class KBListResponse(BaseModel):
    entries: List[KBEntryResponse]
    total: int


# ── Products CRUD ─────────────────────────────────────────────────────────────

class ProductResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    description: str
    price: float
    stock_quantity: int
    category: str
    image_url: Optional[str]
    is_active: bool
    last_updated: Optional[str] = None


class ProductCreateRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: str = Field(default="", max_length=5000)
    price: float = Field(..., ge=0)
    stock_quantity: int = Field(..., ge=0)
    category: str = Field(default="product", max_length=50)
    image_url: Optional[str] = Field(default=None, max_length=2048)
    is_active: bool = True


class ProductUpdateRequest(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=255)
    description: Optional[str] = Field(default=None, max_length=5000)
    price: Optional[float] = Field(default=None, ge=0)
    stock_quantity: Optional[int] = Field(default=None, ge=0)
    category: Optional[str] = Field(default=None, max_length=50)
    image_url: Optional[str] = Field(default=None, max_length=2048)
    is_active: Optional[bool] = None


class ProductListResponse(BaseModel):
    products: List[ProductResponse]
    total: int


# ── Billing ───────────────────────────────────────────────────────────────────

class WalletOut(BaseModel):
    balance: int
    last_updated: Optional[datetime] = None


class TransactionOut(BaseModel):
    id: str
    coin_amount: int
    tx_type: str
    prompt_tokens: Optional[int] = None
    completion_tokens: Optional[int] = None
    usd_cost: Optional[float] = None
    amount_tzs: Optional[int] = None
    package_id: Optional[str] = None
    note: Optional[str] = None
    created_at: datetime





# ── Support Tickets ───────────────────────────────────────────────────────────

TICKET_CATEGORIES = ("billing", "technical", "feature_request", "general")
TICKET_STATUSES = ("pending", "in_progress", "resolved")


class SupportTicketCreate(BaseModel):
    subject: str = Field(..., min_length=3, max_length=255)
    category: str = Field(..., pattern=r"^(billing|technical|feature_request|general)$")
    message: str = Field(..., min_length=10, max_length=5000)


class SupportTicketOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    subject: str
    category: str
    message: str
    status: str
    admin_reply: Optional[str] = None
    created_at: datetime
    updated_at: datetime


# ── SuperAdmin ────────────────────────────────────────────────────────────────

class SuperAdminAuthRequest(BaseModel):
    secret: str


class SuperAdminTokenResponse(BaseModel):
    token: str


class AdminTicketUpdate(BaseModel):
    status: Optional[str] = Field(default=None, pattern=r"^(pending|in_progress|resolved)$")
    admin_reply: Optional[str] = Field(default=None, max_length=5000)


class AdminAddCoinsRequest(BaseModel):
    coins: int = Field(..., gt=0, le=100_000)


class AdminResetPasswordRequest(BaseModel):
    new_password: str = Field(..., min_length=8)



class AiModeRequest(BaseModel):
    ai_mode: str = Field(..., pattern=r"^(eco|smart)$")



# ── Payment Requests ──────────────────────────────────────────────────────────

COIN_PACKAGES = [
    {"id": "basic", "amount_tzs": 5000, "coins": 150, "label": "Basic"},
    {"id": "standard", "amount_tzs": 15000, "coins": 350, "label": "Standard"},
    {"id": "premium", "amount_tzs": 30000, "coins": 800, "label": "Premium"},
    {"id": "business", "amount_tzs": 50000, "coins": 1500, "label": "Business"},
]


class PaymentRequestCreate(BaseModel):
    package_id: str = Field(..., min_length=1)
    mpesa_ref: str = Field(..., min_length=3, max_length=100)


class PaymentRequestOut(BaseModel):
    id: str
    amount_tzs: int
    coins_requested: int
    package_id: str
    mpesa_ref: str
    status: str
    admin_note: Optional[str] = None
    created_at: datetime


class AdminPaymentAction(BaseModel):
    admin_note: Optional[str] = Field(default=None, max_length=255)



# ── Shop Settings Extended ────────────────────────────────────────────────────

class ShopSettingsRequest(BaseModel):
    opening_time: str = Field(..., min_length=1, max_length=10)
    closing_time: str = Field(..., min_length=1, max_length=10)
    location: str = Field(..., min_length=2, max_length=500)
    contact_phone: str = Field(..., min_length=6, max_length=50)
    website_url: Optional[str] = Field(default=None, max_length=500)
    delivery_zones: Optional[str] = Field(default=None, max_length=2000)
    business_description: Optional[str] = Field(default=None, max_length=1000)


class ShopSettingsResponse(BaseModel):
    opening_time: str
    closing_time: str
    location: str
    contact_phone: str
    website_url: Optional[str] = None
    delivery_zones: Optional[str] = None
    business_description: Optional[str] = None


# ── Notifications ─────────────────────────────────────────────────────────────

class NotificationOut(BaseModel):
    id: str
    type: str
    message: str
    is_read: bool
    created_at: datetime


# ── Message Feedback ──────────────────────────────────────────────────────────

class MessageFeedbackCreate(BaseModel):
    message_id: str
    rating: str = Field(..., pattern=r"^(positive|negative)$")
    comment: Optional[str] = Field(default=None, max_length=500)


# ── AiMode ───────────────────────────────────────────────────────────────────

class AiModeRequest(BaseModel):
    ai_mode: str = Field(..., pattern=r"^(eco|smart)$")



# ── Subscription plan ───────────────────────────────────────────────────────────────────

SUBSCRIPTION_PLANS = [
    {
        "id": "starter",
        "label": "Starter",
        "amount_tzs": 15000,
        "messages_included": 500,
        "ai_mode": "eco",
        "description": "Biashara ndogo — mazungumzo 500 kwa mwezi"
    },
    {
        "id": "business",
        "label": "Business",
        "amount_tzs": 40000,
        "messages_included": 2000,
        "ai_mode": "eco",
        "description": "Biashara inayokua — mazungumzo 2,000 kwa mwezi"
    },
    {
        "id": "pro",
        "label": "Pro",
        "amount_tzs": 80000,
        "messages_included": 6000,
        "ai_mode": "smart",
        "description": "Biashara kubwa — mazungumzo 6,000 + Smart AI"
    },
]