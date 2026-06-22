"""
Authentication utilities and endpoints (register / login).

JWT is issued by this module.  The `get_current_tenant` dependency is imported
by other routers that need a logged-in user.
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
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import settings
from app.db import get_db
from app.models import Tenant, Wallet
from app.schemas import LoginRequest, RegisterRequest, TokenResponse, UserInfo, ChangePasswordRequest

router = APIRouter(prefix="/auth", tags=["auth"])

# ── Password hashing ──────────────────────────────────────────────────────────
_BCRYPT_ROUNDS = 12


def _prepare(password: str) -> bytes:
    return hashlib.sha256(password.encode()).hexdigest().encode()


def hash_password(password: str) -> str:
    return _bcrypt.hashpw(_prepare(password), _bcrypt.gensalt(rounds=_BCRYPT_ROUNDS)).decode()


def verify_password(plain: str, hashed: str) -> bool:
    return _bcrypt.checkpw(_prepare(plain), hashed.encode())


# ── Slug generation ───────────────────────────────────────────────────────────

def _make_slug(name: str) -> str:
    slug = name.lower().strip()
    slug = _re.sub(r'[^a-z0-9]+', '-', slug)
    slug = slug.strip('-')
    return slug[:50]


# ── JWT ───────────────────────────────────────────────────────────────────────
_oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


def create_access_token(
    subject: str, expires_delta: Optional[timedelta] = None
) -> str:
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
        payload = jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM],
        )
        tenant_id: Optional[str] = payload.get("sub")
        if tenant_id is None:
            raise exc
    except JWTError:
        raise exc

    result = await db.execute(
        select(Tenant).where(Tenant.id == uuid.UUID(tenant_id))
    )
    tenant = result.scalar_one_or_none()
    if tenant is None:
        raise exc
    return tenant


# ── Helper ────────────────────────────────────────────────────────────────────
def _build_token_response(tenant: Tenant) -> TokenResponse:
    token = create_access_token(str(tenant.id))
    return TokenResponse(
        token=token,
        tenant_id=str(tenant.id),
        user=UserInfo(
            email=tenant.email,
            business_name=tenant.biz_name,
            slug=tenant.slug,
            is_verified=tenant.is_verified,
            ai_mode=tenant.ai_mode,
        ),
    )


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post(
    "/register",
    response_model=TokenResponse,
    status_code=status.HTTP_201_CREATED,
)
@limiter.limit("5/minute")
async def register(request: Request, payload: RegisterRequest, db: AsyncSession = Depends(get_db)):
    # Check email uniqueness
    existing = await db.execute(
        select(Tenant).where(Tenant.email == payload.email)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists",
        )

    # Generate unique slug
    base_slug = _make_slug(payload.business_name)
    slug = base_slug
    counter = 1
    while True:
        existing_slug = await db.execute(
            select(Tenant).where(Tenant.slug == slug)
        )
        if not existing_slug.scalar_one_or_none():
            break
        slug = f"{base_slug}-{counter}"
        counter += 1

    tenant = Tenant(
        biz_name=payload.business_name,
        email=payload.email,
        hashed_password=hash_password(payload.password),
        slug=slug,
    )
    db.add(tenant)
    await db.flush()

    wallet = Wallet(tenant_id=tenant.id, balance=100)
    db.add(wallet)
    await db.commit()
    await db.refresh(tenant)

    return _build_token_response(tenant)


@router.post("/login", response_model=TokenResponse)
@limiter.limit("5/minute")
async def login(request: Request, payload: LoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Tenant).where(Tenant.email == payload.email)
    )
    tenant = result.scalar_one_or_none()

    if not tenant or not verify_password(payload.password, tenant.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    return _build_token_response(tenant)


@router.get("/me", response_model=TokenResponse)
@limiter.limit("5/minute")
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
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect",
        )
    if payload.current_password == payload.new_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password must differ from the current password",
        )
    tenant.hashed_password = hash_password(payload.new_password)
    await db.commit()


from app.schemas import AiModeRequest

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





from pydantic import BaseModel, EmailStr, Field
from typing import Optional

# 1. Add the new schema for the profile update
class TenantProfileUpdate(BaseModel):
    biz_name: Optional[str] = Field(default=None, min_length=2, max_length=255)
    email: Optional[str] = Field(default=None)
    phone: Optional[str] = Field(default=None)

# 2. Add ONLY the profile patch endpoint. 
# (Your existing /change-password endpoint stays exactly as it is!)
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
    
    if payload.email:
        email = payload.email.strip().lower()
        existing = await db.execute(
            select(Tenant).where(
                Tenant.email == email,
                Tenant.id != tenant.id,
            )
        )
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=409, detail="Email already in use.")
        tenant.email = email
        
    if payload.phone is not None:
        tenant.phone = payload.phone.strip() or None
        
    await db.commit()
    return {
        "biz_name": tenant.biz_name,
        "email": tenant.email,
        "phone": tenant.phone,
    }
