"""
Authentication utilities and endpoints (register / login).
"""
import hashlib
import re as _re
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

from app.limiter import limiter

import bcrypt as _bcrypt
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import settings
from app.db import get_db
from app.models import Tenant, Wallet
from app.schemas import (
    LoginRequest, RegisterRequest, TokenResponse, UserInfo,
    ChangePasswordRequest, AiModeRequest,
)

router = APIRouter(prefix="/auth", tags=["auth"])

_BCRYPT_ROUNDS = 12


def _prepare(password: str) -> bytes:
    return hashlib.sha256(password.encode()).hexdigest().encode()


def hash_password(password: str) -> str:
    return _bcrypt.hashpw(_prepare(password), _bcrypt.gensalt(rounds=_BCRYPT_ROUNDS)).decode()


def verify_password(plain: str, hashed: str) -> bool:
    return _bcrypt.checkpw(_prepare(plain), hashed.encode())


def _make_slug(name: str) -> str:
    slug = name.lower().strip()
    slug = _re.sub(r'[^a-z0-9]+', '-', slug)
    slug = slug.strip('-')
    return slug[:50]


_oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


def create_access_token(subject: str, expires_delta: Optional[timedelta] = None) -> str:
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=settings.JWT_EXPIRE_MINUTES)
    )
    return jwt.encode(
        {"sub": subject, "exp": expire},
        settings.JWT_SECRET_KEY,
        algorithm=settings.JWT_ALGORITHM,
    )


async def get_current_tenant(
    token: str = Depends(_oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> Tenant:
    exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
        tenant_id: Optional[str] = payload.get("sub")
        if tenant_id is None:
            raise exc
    except JWTError:
        raise exc

    result = await db.execute(select(Tenant).where(Tenant.id == uuid.UUID(tenant_id)))
    tenant = result.scalar_one_or_none()
    if tenant is None:
        raise exc
    return tenant


def _build_token_response(tenant: Tenant) -> TokenResponse:
    token = create_access_token(str(tenant.id))
    return TokenResponse(
        token=token,
        tenant_id=str(tenant.id),
        user=UserInfo(
            username=tenant.username,
            email=tenant.email,
            business_name=tenant.biz_name,
            phone=tenant.phone,
            slug=tenant.slug,
            is_verified=tenant.is_verified,
            ai_mode=tenant.ai_mode,
            logo_url=tenant.logo_url,
            bot_type=tenant.bot_type,
        ),
    )


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("5/minute")
async def register(request: Request, payload: RegisterRequest, db: AsyncSession = Depends(get_db)):
    username = payload.username.lower().strip()

    existing = await db.execute(select(Tenant).where(Tenant.username == username))
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This username is already taken. Please choose another.",
        )

    base_slug = _make_slug(payload.business_name)
    slug = base_slug
    counter = 1
    while True:
        existing_slug = await db.execute(select(Tenant).where(Tenant.slug == slug))
        if not existing_slug.scalar_one_or_none():
            break
        slug = f"{base_slug}-{counter}"
        counter += 1

    tenant = Tenant(
        biz_name=payload.business_name,
        username=username,
        phone=payload.phone.strip() if payload.phone else None,
        hashed_password=hash_password(payload.password),
        slug=slug,
        bot_type=payload.bot_type,
    )
    db.add(tenant)
    await db.flush()

    wallet = Wallet(tenant_id=tenant.id, balance=100)
    db.add(wallet)
    await db.commit()
    await db.refresh(tenant)

    from app.sms import send_sms
    base_url = "https://wakalabot.co.tz"
    chat_link = f"{base_url}/chat/{slug}"
    dashboard_link = f"{base_url}/dashboard"
    if tenant.phone:
        await send_sms(
            tenant.phone,
            f"Hongera {tenant.biz_name}! Akaunti yako ya Wakalabot imeundwa.\n"
            f"Link ya wateja: {chat_link}\n"
            f"Dashibodi: {dashboard_link}"
        )

    return _build_token_response(tenant)


@router.post("/login", response_model=TokenResponse)
@limiter.limit("5/minute")
async def login(request: Request, payload: LoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Tenant).where(Tenant.username == payload.username.lower())
    )
    tenant = result.scalar_one_or_none()

    if not tenant or not verify_password(payload.password, tenant.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password.",
        )

    return _build_token_response(tenant)


@router.get("/me", response_model=TokenResponse)
@limiter.limit("30/minute")
async def get_me(request: Request, tenant: Tenant = Depends(get_current_tenant)):
    return _build_token_response(tenant)


@router.post("/change-password", status_code=status.HTTP_204_NO_CONTENT)
@limiter.limit("3/minute")
async def change_password(
    request: Request,
    payload: ChangePasswordRequest,
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
):
    if not verify_password(payload.current_password, tenant.hashed_password):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Current password is incorrect")
    if payload.current_password == payload.new_password:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="New password must differ from current")
    tenant.hashed_password = hash_password(payload.new_password)
    await db.commit()


@router.patch("/ai-mode", status_code=status.HTTP_204_NO_CONTENT)
@limiter.limit("3/minute")
async def update_ai_mode(
    request: Request,
    payload: AiModeRequest,
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
):
    if payload.ai_mode not in ("eco", "smart"):
        raise HTTPException(status_code=400, detail="Invalid mode")
    tenant.ai_mode = payload.ai_mode
    await db.commit()


class TenantProfileUpdate(BaseModel):
    biz_name: Optional[str] = Field(default=None, min_length=2, max_length=255)
    username: Optional[str] = Field(
        default=None, min_length=3, max_length=100,
        pattern=r'^[a-zA-Z0-9_]+$',
    )
    email: Optional[str] = Field(default=None)
    phone: Optional[str] = Field(default=None)


@router.patch("/me/profile")
@limiter.limit("5/minute")
async def update_profile(
    request: Request,
    payload: TenantProfileUpdate,
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
) -> dict:
    if payload.biz_name:
        tenant.biz_name = payload.biz_name.strip()

    if payload.username:
        new_username = payload.username.lower().strip()
        if new_username != tenant.username:
            existing = await db.execute(
                select(Tenant).where(Tenant.username == new_username, Tenant.id != tenant.id)
            )
            if existing.scalar_one_or_none():
                raise HTTPException(status_code=409, detail="Username already taken.")
            tenant.username = new_username

    if payload.email is not None:
        if payload.email.strip():
            email = payload.email.strip().lower()
            existing = await db.execute(
                select(Tenant).where(Tenant.email == email, Tenant.id != tenant.id)
            )
            # if existing.scalar_one_or_none():
            #     raise HTTPException(status_code=409, detail="Email already in use.")
            tenant.email = email
        else:
            tenant.email = None

    if payload.phone is not None:
        tenant.phone = payload.phone.strip() or None

    await db.commit()
    return {
        "username": tenant.username,
        "biz_name": tenant.biz_name,
        "email": tenant.email,
        "phone": tenant.phone,
    }