"""
Shared test configuration.

Sets required environment variables before any app module is imported so
pydantic-settings doesn't raise on missing DATABASE_URL / SECRET_KEY.
"""
import os

os.environ.setdefault("SECRET_KEY", "test-secret-key-32-chars-minimum-xx")
os.environ.setdefault("DATABASE_URL", "sqlite:///./test_medassist.db")
os.environ.setdefault("REDIS_URL", "redis://localhost:6379/0")
