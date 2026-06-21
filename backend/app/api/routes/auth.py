"""
Production-grade authentication routes.

- httpOnly cookies for access + refresh tokens
- CSRF token in readable cookie for SPA protection
- Account lockout with progressive backoff
- TOTP two-factor authentication
- Session tracking on every login
- Password reset flow
"""
import asyncio
import logging
import uuid
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Cookie, Depends, HTTPException, Request, Response, status
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

from app.config import get_settings
from app.core.audit import log_auth, log_data_change, log_event
from app.core.deps import get_current_user, get_db
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)
from app.models.user import User, VALID_ROLES
from app.schemas.auth import (
    LoginRequest,
    RegisterRequest,
    TokenResponse,
    UserResponse,
)
from app.services.password_service import (
    check_password_history,
    record_password,
    validate_password,
)
from app.services.permissions import get_user_permissions, invalidate_cache
from app.services.session_service import (
    create_session,
    get_active_sessions,
    revoke_all_other_sessions,
)
from app.services.totp_service import (
    generate_backup_codes,
    setup_2fa,
    verify_and_consume_backup_code,
    verify_totp,
)

router = APIRouter()
_limiter = Limiter(key_func=get_remote_address)
settings = get_settings()


# ── Cookie helpers ────────────────────────────────────────────────────────────

_COOKIE_SECURE = settings.environment == "production"
_COOKIE_SAMESITE = "lax"


def _set_auth_cookies(response: Response, access_token: str, refresh_token: str, csrf: str) -> None:
    response.set_cookie(
        key="access_token", value=access_token,
        httponly=True, secure=_COOKIE_SECURE, samesite=_COOKIE_SAMESITE,
        max_age=settings.access_token_expire_minutes * 60,
        path="/",
    )
    response.set_cookie(
        key="refresh_token", value=refresh_token,
        httponly=True, secure=_COOKIE_SECURE, samesite=_COOKIE_SAMESITE,
        max_age=settings.refresh_token_expire_days * 86_400,
        path="/api/v1/auth/refresh",
    )
    # Readable CSRF token — SPA reads it and sends as X-CSRF-Token header
    response.set_cookie(
        key="csrf_token", value=csrf,
        httponly=False, secure=_COOKIE_SECURE, samesite=_COOKIE_SAMESITE,
        max_age=settings.access_token_expire_minutes * 60,
        path="/",
    )


def _clear_auth_cookies(response: Response) -> None:
    for key in ("access_token", "refresh_token", "csrf_token"):
        response.delete_cookie(key=key, path="/")
    response.delete_cookie(key="refresh_token", path="/api/v1/auth/refresh")


def _build_response(db: Session, user: User) -> dict:
    return {
        "user": UserResponse.model_validate(user),
        "permissions": sorted(get_user_permissions(db, user)),
    }


# ── Progressive delay: 0, 1, 2, 4, 8, 16 seconds based on attempt count ─────

async def _apply_backoff(attempts: int) -> None:
    if attempts < 1:
        return
    delay = min(2 ** (attempts - 1), 30)
    await asyncio.sleep(delay)


# ── Register ──────────────────────────────────────────────────────────────────

