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

    #-----NextSMS------------
    NEXTSMS_USERNAME: str = ""
    NEXTSMS_PASSWORD: str = ""
    NEXTSMS_SENDER_ID: str = ""
    NEXTSMS_DRY_RUN: bool = False


    META_APP_ID: str = ""
    META_APP_SECRET: str = ""
    META_VERIFY_TOKEN: str = ""        
    APP_URL: str = "https://wakalabot.co.tz"

    STUDIO_TEXT_MODEL: str = "gemini-3.1-flash-lite"
    STUDIO_IMAGE_MODEL: str = ""            # copy the exact ID from AI Studio's model list
    STUDIO_IMAGE_COST_USD: float = 0.034
    STUDIO_SIGNUP_BONUS: int = 15              # one-time credits at signup
    STUDIO_FREE_DAILY_WATERMARKED: int = 5    # daily free watermarked posters: OFF (set 3 to bring it back)
    STUDIO_FREE_PRICELIST_DAILY: int = 5      # safety cap on free price lists per account per day
    STUDIO_PRICELIST_WATERMARK: bool = True    # False = price lists free and clean, like before
    STUDIO_PAY_NUMBER: str = ""
    STUDIO_PAY_NAME: str = ""
    STUDIO_ADMIN_PHONE: str = ""            # gets an SMS when someone submits a payment
    STUDIO_CONCURRENCY: int = 2
    STUDIO_RETENTION_DAYS: int = 30


    model_config = SettingsConfigDict(
        env_file=str(Path(__file__).resolve().parents[1] / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )


_env_path = Path(__file__).resolve().parents[1] / ".env"
load_dotenv(_env_path, override=True)

settings = Settings()
