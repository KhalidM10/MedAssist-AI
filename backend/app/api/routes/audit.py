"""
Audit log API endpoints.

clinic_admin → sees only their clinic's logs
super_admin  → sees all logs, can filter by clinic_id
"""
import csv
import io
import uuid
from datetime import datetime, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy import desc, func
from sqlalchemy.orm import Session

from app.core.deps import get_db, require_permission
from app.models.audit import AuditLog
from app.models.user import User
from app.schemas.audit import AuditLogOut, AuditLogPage, AuditStats
from app.services.audit_service import HIGH_RISK_THRESHOLD

router = APIRouter()


def _base_query(db: Session, current_user: User):
    q = db.query(AuditLog)
    if current_user.role != "super_admin":
        q = q.filter(AuditLog.clinic_id == current_user.clinic_id)
    return q


def _apply_filters(
    q,
    *,
    action: Optional[str],
    status: Optional[str],
    user_email: Optional[str],
    resource_type: Optional[str],
    ip_address: Optional[str],
    date_from: Optional[datetime],
    date_to: Optional[datetime],
    risk_min: Optional[int],
    clinic_id: Optional[uuid.UUID],
    current_user: User,
):
    if action:
        q = q.filter(AuditLog.action.ilike(f"%{action}%"))
    if status:
        q = q.filter(AuditLog.status == status)
    if user_email:
        q = q.filter(AuditLog.user_email.ilike(f"%{user_email}%"))
    if resource_type:
        q = q.filter(AuditLog.resource_type == resource_type)
    if ip_address:
        q = q.filter(AuditLog.ip_address.op("::text").like(f"%{ip_address}%"))
    if date_from:
        q = q.filter(AuditLog.created_at >= date_from)
    if date_to:
        q = q.filter(AuditLog.created_at <= date_to)
    if risk_min is not None:
        q = q.filter(AuditLog.risk_score >= risk_min)
    if clinic_id and current_user.role == "super_admin":
        q = q.filter(AuditLog.clinic_id == clinic_id)
    return q


