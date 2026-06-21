import re
import uuid
from datetime import date, datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.deps import get_db, require_role
from app.models.appointment import Appointment, AppointmentStatus
from app.models.audit import UserSession
from app.models.clinic import Clinic
from app.models.doctor import Doctor
from app.models.order import Order
from app.models.triage import SymptomLog, TriageSession
from app.models.user import User, UserRole

router = APIRouter()

MRR_BY_PLAN = {"basic": 3_500, "pro": 8_500, "enterprise": 18_000}
VALID_ROLES = (
    "super_admin", "clinic_admin", "clinic_doctor",
    "clinic_receptionist", "clinic_pharmacist", "patient",
)


class RoleBody(BaseModel):
    role: str


class SuspendBody(BaseModel):
    reason: str = "Admin action"
    days: Optional[int] = None


class ApproveBody(BaseModel):
    notes: Optional[str] = None


class RejectBody(BaseModel):
    reason: str


class WarnBody(BaseModel):
    reason: str


class BanBody(BaseModel):
    reason: str


class AddClinicBody(BaseModel):
    name: str
    county: str
    address: str = ""
    phone: str
    email: Optional[str] = None
    owner_email: str
    license_number: Optional[str] = None
    subscription_plan: str = "basic"


class ChangeReqReviewBody(BaseModel):
    notes: Optional[str] = None


def _slug(name: str) -> str:
    base = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    return f"{base}-{uuid.uuid4().hex[:6]}"


# ── Platform stats ─────────────────────────────────────────────────────────────

@router.get("/stats")
def platform_stats(
    current_user: User = Depends(require_role(UserRole.SUPER_ADMIN)),
    db: Session = Depends(get_db),
):
    today = date.today()
    week_start = today - timedelta(days=today.weekday())

    total_users      = db.query(func.count(User.id)).scalar() or 0
    total_clinics    = db.query(func.count(Clinic.id)).scalar() or 0
    verified_clinics = db.query(func.count(Clinic.id)).filter(
        Clinic.approval_status == "approved", Clinic.is_active == True
    ).scalar() or 0
    pending_clinics  = db.query(func.count(Clinic.id)).filter(
        Clinic.approval_status == "pending"
    ).scalar() or 0
    suspended_clinics = db.query(func.count(Clinic.id)).filter(
        Clinic.approval_status == "suspended"
    ).scalar() or 0

    triage_today = db.query(func.count(TriageSession.id)).filter(
        func.date(TriageSession.created_at) == today
    ).scalar() or 0
    triage_week = db.query(func.count(TriageSession.id)).filter(
        func.date(TriageSession.created_at) >= week_start
    ).scalar() or 0
    triage_total = db.query(func.count(TriageSession.id)).scalar() or 0

    appointments_total = db.query(func.count(Appointment.id)).scalar() or 0
    appointments_completed = db.query(func.count(Appointment.id)).filter(
        Appointment.status == AppointmentStatus.COMPLETED
    ).scalar() or 0
    appointments_cancelled = db.query(func.count(Appointment.id)).filter(
        Appointment.status == AppointmentStatus.CANCELLED
    ).scalar() or 0

    cancellation_rate = round(
        appointments_cancelled / max(appointments_total, 1) * 100, 1
    )

    total_revenue = db.query(
        func.coalesce(func.sum(Appointment.amount_kes), 0)
    ).filter(Appointment.status == AppointmentStatus.COMPLETED).scalar() or 0

    active_clinics = db.query(Clinic).filter(Clinic.is_active == True).all()
    mrr_kes = sum(MRR_BY_PLAN.get(c.subscription_plan, 0) for c in active_clinics)

    active_sessions = db.query(func.count(UserSession.id)).filter(
        UserSession.is_active == True,
        UserSession.expires_at > datetime.now(timezone.utc),
    ).scalar() or 0

    weekly_activity = []
    for d in range(6, -1, -1):
        day = today - timedelta(days=d)
        t_count = db.query(func.count(TriageSession.id)).filter(
            func.date(TriageSession.created_at) == day
        ).scalar() or 0
        u_count = db.query(func.count(User.id)).filter(
            func.date(User.created_at) == day
        ).scalar() or 0
        weekly_activity.append({
            "label": day.strftime("%a"),
            "users": int(u_count),
            "triage": int(t_count),
        })

    return {
        "total_users": total_users,
        "total_clinics": total_clinics,
        "verified_clinics": verified_clinics,
        "pending_clinics": pending_clinics,
        "suspended_clinics": suspended_clinics,
        "triage_today": triage_today,
        "triage_week": triage_week,
        "triage_total": triage_total,
        "appointments_completed": appointments_completed,
        "appointments_total": appointments_total,
        "cancellation_rate": cancellation_rate,
        "total_revenue_kes": float(total_revenue),
        "mrr_kes": mrr_kes,
        "active_sessions": active_sessions,
        "weekly_activity": weekly_activity,
    }


