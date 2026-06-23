from datetime import datetime, timezone
from typing import Optional

from fastapi import Cookie, Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError
from sqlalchemy.orm import Session

from app.database import get_db
from app.core.security import decode_token
from app.models.user import User

bearer = HTTPBearer(auto_error=False)


def _get_token(
    credentials: Optional[HTTPAuthorizationCredentials],
    access_token_cookie: Optional[str],
) -> Optional[str]:
    """
    Token priority:
    1. Authorization: Bearer header (explicit, for API clients)
    2. access_token httpOnly cookie (browser-based sessions)
    """
    if credentials and credentials.credentials:
        return credentials.credentials
    return access_token_cookie


def get_current_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer),
    access_token: Optional[str] = Cookie(None),
    db: Session = Depends(get_db),
) -> User:
    exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired token",
        headers={"WWW-Authenticate": "Bearer"},
    )

    token = _get_token(credentials, access_token)
    if not token:
        raise exc

    try:
        payload = decode_token(token)
        user_id: str = payload.get("sub")
        if not user_id or payload.get("type") != "access":
            raise exc
    except Exception:
        raise exc

    user = db.query(User).filter(User.id == user_id, User.is_active == True).first()
    if not user:
        raise exc

    if user.locked_until and datetime.now(timezone.utc) < user.locked_until:
        raise HTTPException(
            status_code=status.HTTP_423_LOCKED,
            detail="Account temporarily locked due to failed login attempts",
        )

    # Issue #8: set RLS session vars so PostgreSQL RLS policies can enforce row-level isolation
    from app.database import set_rls_context
    from app.models.user import UserRole
    set_rls_context(db, user.clinic_id, user.role == UserRole.SUPER_ADMIN, user.id)

    return user


def get_optional_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer),
    access_token: Optional[str] = Cookie(None),
    db: Session = Depends(get_db),
) -> Optional[User]:
    token = _get_token(credentials, access_token)
    if not token:
        return None
    try:
        payload = decode_token(token)
        user_id: str = payload.get("sub")
        if not user_id or payload.get("type") != "access":
            return None
        return db.query(User).filter(User.id == user_id, User.is_active == True).first()
    except Exception:
        return None


def require_role(*roles: str):
    def checker(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Role '{current_user.role}' is not authorised for this action",
            )
        return current_user
    return checker


def require_permission(permission_name: str):
    def checker(
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db),
    ) -> User:
        from app.services.permissions import has_permission
        from app.core.audit import log_event

        if not has_permission(db, current_user, permission_name):
            log_event(
                db,
                action=permission_name,
                resource_type=permission_name.split(":")[0],
                status="blocked",
                user=current_user,
                failure_reason="insufficient_permissions",
                risk_score=30,
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Permission '{permission_name}' required",
            )
        return current_user

    return checker