@router.get("", response_model=AuditLogPage)
def list_audit_logs(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    action: Optional[str] = Query(None),
    status: Optional[str] = Query(None, pattern="^(success|failure|blocked)$"),
    user_email: Optional[str] = Query(None),
    resource_type: Optional[str] = Query(None),
    ip_address: Optional[str] = Query(None),
    date_from: Optional[datetime] = Query(None),
    date_to: Optional[datetime] = Query(None),
    risk_min: Optional[int] = Query(None, ge=0, le=100),
    clinic_id: Optional[uuid.UUID] = Query(None, description="super_admin only"),
    current_user: User = Depends(require_permission("audit:read:own_clinic")),
    db: Session = Depends(get_db),
):
    q = _base_query(db, current_user)
    q = _apply_filters(
        q, action=action, status=status, user_email=user_email,
        resource_type=resource_type, ip_address=ip_address,
        date_from=date_from, date_to=date_to,
        risk_min=risk_min, clinic_id=clinic_id, current_user=current_user,
    )

    total = q.count()
    items = (
        q.order_by(desc(AuditLog.created_at))
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return AuditLogPage(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        pages=max(1, (total + page_size - 1) // page_size),
    )


@router.get("/stats", response_model=AuditStats)
def audit_stats(
    hours: int = Query(24, ge=1, le=720),
    current_user: User = Depends(require_permission("audit:read:own_clinic")),
    db: Session = Depends(get_db),
):
    since = datetime.utcnow() - timedelta(hours=hours)
    q = _base_query(db, current_user).filter(AuditLog.created_at >= since)

    total = q.count()
    success = q.filter(AuditLog.status == "success").count()
    failure = q.filter(AuditLog.status == "failure").count()
    blocked = q.filter(AuditLog.status == "blocked").count()
    high_risk = q.filter(AuditLog.risk_score >= HIGH_RISK_THRESHOLD).count()

    top_actions_q = (
        _base_query(db, current_user)
        .filter(AuditLog.created_at >= since)
        .with_entities(AuditLog.action, func.count(AuditLog.id).label("cnt"))
        .group_by(AuditLog.action)
        .order_by(desc("cnt"))
        .limit(10)
        .all()
    )
    top_users_q = (
        _base_query(db, current_user)
        .filter(AuditLog.created_at >= since, AuditLog.user_email.isnot(None))
        .with_entities(AuditLog.user_email, func.count(AuditLog.id).label("cnt"))
        .group_by(AuditLog.user_email)
        .order_by(desc("cnt"))
        .limit(10)
        .all()
    )

    return AuditStats(
        total=total,
        success=success,
        failure=failure,
        blocked=blocked,
        high_risk=high_risk,
        top_actions=[{"action": r[0], "count": r[1]} for r in top_actions_q],
        top_users=[{"email": r[0], "count": r[1]} for r in top_users_q],
    )


@router.get("/high-risk", response_model=AuditLogPage)
def high_risk_events(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    hours: int = Query(24, ge=1, le=168),
    current_user: User = Depends(require_permission("audit:read:all")),
    db: Session = Depends(get_db),
):
    since = datetime.utcnow() - timedelta(hours=hours)
    q = (
        db.query(AuditLog)
        .filter(
            AuditLog.risk_score >= HIGH_RISK_THRESHOLD,
            AuditLog.created_at >= since,
        )
        .order_by(desc(AuditLog.risk_score), desc(AuditLog.created_at))
    )
    total = q.count()
    items = q.offset((page - 1) * page_size).limit(page_size).all()
    return AuditLogPage(
        items=items, total=total, page=page, page_size=page_size,
        pages=max(1, (total + page_size - 1) // page_size),
    )


@router.get("/export/csv")
def export_csv(
    action: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    user_email: Optional[str] = Query(None),
    date_from: Optional[datetime] = Query(None),
    date_to: Optional[datetime] = Query(None),
    risk_min: Optional[int] = Query(None, ge=0, le=100),
    current_user: User = Depends(require_permission("audit:read:own_clinic")),
    db: Session = Depends(get_db),
):
    from app.services.audit_service import log_data_access
    q = _base_query(db, current_user)
    q = _apply_filters(
        q, action=action, status=status, user_email=user_email,
        resource_type=None, ip_address=None,
        date_from=date_from, date_to=date_to,
        risk_min=risk_min, clinic_id=None, current_user=current_user,
    )
    rows = q.order_by(desc(AuditLog.created_at)).limit(10_000).all()

    log_data_access(
        db,
        action="audit.exported",
        resource_type="audit_logs",
        user=current_user,
        record_count=len(rows),
    )
    db.commit()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "event_id", "timestamp", "user_email", "user_role", "clinic_name",
        "action", "resource_type", "resource_id",
        "ip_address", "country", "city", "device_type", "browser",
        "http_method", "api_endpoint", "duration_ms",
        "status", "failure_reason", "risk_score", "flags",
    ])
    for r in rows:
        writer.writerow([
            r.event_id, r.created_at.isoformat(),
            r.user_email or "", r.user_role or "", r.clinic_name or "",
            r.action, r.resource_type, r.resource_id or "",
            r.ip_address, r.country or "", r.city or "",
            r.device_type or "", r.browser or "",
            r.http_method or "", r.api_endpoint or "", r.duration_ms or "",
            r.status, r.failure_reason or "",
            r.risk_score, "|".join(r.flags or []),
        ])

    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=audit-logs.csv"},
    )


@router.get("/{event_id}", response_model=AuditLogOut)
def get_audit_event(
    event_id: uuid.UUID,
    current_user: User = Depends(require_permission("audit:read:own_clinic")),
    db: Session = Depends(get_db),
):
    q = _base_query(db, current_user)
    entry = q.filter(AuditLog.event_id == event_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Audit event not found")
    return entry
