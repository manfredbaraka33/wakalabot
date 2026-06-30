from pathlib import Path

from dotenv import load_dotenv
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # ── AI ─────────────────────────────────────────────────────────────────────
    GEMINI_API_KEY: str = ""

    # ── Database ───────────────────────────────────────────────────────────────
    DATABASE_URL: str

    # ── Auth / JWT ─────────────────────────────────────────────────────────────
    JWT_SECRET_KEY: str
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = 60 * 24 * 7   # 7 days

    # ── CORS ───────────────────────────────────────────────────────────────────
    # Comma-separated list of allowed origins, e.g. "http://localhost:5173,https://app.wakalabot.com"
    ALLOWED_ORIGINS: str = "http://localhost:5173"

    # ── SuperAdmin ─────────────────────────────────────────────────────────────
    SUPERADMIN_SECRET: str = "changeme-superadmin-secret"
    SUPERADMIN_JWT_EXPIRE_HOURS: int = 12

    # ── Cloudinary ─────────────────────────────────────────────────────────────
    CLOUDINARY_CLOUD_NAME: str = ""
    CLOUDINARY_API_KEY: str = ""
    CLOUDINARY_API_SECRET: str = ""

    #-----NextSMS
    NEXTSMS_USERNAME: str = ""
    NEXTSMS_PASSWORD: str = ""
    NEXTSMS_SENDER_ID: str = ""

    model_config = SettingsConfigDict(
        env_file=str(Path(__file__).resolve().parents[1] / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )


_env_path = Path(__file__).resolve().parents[1] / ".env"
load_dotenv(_env_path, override=True)

settings = Settings()
