"""Consumer authentication — phone + password."""
from typing import Optional
import uuid
from datetime import datetime, timedelta, timezone

import bcrypt
from fastapi import APIRouter, Depends, HTTPException, Header, Request
from app.limiter import limiter
from jose import jwt
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import settings
from app.db import get_db
from app.models import Customer

import random
import string
from app.models import NumberClaim

router = APIRouter(prefix="/customer", tags=["customer-auth"])

_ALGO = "HS256"
_EXP_DAYS = 30  # long session — customer shouldn't re-login constantly

ADMIN_WHATSAPP = "+255712750468"

def _hash(pw: str) -> str:
    pw_bytes = pw.encode("utf-8")
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(pw_bytes, salt).decode("utf-8")


def _verify(pw: str, hashed: str) -> bool:
    pw_bytes = pw.encode("utf-8")
    hashed_bytes = hashed.encode("utf-8")
    return bcrypt.checkpw(pw_bytes, hashed_bytes)


def _make_token(customer_id: str, phone: str, name: str) -> str:
    exp = datetime.now(timezone.utc) + timedelta(days=_EXP_DAYS)
    return jwt.encode(
        {"sub": customer_id, "phone": phone, "name": name, "exp": exp},
        settings.JWT_SECRET_KEY,
        algorithm=_ALGO,
    )


def decode_customer_token(token: str) -> dict:
    try:
        return jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[_ALGO])
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired token")


# ── Schemas ───────────────────────────────────────────────────────────────────

class CustomerRegister(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    phone: str = Field(..., min_length=9, max_length=20)
    password: str = Field(..., min_length=6)


class CustomerLogin(BaseModel):
    phone: str
    password: str


class CustomerOut(BaseModel):
    id: str
    name: str
    phone: str
    token: str


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/register", response_model=CustomerOut)
@limiter.limit("5/minute")
async def register(request: Request, payload: CustomerRegister, db: AsyncSession = Depends(get_db)):
    # Normalize phone
    phone = payload.phone.strip().replace(" ", "")

    # Check existing
    existing = await db.execute(
        select(Customer).where(Customer.phone == phone)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=409,
            detail="Nambari hii ya simu tayari imesajiliwa. Ingia badala yake."
        )

    customer = Customer(
        name=payload.name.strip().title(),
        phone=phone,
        password_hash=_hash(payload.password),
    )
    db.add(customer)
    await db.commit()
    await db.refresh(customer)

    token = _make_token(str(customer.id), customer.phone, customer.name)
    return CustomerOut(id=str(customer.id), name=customer.name, phone=customer.phone, token=token)


@router.post("/login", response_model=CustomerOut)
@limiter.limit("5/minute")
async def login(request: Request, payload: CustomerLogin, db: AsyncSession = Depends(get_db)):
    phone = payload.phone.strip().replace(" ", "")
    result = await db.execute(select(Customer).where(Customer.phone == phone))
    customer = result.scalar_one_or_none()

    if not customer or not _verify(payload.password, customer.password_hash):
        raise HTTPException(
            status_code=401,
            detail="Nambari ya simu au neno la siri si sahihi."
        )

    token = _make_token(str(customer.id), customer.phone, customer.name)
    return CustomerOut(id=str(customer.id), name=customer.name, phone=customer.phone, token=token)


class NumberClaimRequest(BaseModel):
    phone: str = Field(..., min_length=9, max_length=20)
    claimant_name: str = Field(..., min_length=2, max_length=100)
    claimant_contact: str = Field(..., min_length=5, max_length=200,
        description="WhatsApp number or email where admin can reach you")


class NumberClaimOut(BaseModel):
    claim_code: str
    whatsapp_number: str
    message: str

def _generate_claim_code() -> str:
    return "WKB-" + "".join(random.choices(string.digits, k=6))


@router.post("/claim-number", response_model=NumberClaimOut)
@limiter.limit("3/minute")
async def claim_number(
    request: Request,
    payload: NumberClaimRequest,
    db: AsyncSession = Depends(get_db),
):
    """Submit a claim that a phone number belongs to you."""
    phone = payload.phone.strip().replace(" ", "")

    # Check number actually exists in system
    existing = await db.execute(
        select(Customer).where(Customer.phone == phone)
    )
    if not existing.scalar_one_or_none():
        raise HTTPException(
            status_code=404,
            detail="Nambari hii haipo kwenye mfumo wetu."
        )

    # Check no pending claim already
    pending = await db.execute(
        select(NumberClaim).where(
            NumberClaim.phone == phone,
            NumberClaim.status == "pending",
        )
    )
    if pending.scalar_one_or_none():
        raise HTTPException(
            status_code=409,
            detail="Madai tayari yako kwa nambari hii. Subiri majibu."
        )

    # Generate unique claim code
    code = _generate_claim_code()
    while True:
        existing_code = await db.execute(
            select(NumberClaim).where(NumberClaim.claim_code == code)
        )
        if not existing_code.scalar_one_or_none():
            break
        code = _generate_claim_code()

    claim = NumberClaim(
        phone=phone,
        claimant_name=payload.claimant_name.strip().title(),
        claimant_contact=payload.claimant_contact.strip(),
        claim_code=code,
        status="pending",
    )
    db.add(claim)
    await db.commit()
    await db.refresh(claim)

    return NumberClaimOut(
        claim_code=code,
        whatsapp_number=ADMIN_WHATSAPP,
        message=(
            f"Madai yako yamesajiliwa. Tuma neno hili kwa WhatsApp "
            f"{ADMIN_WHATSAPP}: '{code} - {payload.claimant_name}' "
            f"na tutakupigia simu kukuthibitisha."
        ),
    )



class CustomerUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=2, max_length=100)
    phone: Optional[str] = Field(default=None, min_length=9, max_length=20)


