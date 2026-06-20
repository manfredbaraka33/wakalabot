"""Alembic environment — async SQLAlchemy (asyncpg) edition.

Works with the project's async engine.  Credentials come from
app.core.settings so they never live inside alembic.ini.
"""
import asyncio
import re
import sys
import os
from logging.config import fileConfig

from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import async_engine_from_config

from alembic import context

# ── make sure backend/ is on the import path ──────────────────────────────────
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

# Import settings (reads backend/.env via pydantic-settings)
from app.core import settings  # noqa: E402

# Import Base + all model classes so their metadata is populated
from app.db import Base  # noqa: E402
import app.models  # noqa: E402, F401 — side-effect: registers all models

# ── Alembic Config object ──────────────────────────────────────────────────────
config = context.config

# Wire up Python logging from alembic.ini
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# The metadata Alembic uses to autogenerate migrations
target_metadata = Base.metadata


# ── URL helpers ────────────────────────────────────────────────────────────────

def _sync_url(url: str) -> str:
    """Convert asyncpg URL to a sync psycopg2 URL for offline mode."""
    return re.sub(r"^postgresql\+asyncpg", "postgresql", url)


def _get_url() -> str:
    return settings.DATABASE_URL


# ── Offline migrations (generates SQL script, no live connection) ─────────────

def run_migrations_offline() -> None:
    context.configure(
        url=_sync_url(_get_url()),
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
    )
    with context.begin_transaction():
        context.run_migrations()


# ── Online migrations (runs against the live DB) ──────────────────────────────

def do_run_migrations(connection: Connection) -> None:
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        compare_type=True,
    )
    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    cfg = config.get_section(config.config_ini_section, {})
    cfg["sqlalchemy.url"] = _get_url()

    connectable = async_engine_from_config(
        cfg,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)

    await connectable.dispose()


def run_migrations_online() -> None:
    asyncio.run(run_async_migrations())


# ── Entry point ────────────────────────────────────────────────────────────────

if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