# ── Platform triage stats ──────────────────────────────────────────────────────

@router.get("/triage-stats")
def triage_stats(
    current_user: User = Depends(require_role(UserRole.SUPER_ADMIN)),
    db: Session = Depends(get_db),
):
    today = date.today()

    top_symptoms = [
        {"symptom": r.symptom_name.title(), "count": r.cnt}
        for r in db.query(
            SymptomLog.symptom_name,
            func.count(SymptomLog.symptom_name).label("cnt"),
        )
        .group_by(SymptomLog.symptom_name)
        .order_by(func.count(SymptomLog.symptom_name).desc())
        .limit(10)
        .all()
    ]

    severity_rows = (
        db.query(TriageSession.severity_level, func.count(TriageSession.id).label("cnt"))
        .filter(TriageSession.severity_level.isnot(None))
        .group_by(TriageSession.severity_level)
        .all()
    )
    severity_breakdown = [{"name": r.severity_level.title(), "value": r.cnt} for r in severity_rows]

    county_rows = (
        db.query(TriageSession.county, func.count(TriageSession.id).label("cnt"))
        .filter(TriageSession.county.isnot(None))
        .group_by(TriageSession.county)
        .order_by(func.count(TriageSession.id).desc())
        .limit(10)
        .all()
    )
    county_breakdown = [{"county": r.county, "sessions": r.cnt} for r in county_rows]

    monthly_trend = []
    for m in range(5, -1, -1):
        month_start = (today.replace(day=1) - timedelta(days=m * 30)).replace(day=1)
        if m == 0:
            month_end = today
        else:
            next_start = (today.replace(day=1) - timedelta(days=(m - 1) * 30)).replace(day=1)
            month_end = next_start - timedelta(days=1)
        cnt = db.query(func.count(TriageSession.id)).filter(
            func.date(TriageSession.created_at) >= month_start,
            func.date(TriageSession.created_at) <= month_end,
        ).scalar() or 0
        monthly_trend.append({"month": month_start.strftime("%b %y"), "sessions": int(cnt)})

    total = db.query(func.count(TriageSession.id)).scalar() or 0

    return {
        "total": total,
        "top_symptoms": top_symptoms,
        "severity_breakdown": severity_breakdown,
        "county_breakdown": county_breakdown,
        "monthly_trend": monthly_trend,
    }


# ── Clinics ────────────────────────────────────────────────────────────────────

_ALLOWED_CLINIC_STATUSES = {"pending", "approved", "rejected", "suspended"}


