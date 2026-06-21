"""Session management routes."""
import uuid
from typing import Optional

from fastapi import APIRouter, Cookie, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.core.audit import log_event
from app.core.deps import get_current_user, get_db
from app.models.user import User
from app.services.session_service import (
    get_active_sessions,
    revoke_all_other_sessions,
    revoke_session,
)

router = APIRouter()


@router.get("/")
def list_sessions(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    sessions = get_active_sessions(db, current_user.id)
    return [
        {
            "id": str(s.id),
            "device_type": s.device_type,
            "browser": s.browser,
            "os": s.os,
            "ip_address": str(s.ip_address) if s.ip_address else None,
            "city": s.city,
            "country": s.country,
            "created_at": s.created_at.isoformat() if s.created_at else None,
            "last_active_at": s.last_active_at.isoformat() if s.last_active_at else None,
            "expires_at": s.expires_at.isoformat() if s.expires_at else None,
            "is_active": s.is_active,
        }
        for s in sessions
    ]


@router.delete("/others")
def revoke_others(
    request: Request,
    access_token: Optional[str] = Cookie(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    count = revoke_all_other_sessions(db, current_user, access_token or "")
    log_event(
        db, action="auth.sessions_revoked_others", resource_type="session",
        resource_id=str(current_user.id), status="success",
        request=request, user=current_user,
        new_values={"sessions_revoked": count},
    )
    db.commit()
    return {"detail": f"{count} other session(s) revoked", "count": count}


@router.delete("/{session_id}")
def revoke_one(
    session_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    success = revoke_session(db, session_id, current_user)
    if not success:
        raise HTTPException(status_code=404, detail="Session not found or not authorized")
    db.commit()
    return {"detail": "Session revoked"}