class PasswordChange(BaseModel):
    current_password: str
    new_password: str = Field(..., min_length=6)


async def get_current_customer(
    authorization: str = Header(...),
    db: AsyncSession = Depends(get_db),
) -> Customer:
    token = authorization.replace("Bearer ", "")
    payload = decode_customer_token(token)
    result = await db.execute(
        select(Customer).where(Customer.id == uuid.UUID(payload["sub"]))
    )
    customer = result.scalar_one_or_none()
    if not customer:
        raise HTTPException(status_code=401, detail="Customer not found")
    return customer


@router.get("/me", response_model=CustomerOut)
async def get_me(customer: Customer = Depends(get_current_customer)) -> CustomerOut:
    return CustomerOut(
        id=str(customer.id),
        name=customer.name,
        phone=customer.phone,
        token="",  # Don't re-issue
    )


@router.patch("/me", response_model=CustomerOut)
async def update_me(
    payload: CustomerUpdate,
    customer: Customer = Depends(get_current_customer),
    db: AsyncSession = Depends(get_db),
) -> CustomerOut:
    if payload.name:
        customer.name = payload.name.strip().title()
    if payload.phone:
        phone = payload.phone.strip().replace(" ", "")
        # Check not taken by someone else
        existing = await db.execute(
            select(Customer).where(
                Customer.phone == phone,
                Customer.id != customer.id,
            )
        )
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=409, detail="Nambari hii tayari inatumika.")
        customer.phone = phone
    await db.commit()
    token = _make_token(str(customer.id), customer.phone, customer.name)
    return CustomerOut(id=str(customer.id), name=customer.name, phone=customer.phone, token=token)


@router.post("/change-password")
async def change_password(
    payload: PasswordChange,
    customer: Customer = Depends(get_current_customer),
    db: AsyncSession = Depends(get_db),
) -> dict:
    if not _verify(payload.current_password, customer.password_hash):
        raise HTTPException(status_code=400, detail="Neno la siri la sasa si sahihi.")
    customer.password_hash = _hash(payload.new_password)
    await db.commit()
    return {"status": "updated"}