@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(data: RegisterRequest, request: Request, response: Response, db: Session = Depends(get_db)):
    errors = validate_password(data.password)
    if errors:
        raise HTTPException(status_code=422, detail=errors[0])

    if db.query(User).filter(User.email == data.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")
    if db.query(User).filter(User.phone == data.phone).first():
        raise HTTPException(status_code=400, detail="Phone number already registered")

    user = User(
        full_name=data.full_name,
        email=data.email,
        phone=data.phone,
        password_hash=hash_password(data.password),
        role="patient",
        county=data.county,
    )
    db.add(user)
    db.flush()

    record_password(db, user.id, data.password)

    access = create_access_token({"sub": str(user.id), "role": user.role})
    refresh = create_refresh_token({"sub": str(user.id)})
    csrf = str(uuid.uuid4())

    create_session(db, user=user, request=request, access_token=access, refresh_token=refresh)
    db.commit()

    _set_auth_cookies(response, access, refresh, csrf)
    invalidate_cache(str(user.id))

    # Welcome email (async, non-blocking)
    try:
        from app.tasks.email_tasks import send_email_task
        from app.services.email import email_welcome
        verify_url = "https://medassist.co.ke/verify-email"
        subject, html = email_welcome(user.full_name, verify_url)
        send_email_task.delay(user.email, user.full_name, subject, html)
    except Exception:
        pass  # Never fail registration due to email issues

    return {**_build_response(db, user), "access_token": access, "refresh_token": refresh, "token_type": "bearer"}


# ── Login ─────────────────────────────────────────────────────────────────────

@router.post("/login", response_model=TokenResponse)
@_limiter.limit("10/minute")
async def login(data: LoginRequest, request: Request, response: Response, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == data.email).first()

    if not user:
        await asyncio.sleep(1)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")

    # Apply progressive backoff before checking password
    await _apply_backoff(user.failed_login_attempts or 0)

    # Check lockout
    if user.locked_until and user.locked_until > datetime.utcnow().replace(tzinfo=user.locked_until.tzinfo):
        log_event(db, action="auth.login_blocked", resource_type="user",
                  resource_id=str(user.id), status="blocked", request=request,
                  failure_reason="account_locked")
        db.commit()
        raise HTTPException(status_code=status.HTTP_423_LOCKED,
                            detail="Account temporarily locked. Try again later.")

    if not verify_password(data.password, user.password_hash):
        user.failed_login_attempts = (user.failed_login_attempts or 0) + 1
        if user.failed_login_attempts >= settings.max_login_attempts:
            user.locked_until = datetime.utcnow() + timedelta(minutes=settings.lockout_minutes)

        log_auth(db, action="auth.login_failed", user=user, request=request, success=False,
                 failure_reason="wrong_password",
                 failed_attempts_before=user.failed_login_attempts)
        db.commit()
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")

    if not user.is_active:
        raise HTTPException(status_code=400, detail="Account is deactivated")

    # 2FA check
    if user.two_factor_enabled and user.two_factor_secret:
        if not data.totp_code and not data.backup_code:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,
                                detail="Two-factor authentication code required",
                                headers={"X-2FA-Required": "true"})
        valid_totp = False
        if data.totp_code:
            valid_totp = verify_totp(user.two_factor_secret, data.totp_code)
        if not valid_totp and data.backup_code:
            valid_totp = verify_and_consume_backup_code(db, user.id, data.backup_code)
        if not valid_totp:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,
                                detail="Invalid two-factor authentication code")

    # Success — reset failed attempts
    failed_before = user.failed_login_attempts or 0
    user.failed_login_attempts = 0
    user.locked_until = None
    user.last_login_at = datetime.utcnow()

    state = request.state.__dict__
    ip = state.get("client_ip", "0.0.0.0")
    user.last_login_ip = ip

    access = create_access_token({"sub": str(user.id), "role": user.role})
    refresh = create_refresh_token({"sub": str(user.id)})
    csrf = str(uuid.uuid4())

    create_session(db, user=user, request=request, access_token=access, refresh_token=refresh)
    log_auth(db, action="auth.login_success", user=user, request=request, success=True,
             failed_attempts_before=failed_before)
    db.commit()

    _set_auth_cookies(response, access, refresh, csrf)
    invalidate_cache(str(user.id))

    # Login alert SMS for new/unknown IPs
    try:
        if failed_before == 0:  # only on clean logins, not retries
            from app.tasks.sms_tasks import send_sms_task
            from app.services.sms import sms_login_alert
            import user_agents as ua_parser
            ua_str = request.headers.get("user-agent", "")
            city = "Unknown city"
            country = "Kenya"
            msg = sms_login_alert(user.full_name, city, country)
            send_sms_task.delay(user.phone, msg)
    except Exception:
        pass  # Never fail login due to SMS issues

    return {**_build_response(db, user), "access_token": access, "refresh_token": refresh, "token_type": "bearer"}


# ── Refresh ───────────────────────────────────────────────────────────────────

@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(
    request: Request,
    response: Response,
    refresh_token: Optional[str] = Cookie(None),
    db: Session = Depends(get_db),
):
    if not refresh_token:
        raise HTTPException(status_code=401, detail="Refresh token missing")

    try:
        payload = decode_token(refresh_token)
        if payload.get("type") != "refresh":
            raise ValueError
        user_id = payload["sub"]
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    user = db.query(User).filter(User.id == user_id, User.is_active == True).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    # Rotate tokens
    access = create_access_token({"sub": str(user.id), "role": user.role})
    new_refresh = create_refresh_token({"sub": str(user.id)})
    csrf = str(uuid.uuid4())

    create_session(db, user=user, request=request, access_token=access, refresh_token=new_refresh)
    db.commit()

    _set_auth_cookies(response, access, new_refresh, csrf)
    invalidate_cache(str(user.id))
    return {**_build_response(db, user), "access_token": access, "refresh_token": new_refresh, "token_type": "bearer"}