@router.get("/clinics")
def list_clinics(
    q: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    current_user: User = Depends(require_role(UserRole.SUPER_ADMIN)),
    db: Session = Depends(get_db),
):
    # Fix #14: validate status filter
    if status and status not in _ALLOWED_CLINIC_STATUSES:
        raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {', '.join(_ALLOWED_CLINIC_STATUSES)}")

    query = db.query(Clinic)
    if q:
        query = query.filter(
            Clinic.name.ilike(f"%{q}%") | Clinic.county.ilike(f"%{q}%")
        )
    if status:
        query = query.filter(Clinic.approval_status == status)
    clinics = query.order_by(Clinic.created_at.desc()).all()

    if not clinics:
        return []

    clinic_ids = [c.id for c in clinics]

    # Fix #7: batch queries instead of N+1
    owners_raw = (
        db.query(User.clinic_id, User)
        .filter(User.clinic_id.in_(clinic_ids), User.role == UserRole.CLINIC_ADMIN)
        .order_by(User.created_at)
        .all()
    )
    owners: dict = {}
    for clinic_id, user in owners_raw:
        if clinic_id not in owners:
            owners[clinic_id] = user

    doc_counts = dict(
        db.query(Doctor.clinic_id, func.count(Doctor.id))
        .filter(Doctor.clinic_id.in_(clinic_ids))
        .group_by(Doctor.clinic_id)
        .all()
    )

    rev_map = dict(
        db.query(Appointment.clinic_id, func.coalesce(func.sum(Appointment.amount_kes), 0))
        .filter(
            Appointment.clinic_id.in_(clinic_ids),
            Appointment.status == AppointmentStatus.COMPLETED,
        )
        .group_by(Appointment.clinic_id)
        .all()
    )

    result = []
    for c in clinics:
        owner = owners.get(c.id)
        result.append({
            "id": str(c.id),
            "name": c.name,
            "county": c.county,
            "address": c.address,
            "phone": c.phone,
            "email": c.email,
            "owner_name": owner.full_name if owner else "",
            "owner_email": owner.email if owner else "",
            "owner_phone": owner.phone if owner else "",
            "is_verified": c.is_verified,
            "is_active": c.is_active,
            "approval_status": c.approval_status,
            "approval_notes": c.approval_notes,
            "registration_reference": c.registration_reference,
            "submitted_at": c.submitted_at.isoformat() if c.submitted_at else None,
            "approved_at": c.approved_at.isoformat() if c.approved_at else None,
            "subscription_plan": c.subscription_plan,
            "license_number": c.license_number,
            "business_registration_number": c.business_registration_number,
            "year_established": c.year_established,
            "mrr_kes": MRR_BY_PLAN.get(c.subscription_plan, 0),
            "total_revenue_kes": float(rev_map.get(c.id, 0)),
            "doctor_count": doc_counts.get(c.id, 0),
            "specialties": c.specialties or [],
            "documents": c.documents or [],
            "created_at": c.created_at.isoformat(),
        })
    return result


@router.get("/clinics/{clinic_id}")
def get_clinic_detail(
    clinic_id: str,
    current_user: User = Depends(require_role(UserRole.SUPER_ADMIN)),
    db: Session = Depends(get_db),
):
    clinic = db.query(Clinic).filter(Clinic.id == clinic_id).first()
    if not clinic:
        raise HTTPException(status_code=404, detail="Clinic not found")

    owner = (
        db.query(User)
        .filter(User.clinic_id == clinic.id, User.role == UserRole.CLINIC_ADMIN)
        .order_by(User.created_at)
        .first()
    )
    doc_count = db.query(func.count(Doctor.id)).filter(Doctor.clinic_id == clinic.id).scalar() or 0
    appt_count = db.query(func.count(Appointment.id)).filter(Appointment.clinic_id == clinic.id).scalar() or 0

    return {
        "id": str(clinic.id),
        "name": clinic.name,
        "county": clinic.county,
        "sub_county": clinic.sub_county,
        "address": clinic.address,
        "phone": clinic.phone,
        "email": clinic.email,
        "website": clinic.website,
        "description": clinic.description,
        "license_number": clinic.license_number,
        "business_registration_number": clinic.business_registration_number,
        "year_established": clinic.year_established,
        "specialties": clinic.specialties or [],
        "operating_hours": clinic.operating_hours or {},
        "is_verified": clinic.is_verified,
        "is_active": clinic.is_active,
        "approval_status": clinic.approval_status,
        "approval_notes": clinic.approval_notes,
        "registration_reference": clinic.registration_reference,
        "submitted_at": clinic.submitted_at.isoformat() if clinic.submitted_at else None,
        "approved_at": clinic.approved_at.isoformat() if clinic.approved_at else None,
        "documents": clinic.documents or [],
        "subscription_plan": clinic.subscription_plan,
        "doctor_count": doc_count,
        "appointment_count": appt_count,
        "created_at": clinic.created_at.isoformat(),
        "owner": {
            "id": str(owner.id) if owner else None,
            "full_name": owner.full_name if owner else None,
            "email": owner.email if owner else None,
            "phone": owner.phone if owner else None,
            "is_active": owner.is_active if owner else None,
            "is_clinic_approved": owner.is_clinic_approved if owner else None,
            "created_at": owner.created_at.isoformat() if owner else None,
        },
    }


