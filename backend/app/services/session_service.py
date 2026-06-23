"""
Session management service.

Creates, retrieves, and revokes user sessions.
Sessions are tied to device fingerprints for anomaly detection.
"""
import hashlib
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import Request
from sqlalchemy.orm import Session as DBSession

from app.models.audit import UserSession
from app.models.user import User, UserRole
from app.services.geo import get_geo_sync, parse_user_agent


def _fingerprint(ua: str, ip: str) -> str:
    """Stable device fingerprint from UA + IP."""
    return hashlib.sha256(f"{ua}|{ip}".encode()).hexdigest()[:32]


def _hash_token(token: str) -> str:
    """SHA-256 hash so plaintext tokens are never stored in the DB."""
    return hashlib.sha256(token.encode()).hexdigest()


def create_session(
    db: DBSession,
    *,
    user: User,
    request: Request,
    access_token: str,
    refresh_token: str,
    expires_days: int = 7,
) -> UserSession:
    state = request.state.__dict__
    ip = state.get("client_ip", "0.0.0.0")
    ua_str = request.headers.get("User-Agent", "")
    device_type, browser, os_name = parse_user_agent(ua_str)
    geo = get_geo_sync(ip)

    session = UserSession(
        user_id=user.id,
        session_token=_hash_token(access_token),
        refresh_token=_hash_token(refresh_token),
        ip_address=ip,
        user_agent=ua_str,
        device_fingerprint=_fingerprint(ua_str, ip),
        device_type=device_type,
        browser=browser,
        os=os_name,
        country=geo.country,
        city=geo.city,
        is_active=True,
        last_active_at=datetime.now(timezone.utc),
        expires_at=datetime.now(timezone.utc) + timedelta(days=expires_days),
    )
    db.add(session)
    db.flush()
    return session


def get_active_sessions(db: DBSession, user_id) -> list[UserSession]:
    return (
        db.query(UserSession)
        .filter(
            UserSession.user_id == user_id,
            UserSession.is_active == True,
            UserSession.expires_at > datetime.now(timezone.utc),
        )
        .order_by(UserSession.last_active_at.desc())
        .all()
    )


def revoke_session(db: DBSession, session_id: uuid.UUID, requesting_user: User) -> bool:
    """
    Revoke a session. Users can revoke their own; super_admin can revoke any.
    Returns True if revoked.
    """
    s = db.query(UserSession).filter(UserSession.id == session_id).first()
    if not s:
        return False
    if s.user_id != requesting_user.id and requesting_user.role != UserRole.SUPER_ADMIN:
        return False
    s.is_active = False
    db.commit()
    return True


def revoke_all_other_sessions(db: DBSession, user: User, current_token: str) -> int:
    """Revoke all sessions except the one matching current_token. Returns count."""
    token_hash = _hash_token(current_token)
    sessions = (
        db.query(UserSession)
        .filter(
            UserSession.user_id == user.id,
            UserSession.is_active == True,
            UserSession.session_token != token_hash,
        )
        .all()
    )
    for s in sessions:
        s.is_active = False
    db.commit()
    return len(sessions)


def touch_session(db: DBSession, access_token: str) -> None:
    """Update last_active_at for the current session."""
    token_hash = _hash_token(access_token)
    s = db.query(UserSession).filter(
        UserSession.session_token == token_hash,
        UserSession.is_active == True,
    ).first()
    if s:
        s.last_active_at = datetime.now(timezone.utc)
