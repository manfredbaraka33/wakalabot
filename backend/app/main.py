import logging
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

import app.models as _models  # noqa: F401 — registers models with Base.metadata
from app.admin import router as admin_router
from app.analytics import router as analytics_router
from app.api import router as chat_router
from app.auth import router as auth_router
from app.billing import router as billing_router
from app.core import settings
from app.db import engine
from app.knowledge import router as knowledge_router
from app.products import router as products_router
from app.support import router as support_router
from app.superadmin import router as superadmin_router
from app.notifications import router as notifications_router
from app.customer_auth import router as customer_auth_router
from app.instagram import router as instagram_router


import app.studio_models as _studio_models  # noqa: F401  registers Studio tables
from app.studio import router as studio_router
from app.studio_admin import router as studio_admin_router
from app.studio_worker import start_worker, stop_worker

from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from app.limiter import limiter


logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    async with engine.begin() as conn:
        await conn.execute(
            __import__("sqlalchemy").text("CREATE EXTENSION IF NOT EXISTS vector")
        )
    _origins = [o.strip() for o in settings.ALLOWED_ORIGINS.split(",") if o.strip()]
    logger.info("CORS allowed origins: %s", _origins)
    start_worker()
    yield
    await stop_worker()


app = FastAPI(
    title="WakalaBot API",
    description="Multi-tenant AI customer service hub",
    version="1.0.0",
    lifespan=lifespan,
)


app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)


_origins = [o.strip() for o in settings.ALLOWED_ORIGINS.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)



from app.sqladmin_setup import mount_admin  # noqa: E402
mount_admin(app)

from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import os


app.include_router(auth_router, prefix="/api/v1")
app.include_router(admin_router, prefix="/api/v1")
app.include_router(analytics_router, prefix="/api/v1")
app.include_router(chat_router, prefix="/api/v1")
app.include_router(knowledge_router, prefix="/api/v1")
app.include_router(products_router, prefix="/api/v1")
app.include_router(billing_router, prefix="/api/v1")
app.include_router(support_router, prefix="/api/v1")
app.include_router(superadmin_router, prefix="/api/v1")
app.include_router(notifications_router, prefix="/api/v1")
app.include_router(customer_auth_router, prefix="/api/v1")
app.include_router(instagram_router, prefix="/api/v1")
app.include_router(studio_router, prefix="/api/v1")
app.include_router(studio_admin_router, prefix="/api/v1")


@app.get("/", response_model=dict)
async def root():
    return {"message": "Wakalabot API is running!"}

@app.get("/health")
async def health_check():
    return {"status": "ok"}