@router.post("/clinics", status_code=201)
def add_clinic(
    body: AddClinicBody,
    current_user: User = Depends(require_role(UserRole.SUPER_ADMIN)),
    db: Session = Depends(get_db),
):
    if body.email and db.query(Clinic).filter(Clinic.email == body.email).first():
        raise HTTPException(status_code=409, detail="A clinic with that email already exists")

    clinic = Clinic(
        name=body.name,
        slug=_slug(body.name),
        county=body.county,
        address=body.address or "",
        phone=body.phone,
        email=body.email or None,
        license_number=body.license_number or None,
        subscription_plan=body.subscription_plan,
        is_active=True,
        is_verified=False,
    )
    db.add(clinic)
    db.flush()

    owner = db.query(User).filter(User.email == body.owner_email).first()
    if owner and not owner.clinic_id:
        owner.clinic_id = clinic.id
        owner.role = UserRole.CLINIC_ADMIN

    db.commit()
    return {"id": str(clinic.id), "name": clinic.name, "slug": clinic.slug}


@router.post("/clinics/{clinic_id}/verify")
def verify_clinic(
    clinic_id: str,
    current_user: User = Depends(require_role(UserRole.SUPER_ADMIN)),
    db: Session = Depends(get_db),
):
    clinic = db.query(Clinic).filter(Clinic.id == clinic_id).first()
    if not clinic:
        raise HTTPException(status_code=404, detail="Clinic not found")
    clinic.is_verified = True
    clinic.is_active = True
    db.commit()
    return {"ok": True}


@router.post("/clinics/{clinic_id}/approve")
def approve_clinic(
    clinic_id: str,
    body: ApproveBody = ApproveBody(),
    current_user: User = Depends(require_role(UserRole.SUPER_ADMIN)),
    db: Session = Depends(get_db),
):
    clinic = db.query(Clinic).filter(Clinic.id == clinic_id).first()
    if not clinic:
        raise HTTPException(status_code=404, detail="Clinic not found")

    clinic.approval_status = "approved"
    clinic.is_verified = True
    clinic.is_active = True
    clinic.approval_notes = body.notes
    clinic.approved_by = current_user.id
    clinic.approved_at = datetime.now(timezone.utc)

    # Activate the clinic admin account
    admin = (
        db.query(User)
        .filter(User.clinic_id == clinic.id, User.role == UserRole.CLINIC_ADMIN)
        .first()
    )
    if admin:
        admin.is_active = True
        admin.is_clinic_approved = True

    db.commit()
    return {"ok": True, "registration_reference": clinic.registration_reference}


@router.post("/clinics/{clinic_id}/reject")
def reject_clinic(
    clinic_id: str,
    body: RejectBody,
    current_user: User = Depends(require_role(UserRole.SUPER_ADMIN)),
    db: Session = Depends(get_db),
):
    clinic = db.query(Clinic).filter(Clinic.id == clinic_id).first()
    if not clinic:
        raise HTTPException(status_code=404, detail="Clinic not found")
    if not body.reason.strip():
        raise HTTPException(400, "Rejection reason is required")

    clinic.approval_status = "rejected"
    clinic.approval_notes = body.reason
    clinic.is_active = False
    db.commit()
    return {"ok": True}


@router.post("/clinics/{clinic_id}/suspend")
def suspend_clinic(
    clinic_id: str,
    body: SuspendBody = SuspendBody(),
    current_user: User = Depends(require_role(UserRole.SUPER_ADMIN)),
    db: Session = Depends(get_db),
):
    clinic = db.query(Clinic).filter(Clinic.id == clinic_id).first()
    if not clinic:
        raise HTTPException(status_code=404, detail="Clinic not found")
    clinic.approval_status = "suspended"
    clinic.approval_notes = body.reason
    clinic.is_active = False
    db.commit()
    return {"ok": True}


