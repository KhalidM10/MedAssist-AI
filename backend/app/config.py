from functools import lru_cache
from typing import List, Optional
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "MedAssist AI"
    debug: bool = False
    environment: str = "production"
    api_version: str = "v1"

    # ── Database ───────────────────────────────────────────────────────────────
    database_url: str

    # ── JWT ────────────────────────────────────────────────────────────────────
    secret_key: str
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60
    refresh_token_expire_days: int = 7

    # ── CORS ───────────────────────────────────────────────────────────────────
    allowed_origins: List[str] = ["http://localhost:5173", "http://localhost:5174", "http://localhost:5175", "http://localhost:3000"]

    # ── Redis ──────────────────────────────────────────────────────────────────
    redis_url: str = "redis://localhost:6379/0"
    celery_broker_url: str = "redis://localhost:6379/1"
    celery_result_backend: str = "redis://localhost:6379/2"

    # ── AWS S3 / MinIO ─────────────────────────────────────────────────────────
    aws_access_key_id: str = ""
    aws_secret_access_key: str = ""
    aws_region: str = "af-south-1"
    s3_bucket_name: str = "medassist-uploads"
    s3_endpoint_url: Optional[str] = None  # Set for MinIO local dev

    # ── SendGrid ───────────────────────────────────────────────────────────────
    sendgrid_api_key: str = ""
    email_from: str = "noreply@medassist.co.ke"
    email_from_name: str = "MedAssist AI"

    # ── Africa's Talking ───────────────────────────────────────────────────────
    africastalking_api_key: str = ""
    africastalking_username: str = "sandbox"
    africastalking_sender_id: str = "MedAssist"

    # ── M-Pesa Daraja ──────────────────────────────────────────────────────────
    mpesa_consumer_key: str = ""
    mpesa_consumer_secret: str = ""
    mpesa_passkey: str = ""
    mpesa_shortcode: str = ""
    mpesa_environment: str = "sandbox"
    mpesa_callback_url: str = ""

    # ── App ────────────────────────────────────────────────────────────────────
    app_base_url: str = "https://medassist.co.ke"
    delivery_fee_kes: int = 200

    # ── Sentry ─────────────────────────────────────────────────────────────────
    sentry_dsn: str = ""

    # ── Security ───────────────────────────────────────────────────────────────
    max_login_attempts: int = 5
    lockout_minutes: int = 30
    password_min_length: int = 8

    model_config = {"env_file": ".env", "extra": "ignore"}


@lru_cache()
def get_settings() -> Settings:
    return Settings()
