from contextlib import contextmanager
from typing import Generator, Optional
import uuid

from sqlalchemy import create_engine, event, text
from sqlalchemy.orm import sessionmaker, DeclarativeBase, Session

from app.config import get_settings

settings = get_settings()

engine = create_engine(
    settings.database_url,
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20,
    pool_recycle=3600,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db() -> Generator[Session, None, None]:
    """Plain session — no RLS context. Use for internal/seed operations."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def set_rls_context(
    db: Session,
    clinic_id: Optional[uuid.UUID],
    is_super_admin: bool,
    user_id: Optional[uuid.UUID] = None,
) -> None:
    """
    Set PostgreSQL session-level variables for Row Level Security.
    Called once per request after authentication.
    """
    db.execute(
        text("SELECT set_config('app.is_super_admin', :val, false)"),
        {"val": "true" if is_super_admin else "false"},
    )
    db.execute(
        text("SELECT set_config('app.current_clinic_id', :val, false)"),
        {"val": str(clinic_id) if clinic_id else ""},
    )
    db.execute(
        text("SELECT set_config('app.current_user_id', :val, false)"),
        {"val": str(user_id) if user_id else ""},
    )


@contextmanager
def rls_session(
    clinic_id: Optional[uuid.UUID],
    is_super_admin: bool,
) -> Generator[Session, None, None]:
    """Context manager that yields a session with RLS vars pre-set."""
    db = SessionLocal()
    try:
        set_rls_context(db, clinic_id, is_super_admin)
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