@router.post("/clinics/{clinic_id}/reactivate")
def reactivate_clinic(
    clinic_id: str,
    current_user: User = Depends(require_role(UserRole.SUPER_ADMIN)),
    db: Session = Depends(get_db),
):
    clinic = db.query(Clinic).filter(Clinic.id == clinic_id).first()
    if not clinic:
        raise HTTPException(status_code=404, detail="Clinic not found")
    clinic.approval_status = "approved"
    clinic.is_active = True
    db.commit()
    return {"ok": True}


@router.delete("/clinics/{clinic_id}", status_code=204)
def delete_clinic(
    clinic_id: str,
    current_user: User = Depends(require_role(UserRole.SUPER_ADMIN)),
    db: Session = Depends(get_db),
):
    clinic = db.query(Clinic).filter(Clinic.id == clinic_id).first()
    if not clinic:
        raise HTTPException(status_code=404, detail="Clinic not found")
    db.query(User).filter(User.clinic_id == clinic.id).update({"clinic_id": None})
    db.delete(clinic)
    db.commit()


# ── Users ──────────────────────────────────────────────────────────────────────

@router.get("/users")
def list_users(
    q: Optional[str] = Query(None),
    role: Optional[str] = Query(None),
    limit: int = Query(100, le=500),
    current_user: User = Depends(require_role(UserRole.SUPER_ADMIN)),
    db: Session = Depends(get_db),
):
    query = db.query(User)
    if q:
        like = f"%{q}%"
        query = query.filter(
            User.full_name.ilike(like) | User.email.ilike(like) | User.phone.ilike(like)
        )
    if role:
        query = query.filter(User.role == role)

    users = query.order_by(User.created_at.desc()).limit(limit).all()

    if not users:
        return []

    # Fix #8: batch aggregate queries instead of N+1
    user_ids = [u.id for u in users]
    now_utc = datetime.now(timezone.utc)

    session_counts = dict(
        db.query(UserSession.user_id, func.count(UserSession.id))
        .filter(
            UserSession.user_id.in_(user_ids),
            UserSession.is_active == True,
            UserSession.expires_at > now_utc,
        )
        .group_by(UserSession.user_id)
        .all()
    )
    appt_counts = dict(
        db.query(Appointment.patient_id, func.count(Appointment.id))
        .filter(Appointment.patient_id.in_(user_ids))
        .group_by(Appointment.patient_id)
        .all()
    )
    order_counts = dict(
        db.query(Order.patient_id, func.count(Order.id))
        .filter(Order.patient_id.in_(user_ids))
        .group_by(Order.patient_id)
        .all()
    )

    result = []
    for u in users:
        clinic_name = u.clinic.name if u.clinic else None
        result.append({
            "id": str(u.id),
            "full_name": u.full_name,
            "email": u.email,
            "phone": u.phone,
            "role": u.role,
            "clinic_id": str(u.clinic_id) if u.clinic_id else None,
            "clinic_name": clinic_name,
            "county": u.county,
            "is_active": u.is_active,
            "is_email_verified": u.is_email_verified,
            "is_clinic_approved": u.is_clinic_approved,
            "avatar_url": u.avatar_url,
            "created_at": u.created_at.isoformat(),
            "last_login": u.last_login_at.isoformat() if u.last_login_at else None,
            "session_count": session_counts.get(u.id, 0),
            "total_appointments": appt_counts.get(u.id, 0),
            "total_orders": order_counts.get(u.id, 0),
            "warning_count": u.warning_count or 0,
            "ban_reason": u.ban_reason,
            "banned_at": u.banned_at.isoformat() if u.banned_at else None,
            "suspension_reason": u.suspension_reason,
        })
    return result


@router.post("/users/{user_id}/force-logout")
def force_logout(
    user_id: str,
    current_user: User = Depends(require_role(UserRole.SUPER_ADMIN)),
    db: Session = Depends(get_db),
):
    db.query(UserSession).filter(
        UserSession.user_id == user_id
    ).update({"is_active": False})
    db.commit()
    return {"ok": True}