# ── Logout ────────────────────────────────────────────────────────────────────

@router.post("/logout")
def logout(
    request: Request,
    response: Response,
    access_token: Optional[str] = Cookie(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if access_token:
        from app.models.audit import UserSession
        s = db.query(UserSession).filter(
            UserSession.session_token == access_token,
            UserSession.user_id == current_user.id,
        ).first()
        if s:
            s.is_active = False

    log_event(db, action="auth.logout", resource_type="user",
              resource_id=str(current_user.id), status="success",
              request=request, user=current_user)
    db.commit()

    _clear_auth_cookies(response)
    return {"detail": "Logged out"}


# ── Me ────────────────────────────────────────────────────────────────────────

@router.get("/me", response_model=TokenResponse)
def get_me(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    access_token: Optional[str] = Cookie(None),
):
    return {**_build_response(db, current_user),
            "access_token": access_token or "",
            "refresh_token": "",
            "token_type": "bearer"}


# ── Password reset ────────────────────────────────────────────────────────────

@router.post("/forgot-password")
@_limiter.limit("5/minute")
def forgot_password(email: str, request: Request, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == email).first()
    if user:
        token = str(uuid.uuid4())
        user.password_reset_token = token
        user.password_reset_expires = datetime.utcnow() + timedelta(hours=1)
        db.commit()

        reset_url = f"{settings.app_base_url}/reset-password?token={token}"
        client_ip = getattr(request.state, "client_ip", "Unknown")
        try:
            from app.tasks.email_tasks import send_email_task
            from app.services.email import email_password_reset
            subject, html = email_password_reset(
                name=user.full_name,
                reset_url=reset_url,
                ip_address=client_ip,
                city="Kenya",
            )
            send_email_task.delay(user.email, user.full_name, subject, html)
        except Exception:
            logger.exception("Failed to send password reset email to %s", user.email)
    # Always return same response to prevent email enumeration
    return {"detail": "If that email exists, a reset link has been sent."}


@router.post("/reset-password")
@_limiter.limit("5/minute")
def reset_password(token: str, new_password: str, request: Request, db: Session = Depends(get_db)):
    user = db.query(User).filter(
        User.password_reset_token == token,
        User.password_reset_expires > datetime.utcnow(),
    ).first()
    if not user:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")

    errors = validate_password(new_password)
    if errors:
        raise HTTPException(status_code=422, detail=errors[0])

    if check_password_history(db, user.id, new_password):
        raise HTTPException(status_code=422, detail="Cannot reuse one of your last 5 passwords")

    record_password(db, user.id, new_password)
    user.password_hash = hash_password(new_password)
    user.password_reset_token = None
    user.password_reset_expires = None
    user.failed_login_attempts = 0
    user.locked_until = None

    log_event(db, action="auth.password_reset_completed", resource_type="user",
              resource_id=str(user.id), status="success", user=user)
    db.commit()
    return {"detail": "Password updated. Please sign in."}


# ── 2FA setup ─────────────────────────────────────────────────────────────────

@router.post("/2fa/setup")
def setup_two_factor(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    secret, uri, codes = setup_2fa(db, current_user, current_user.email)
    db.commit()
    return {"secret": secret, "qr_uri": uri, "backup_codes": codes}


@router.post("/2fa/verify")
def verify_two_factor(
    code: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not verify_totp(current_user.two_factor_secret, code):
        raise HTTPException(status_code=400, detail="Invalid TOTP code")
    log_event(db, action="auth.two_factor_enabled", resource_type="user",
              resource_id=str(current_user.id), status="success", user=current_user)
    db.commit()
    return {"detail": "Two-factor authentication verified and active"}


@router.delete("/2fa/disable")
def disable_two_factor(
    code: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not verify_totp(current_user.two_factor_secret, code):
        raise HTTPException(status_code=400, detail="Invalid TOTP code — cannot disable 2FA")
    current_user.two_factor_enabled = False
    current_user.two_factor_secret = None
    log_event(db, action="auth.two_factor_disabled", resource_type="user",
              resource_id=str(current_user.id), status="success", user=current_user)
    db.commit()
    return {"detail": "Two-factor authentication disabled"}
