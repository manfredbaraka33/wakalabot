"""Consumer authentication — phone + password."""
from typing import Optional
import uuid
from datetime import datetime, timedelta, timezone

import bcrypt
from fastapi import APIRouter, Depends, HTTPException, Header, Request
from app.limiter import limiter
from jose import jwt
from pydantic import BaseModel, Field
from sqlalchemy import select,func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import settings
from app.db import get_db
from app.models import Customer,OTPCode

import random
import secrets

from app.sms import send_sms

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

class RequestOTPRequest(BaseModel):
    phone: str = Field(..., min_length=9, max_length=20)


class VerifyOTPRequest(BaseModel):
    phone: str
    code: str = Field(..., min_length=6, max_length=6)
    name: str = Field(..., min_length=2, max_length=100)
    password: str = Field(..., min_length=6, max_length=100)


def _normalize_phone(phone: str) -> str:
    p = phone.strip().replace(" ", "").replace("+", "")
    if p.startswith("0"):
        p = "255" + p[1:]
    elif not p.startswith("255"):
        p = "255" + p
    return p




# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/request-otp")
@limiter.limit("5/minute")
async def request_otp(
    request: Request,
    payload: RequestOTPRequest,
    db: AsyncSession = Depends(get_db),
):
    phone = _normalize_phone(payload.phone)

    # 1. Rate limiting check per phone number (Defensive cap)
    one_hour_ago = datetime.now(timezone.utc) - timedelta(hours=1)
    recent = await db.scalar(
        select(func.count(OTPCode.id)).where(
            OTPCode.phone == phone,
            OTPCode.created_at >= one_hour_ago,
        )
    )
    if recent and recent >= 3:
        raise HTTPException(
            status_code=429,
            detail="Umefikia kikomo cha kuomba OTP. Jaribu tena baada ya saa moja.",
        )

    # FIX: Cryptographically secure 6-digit OTP generation
    code = "".join(secrets.choice("0123456789") for _ in range(6))
    
    db.add(OTPCode(
        phone=phone,
        code=code,
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=10),
        used=False,
    ))
    await db.commit()

    sent = await send_sms(
        phone,
        f"Nambari yako ya uthibitisho ya Wakalabot ni {code}. "
        f"Inaisha muda baada ya dakika 10. Kama hukuomba hii, puuza ujumbe huu."
    )
    if not sent:
        raise HTTPException(status_code=503, detail="Imeshindwa kutuma OTP. Tafadhali jaribu tena.")

    return {"status": "sent"}


@router.post("/verify-otp")
@limiter.limit("5/minute")
async def verify_otp(
    request: Request,
    payload: VerifyOTPRequest,
    db: AsyncSession = Depends(get_db),
):
    phone = _normalize_phone(payload.phone)

    # FIX: Prevent account takeover by verifying if the user already exists first
    existing = await db.execute(select(Customer).where(Customer.phone == phone))
    customer = existing.scalar_one_or_none()
    if customer:
        raise HTTPException(
            status_code=400, 
            detail="Nambari hii ya simu tayari imesajiliwa. Tafadhali ingia au ubadili nenosiri."
        )

    # FIX: Added .with_for_update() to prevent database race conditions
    result = await db.execute(
        select(OTPCode)
        .where(
            OTPCode.phone == phone,
            OTPCode.code == payload.code.strip(),
            OTPCode.used == False,
        )
        .order_by(OTPCode.created_at.desc())
        .limit(1)
        .with_for_update() 
    )
    otp = result.scalar_one_or_none()

    if not otp:
        raise HTTPException(status_code=400, detail="Nambari ya OTP si sahihi.")
    if otp.expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Nambari ya OTP imeisha muda. Omba mpya.")

    # Mark OTP as used immediately
    otp.used = True

    # Safely create the new user profile
    customer = Customer(
        name=payload.name.strip(),
        phone=phone,
        password_hash=_hash(payload.password),  
    )
    db.add(customer)
    await db.flush()

    await db.commit()
    await db.refresh(customer)

    token = _make_token(str(customer.id), customer.phone, customer.name)  
    return {"token": token, "name": customer.name, "phone": customer.phone}



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



class CustomerUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=2, max_length=100)
    phone: Optional[str] = Field(default=None, min_length=9, max_length=20)


class PasswordChange(BaseModel):
    current_password: str
    new_password: str = Field(..., min_length=6)
    code: str = Field(..., min_length=6, max_length=6)


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
    
    # -------------------------------------------------------------------------
    # OTP VERIFICATION PATCH: Validate token code before updating password
    # -------------------------------------------------------------------------
    normalized_phone = _normalize_phone(customer.phone)

    result = await db.execute(
            select(OTPCode)
            .where(
                OTPCode.phone == normalized_phone,  # <-- Crucial update here
                OTPCode.code == payload.code.strip(),
                OTPCode.used == False,
            )
            .order_by(OTPCode.created_at.desc())
            .limit(1)
            .with_for_update()
        )
    otp = result.scalar_one_or_none()

    if not otp:
        raise HTTPException(status_code=400, detail="Nambari ya OTP si sahihi.")
    if otp.expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Nambari ya OTP imeisha muda. Omba mpya.")

    otp.used = True
    # -------------------------------------------------------------------------

    customer.password_hash = _hash(payload.new_password)
    await db.commit()
    return {"status": "updated"}