@router.post("/users/{user_id}/lock")
def lock_user(
    user_id: str,
    current_user: User = Depends(require_role(UserRole.SUPER_ADMIN)),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.is_active = False
    db.query(UserSession).filter(UserSession.user_id == user_id).update({"is_active": False})
    db.commit()
    return {"ok": True}


@router.post("/users/{user_id}/unlock")
def unlock_user(
    user_id: str,
    current_user: User = Depends(require_role(UserRole.SUPER_ADMIN)),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.is_active = True
    user.failed_login_attempts = 0
    user.locked_until = None
    db.commit()
    return {"ok": True}


@router.post("/users/{user_id}/warn")
def warn_user(
    user_id: str,
    body: WarnBody,
    current_user: User = Depends(require_role(UserRole.SUPER_ADMIN)),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.role == UserRole.SUPER_ADMIN:
        raise HTTPException(status_code=403, detail="Cannot warn a super admin")
    user.warning_count = (user.warning_count or 0) + 1
    db.commit()
    return {"ok": True, "warning_count": user.warning_count}


@router.post("/users/{user_id}/ban")
def ban_user(
    user_id: str,
    body: BanBody,
    current_user: User = Depends(require_role(UserRole.SUPER_ADMIN)),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.role == UserRole.SUPER_ADMIN:
        raise HTTPException(status_code=403, detail="Cannot ban a super admin")
    user.is_active = False
    user.ban_reason = body.reason
    user.banned_at = datetime.now(timezone.utc)
    db.query(UserSession).filter(UserSession.user_id == user_id).update({"is_active": False})
    db.commit()
    return {"ok": True}


@router.post("/users/{user_id}/reset-password")
def reset_password(
    user_id: str,
    current_user: User = Depends(require_role(UserRole.SUPER_ADMIN)),
    db: Session = Depends(get_db),
):
    import secrets as _secrets
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    token = _secrets.token_urlsafe(32)
    user.password_reset_token = token
    user.password_reset_expires = datetime.now(timezone.utc) + timedelta(hours=24)
    db.commit()
    return {"ok": True, "message": "Password reset token generated. User will be notified."}


@router.patch("/users/{user_id}/role")
def change_role(
    user_id: str,
    body: RoleBody,
    current_user: User = Depends(require_role(UserRole.SUPER_ADMIN)),
    db: Session = Depends(get_db),
):
    if body.role not in VALID_ROLES:
        raise HTTPException(status_code=400, detail=f"Invalid role: {body.role}")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.role = body.role
    db.commit()
    return {"ok": True, "role": user.role}


@router.delete("/users/{user_id}", status_code=204)
def delete_user(
    user_id: str,
    current_user: User = Depends(require_role(UserRole.SUPER_ADMIN)),
    db: Session = Depends(get_db),
):
    import secrets as _secrets
    from app.models.review import Review

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.role == UserRole.SUPER_ADMIN:
        raise HTTPException(status_code=403, detail="Cannot delete a super admin account")

    # GDPR anonymisation — wipe PII while preserving FK integrity
    token = _secrets.token_hex(8)
    user.full_name = "Deleted User"
    user.email = f"deleted_{token}@deleted.invalid"
    user.phone = f"+000{token[:9]}"
    user.password_hash = _secrets.token_hex(32)
    user.avatar_url = None
    user.county = None
    user.date_of_birth = None
    user.gender = None
    user.blood_type = None
    user.allergies = None
    user.chronic_conditions = None
    user.emergency_contact = None
    user.two_factor_enabled = False
    user.two_factor_secret = None
    user.password_reset_token = None
    user.email_verify_token = None
    user.is_active = False

    # Fix #15: unpublish reviews so deleted user's content doesn't appear publicly
    db.query(Review).filter(Review.patient_id == user_id).update({"is_published": False})

    # Force-logout all sessions
    db.query(UserSession).filter(UserSession.user_id == user_id).update({"is_active": False})
    db.commit()


# ── Change requests ────────────────────────────────────────────────────────────

_IMMUTABLE_FIELDS = {"license_number", "registration_number", "business_registration_number"}


@router.get("/change-requests")
def list_change_requests(
    status: str = Query("pending"),
    current_user: User = Depends(require_role(UserRole.SUPER_ADMIN)),
    db: Session = Depends(get_db),
):
    from sqlalchemy import text
    rows = db.execute(text("""
        SELECT
            cr.id, cr.field_name, cr.current_value, cr.requested_value,
            cr.reason, cr.status, cr.created_at, cr.reviewed_at,
            c.id   AS clinic_id,   c.name AS clinic_name,  c.county AS clinic_county,
            u.id   AS requester_id, u.full_name AS requester_name, u.email AS requester_email,
            rv.full_name AS reviewer_name
        FROM clinic_change_requests cr
        JOIN clinics c ON c.id = cr.clinic_id
        LEFT JOIN users u  ON u.id  = cr.requested_by
        LEFT JOIN users rv ON rv.id = cr.reviewed_by
        WHERE cr.status = :status
        ORDER BY cr.created_at DESC
    """), {"status": status}).mappings().all()
    return [
        {
            "id":             str(r["id"]),
            "field_name":     r["field_name"],
            "current_value":  r["current_value"],
            "requested_value": r["requested_value"],
            "reason":         r["reason"],
            "status":         r["status"],
            "created_at":     r["created_at"].isoformat() if r["created_at"] else None,
            "reviewed_at":    r["reviewed_at"].isoformat() if r["reviewed_at"] else None,
            "clinic_id":      str(r["clinic_id"]),
            "clinic_name":    r["clinic_name"],
            "clinic_county":  r["clinic_county"],
            "requester_name": r["requester_name"],
            "requester_email": r["requester_email"],
            "reviewer_name":  r["reviewer_name"],
        }
        for r in rows
    ]


@router.get("/change-requests/count")
def count_pending_change_requests(
    current_user: User = Depends(require_role(UserRole.SUPER_ADMIN)),
    db: Session = Depends(get_db),
):
    from sqlalchemy import text
    count = db.execute(text(
        "SELECT COUNT(*) FROM clinic_change_requests WHERE status = 'pending'"
    )).scalar() or 0
    return {"pending": count}


@router.post("/change-requests/{req_id}/approve")
def approve_change_request(
    req_id: str,
    body: ChangeReqReviewBody,
    current_user: User = Depends(require_role(UserRole.SUPER_ADMIN)),
    db: Session = Depends(get_db),
):
    from sqlalchemy import text
    row = db.execute(text("""
        SELECT id, clinic_id, field_name, requested_value, status
        FROM clinic_change_requests WHERE id = :id
    """), {"id": req_id}).mappings().first()

    if not row:
        raise HTTPException(status_code=404, detail="Change request not found")
    if row["status"] != "pending":
        raise HTTPException(status_code=400, detail="Request is not in pending state")
    if row["field_name"] in _IMMUTABLE_FIELDS:
        raise HTTPException(
            status_code=400,
            detail=f"Field '{row['field_name']}' is immutable after approval",
        )

    clinic = db.query(Clinic).filter(Clinic.id == row["clinic_id"]).first()
    if not clinic:
        raise HTTPException(status_code=404, detail="Clinic not found")

    setattr(clinic, row["field_name"], row["requested_value"])

    db.execute(text("""
        UPDATE clinic_change_requests
        SET status = 'approved', reviewed_by = :reviewed_by, reviewed_at = :now
        WHERE id = :id
    """), {
        "id": req_id,
        "reviewed_by": str(current_user.id),
        "now": datetime.now(timezone.utc),
    })
    db.commit()
    return {"ok": True}


@router.post("/change-requests/{req_id}/reject")
def reject_change_request(
    req_id: str,
    body: RejectBody,
    current_user: User = Depends(require_role(UserRole.SUPER_ADMIN)),
    db: Session = Depends(get_db),
):
    from sqlalchemy import text
    row = db.execute(text(
        "SELECT id, status FROM clinic_change_requests WHERE id = :id"
    ), {"id": req_id}).mappings().first()

    if not row:
        raise HTTPException(status_code=404, detail="Change request not found")
    if row["status"] != "pending":
        raise HTTPException(status_code=400, detail="Request is not in pending state")

    db.execute(text("""
        UPDATE clinic_change_requests
        SET status = 'rejected', reviewed_by = :reviewed_by, reviewed_at = :now
        WHERE id = :id
    """), {
        "id": req_id,
        "reviewed_by": str(current_user.id),
        "now": datetime.now(timezone.utc),
    })
    db.commit()
    return {"ok": True}
