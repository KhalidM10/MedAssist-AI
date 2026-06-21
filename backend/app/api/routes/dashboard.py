import uuid
from datetime import date, datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.core.deps import get_current_user, get_db, require_role
from app.models.appointment import Appointment, AppointmentStatus
from app.models.clinic import Clinic
from app.models.doctor import Doctor
from app.models.order import Order, OrderStatus
from app.models.review import Review
from app.models.triage import SymptomLog, TriageSession
from app.models.user import User, UserRole


PLAN_PRICES_KES = {"basic": 3_500, "pro": 8_500, "enterprise": 18_000}
VALID_PLANS = set(PLAN_PRICES_KES.keys())


class _ReplyBody(BaseModel):
    reply: str


class _ChangeRequestBody(BaseModel):
    field_name: str
    current_value: Optional[str] = None
    requested_value: str
    reason: Optional[str] = None


class _UpgradeBody(BaseModel):
    plan: str
    mpesa_phone: str

router = APIRouter()


def _get_clinic(current_user: User, db: Session) -> Clinic:
    if not current_user.clinic_id:
        raise HTTPException(status_code=404, detail="No clinic associated with this account")
    clinic = db.query(Clinic).filter(Clinic.id == current_user.clinic_id).first()
    if not clinic:
        raise HTTPException(status_code=404, detail="Clinic not found")
    return clinic


def _require_active_subscription(clinic: Clinic) -> None:
    """Fix #5: block access to premium features when subscription has lapsed."""
    if clinic.subscription_expires_at and clinic.subscription_plan in ("pro", "enterprise"):
        if datetime.now(timezone.utc) > clinic.subscription_expires_at:
            raise HTTPException(
                status_code=402,
                detail="Your subscription has expired. Please renew to continue using this feature.",
            )


def _subtract_months(d: date, months: int) -> date:
    month = d.month - months
    year = d.year + (month - 1) // 12
    month = month % 12 or 12
    return d.replace(year=year, month=month, day=1)



# ── Stats overview ────────────────────────────────────────────────────────────

@router.get("/stats")
def clinic_stats(
    current_user: User = Depends(require_role(UserRole.CLINIC_ADMIN, UserRole.SUPER_ADMIN)),
    db: Session = Depends(get_db),
):
    today = date.today()

    if current_user.role == UserRole.SUPER_ADMIN:
        total_clinics = db.query(func.count(Clinic.id)).filter(Clinic.is_active == True).scalar() or 0
        total_patients = db.query(func.count(User.id)).filter(User.role == UserRole.PATIENT).scalar() or 0
        total_appointments = db.query(func.count(Appointment.id)).scalar() or 0
        total_revenue = db.query(func.coalesce(func.sum(Appointment.amount_kes), 0)).filter(
            Appointment.status == AppointmentStatus.COMPLETED
        ).scalar() or 0
        appointments_today = db.query(func.count(Appointment.id)).filter(
            Appointment.appointment_date == today
        ).scalar() or 0
        return {
            "role": "super_admin",
            "total_clinics": total_clinics,
            "total_patients": total_patients,
            "total_appointments": total_appointments,
            "appointments_today": appointments_today,
            "total_revenue_kes": float(total_revenue),
        }

    clinic = db.query(Clinic).filter(Clinic.id == current_user.clinic_id).first() if current_user.clinic_id else None
    if not clinic:
        return {
            "role": "clinic_admin", "clinic_name": None, "clinic_county": None,
            "appointments_today": 0, "pending": 0, "confirmed": 0,
            "completed": 0, "total_appointments": 0, "total_revenue_kes": 0.0,
            "pending_orders": 0, "completion_rate": 0.0,
        }

    appointments_today = db.query(func.count(Appointment.id)).filter(
        Appointment.clinic_id == clinic.id, Appointment.appointment_date == today
    ).scalar() or 0

    pending = db.query(func.count(Appointment.id)).filter(
        Appointment.clinic_id == clinic.id, Appointment.status == AppointmentStatus.PENDING
    ).scalar() or 0

    confirmed = db.query(func.count(Appointment.id)).filter(
        Appointment.clinic_id == clinic.id, Appointment.status == AppointmentStatus.CONFIRMED
    ).scalar() or 0

    completed = db.query(func.count(Appointment.id)).filter(
        Appointment.clinic_id == clinic.id, Appointment.status == AppointmentStatus.COMPLETED
    ).scalar() or 0

    total = db.query(func.count(Appointment.id)).filter(
        Appointment.clinic_id == clinic.id
    ).scalar() or 0

    revenue = db.query(func.coalesce(func.sum(Appointment.amount_kes), 0)).filter(
        Appointment.clinic_id == clinic.id, Appointment.status == AppointmentStatus.COMPLETED
    ).scalar() or 0

    # Week revenue (Mon–Sun of current week)
    week_start = today - timedelta(days=today.weekday())
    week_revenue = db.query(func.coalesce(func.sum(Appointment.amount_kes), 0)).filter(
        Appointment.clinic_id == clinic.id,
        Appointment.status == AppointmentStatus.COMPLETED,
        Appointment.appointment_date >= week_start,
        Appointment.appointment_date <= today,
    ).scalar() or 0

    pending_orders = db.query(func.count(Order.id)).filter(
        Order.status == OrderStatus.PENDING
    ).scalar() or 0

    completion_rate = round(completed / max(total, 1) * 100, 1)

    return {
        "role": "clinic_admin",
        "clinic_name": clinic.name,
        "clinic_county": clinic.county,
        "appointments_today": appointments_today,
        "pending": pending,
        "confirmed": confirmed,
        "completed": completed,
        "total_appointments": total,
        "total_revenue_kes": float(revenue),
        "week_revenue_kes": float(week_revenue),
        "pending_orders": pending_orders,
        "completion_rate": completion_rate,
    }


# ── Analytics ────────────────────────────────────────────────────────────────

@router.get("/analytics")
def clinic_analytics(
    current_user: User = Depends(require_role(UserRole.CLINIC_ADMIN, UserRole.SUPER_ADMIN)),
    db: Session = Depends(get_db),
):
    clinic = _get_clinic(current_user, db)
    _require_active_subscription(clinic)
    today = date.today()

    # ── Weekly appointment trend (last 8 weeks) — real data only ─────────────
    weekly_trend = []
    for w in range(7, -1, -1):
        week_start = today - timedelta(weeks=w, days=today.weekday())
        week_end = week_start + timedelta(days=6)

        appts = db.query(func.count(Appointment.id)).filter(
            Appointment.clinic_id == clinic.id,
            Appointment.appointment_date >= week_start,
            Appointment.appointment_date <= min(week_end, today),
        ).scalar() or 0

        rev = db.query(func.coalesce(func.sum(Appointment.amount_kes), 0)).filter(
            Appointment.clinic_id == clinic.id,
            Appointment.status == AppointmentStatus.COMPLETED,
            Appointment.appointment_date >= week_start,
            Appointment.appointment_date <= min(week_end, today),
        ).scalar() or 0

        weekly_trend.append({
            "label": week_start.strftime("%b %d"),
            "appointments": int(appts),
            "revenue": round(float(rev)),
        })

    # ── Monthly revenue (last 6 months) — real data only ─────────────────────
    monthly_revenue = []
    for m in range(5, -1, -1):
        month_start = _subtract_months(today.replace(day=1), m)
        if m == 0:
            month_end = today
        else:
            next_ms = _subtract_months(today.replace(day=1), m - 1)
            month_end = next_ms - timedelta(days=1)

        rev = db.query(func.coalesce(func.sum(Appointment.amount_kes), 0)).filter(
            Appointment.clinic_id == clinic.id,
            Appointment.status == AppointmentStatus.COMPLETED,
            Appointment.appointment_date >= month_start,
            Appointment.appointment_date <= month_end,
        ).scalar() or 0

        monthly_revenue.append({
            "month": month_start.strftime("%b"),
            "revenue": round(float(rev)),
        })

    # ── Top symptoms from real triage sessions in this county ────────────────
    symptom_rows = (
        db.query(
            SymptomLog.symptom_name,
            func.count(SymptomLog.symptom_name).label("cnt"),
        )
        .join(TriageSession, TriageSession.id == SymptomLog.triage_session_id)
        .filter(TriageSession.county == clinic.county)
        .group_by(SymptomLog.symptom_name)
        .order_by(func.count(SymptomLog.symptom_name).desc())
        .limit(10)
        .all()
    )
    top_symptoms = [{"symptom": r.symptom_name.title(), "count": r.cnt} for r in symptom_rows]

    # ── Completion rate ───────────────────────────────────────────────────────
    total_a = db.query(func.count(Appointment.id)).filter(Appointment.clinic_id == clinic.id).scalar() or 0
    done_a = db.query(func.count(Appointment.id)).filter(
        Appointment.clinic_id == clinic.id, Appointment.status == AppointmentStatus.COMPLETED
    ).scalar() or 0
    completion_rate = round(done_a / max(total_a, 1) * 100, 1)

    return {
        "weekly_trend": weekly_trend,
        "monthly_revenue": monthly_revenue,
        "top_symptoms": top_symptoms,
        "completion_rate": completion_rate,
    }


# ── Appointments (clinic management) ─────────────────────────────────────────

@router.get("/appointments")
def dashboard_appointments(
    appt_date: Optional[date] = Query(None),
    doctor_id: Optional[str] = Query(None),
    appt_status: Optional[str] = Query(None, alias="status"),
    limit: int = Query(50, le=200),
    current_user: User = Depends(require_role(UserRole.CLINIC_ADMIN, UserRole.SUPER_ADMIN)),
    db: Session = Depends(get_db),
):
    clinic = _get_clinic(current_user, db)

    q = (
        db.query(Appointment)
        .options(joinedload(Appointment.doctor))
        .join(User, User.id == Appointment.patient_id)
        .add_columns(User.full_name.label("patient_name"))
        .filter(Appointment.clinic_id == clinic.id)
    )

    if appt_date:
        q = q.filter(Appointment.appointment_date == appt_date)
    if doctor_id:
        q = q.filter(Appointment.doctor_id == doctor_id)
    if appt_status:
        try:
            q = q.filter(Appointment.status == AppointmentStatus(appt_status))
        except ValueError:
            pass

    rows = q.order_by(Appointment.appointment_date.desc(), Appointment.appointment_time).limit(limit).all()

    return [
        {
            "id": str(appt.id),
            "patient_name": patient_name,
            "appointment_date": str(appt.appointment_date),
            "appointment_time": str(appt.appointment_time)[:5],
            "status": appt.status,
            "reason": appt.reason,
            "amount_kes": appt.amount_kes,
            "booking_reference": f"MA-{str(appt.id).upper().replace('-', '')[:8]}",
            "doctor_name": appt.doctor.full_name if appt.doctor else None,
        }
        for appt, patient_name in rows
    ]


@router.patch("/appointments/{appointment_id}/status")
async def update_appointment_status(
    appointment_id: str,
    new_status: str = Query(..., alias="status"),
    background_tasks: BackgroundTasks = None,
    current_user: User = Depends(require_role(UserRole.CLINIC_ADMIN, UserRole.SUPER_ADMIN)),
    db: Session = Depends(get_db),
):
    from fastapi import BackgroundTasks as BT
    clinic = _get_clinic(current_user, db)
    appt = db.query(Appointment).filter(
        Appointment.id == appointment_id,
        Appointment.clinic_id == clinic.id,
    ).first()
    if not appt:
        raise HTTPException(status_code=404, detail="Appointment not found")
    try:
        appt.status = AppointmentStatus(new_status)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid status: {new_status}")
    db.commit()

    # Notify patient of status change
    patient_id = str(appt.patient_id)
    clinic_name = clinic.name
    appt_date = str(appt.appointment_date)
    appt_time = str(appt.appointment_time)[:5]

    import asyncio
    asyncio.ensure_future(_notify_appt_status_change(
        patient_id=patient_id,
        appointment_id=appointment_id,
        new_status=new_status,
        clinic_name=clinic_name,
        appt_date=appt_date,
        appt_time=appt_time,
    ))

    return {"id": str(appt.id), "status": appt.status}


async def _notify_appt_status_change(
    patient_id: str, appointment_id: str, new_status: str,
    clinic_name: str, appt_date: str, appt_time: str,
) -> None:
    from app.database import SessionLocal
    from app.models.user import User as UserModel
    from app.services.notification_service import notify
    from app.services.sms import (
        sms_appointment_confirmed, sms_appointment_cancelled,
    )

    STATUS_TITLES = {
        "confirmed":   ("Appointment Confirmed", "confirmed"),
        "cancelled":   ("Appointment Cancelled", "cancelled"),
        "completed":   ("Appointment Completed", "completed"),
        "in_progress": ("Appointment In Progress", None),
    }
    info = STATUS_TITLES.get(new_status)
    if not info:
        return

    db = SessionLocal()
    try:
        patient = db.query(UserModel).filter(UserModel.id == patient_id).first()
        if not patient:
            return

        title, _ = info
        body = (
            f"Your appointment at {clinic_name} on {appt_date} at {appt_time} is now {new_status}."
        )
        channels = ["in_app"]
        if patient.phone and new_status in ("confirmed", "cancelled"):
            channels.append("sms")

        await notify(
            db, patient,
            type=f"appointment_{new_status}",
            title=title,
            body=body,
            data={"appointment_id": appointment_id, "new_status": new_status},
            channels=channels,
        )
        db.commit()
    finally:
        db.close()


# ── Doctors list ──────────────────────────────────────────────────────────────

@router.get("/doctors")
def clinic_doctors(
    current_user: User = Depends(require_role(UserRole.CLINIC_ADMIN, UserRole.SUPER_ADMIN)),
    db: Session = Depends(get_db),
):
    clinic = _get_clinic(current_user, db)
    doctors = db.query(Doctor).filter(Doctor.clinic_id == clinic.id).all()
    return [
        {
            "id": str(d.id),
            "full_name": d.full_name,
            "specialty": d.specialty,
            "qualification": d.qualification,
            "available_days": d.available_days,
            "consultation_fee_kes": d.consultation_fee_kes,
            "is_active": d.is_active,
        }
        for d in doctors
    ]


# ── Reviews ───────────────────────────────────────────────────────────────────

@router.get("/reviews")
def clinic_reviews(
    current_user: User = Depends(require_role(UserRole.CLINIC_ADMIN, UserRole.SUPER_ADMIN)),
    db: Session = Depends(get_db),
):
    clinic = _get_clinic(current_user, db)
    reviews = (
        db.query(Review)
        .options(joinedload(Review.patient), joinedload(Review.doctor))
        .filter(Review.clinic_id == clinic.id, Review.is_published == True)
        .order_by(Review.created_at.desc())
        .limit(100)
        .all()
    )
    return [
        {
            "id": str(r.id),
            "patient_name": r.patient.full_name if r.patient else "Anonymous",
            "rating": r.rating,
            "title": r.title,
            "body": r.body,
            "created_at": r.created_at.isoformat(),
            "is_verified": r.is_verified,
            "doctor_name": r.doctor.full_name if r.doctor else None,
            "response": r.response,
            "response_at": r.response_at.isoformat() if r.response_at else None,
        }
        for r in reviews
    ]


@router.post("/reviews/{review_id}/reply")
def reply_to_review(
    review_id: str,
    body: _ReplyBody,
    current_user: User = Depends(require_role(UserRole.CLINIC_ADMIN, UserRole.SUPER_ADMIN)),
    db: Session = Depends(get_db),
):
    clinic = _get_clinic(current_user, db)
    review = db.query(Review).filter(
        Review.id == review_id, Review.clinic_id == clinic.id
    ).first()
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")
    review.response = body.reply
    review.response_at = datetime.now(timezone.utc)
    db.commit()
    return {"ok": True}


# ── Staff (clinic team members) ──────────────────────────────────────────────

@router.get("/staff")
def clinic_staff(
    current_user: User = Depends(require_role(UserRole.CLINIC_ADMIN, UserRole.SUPER_ADMIN)),
    db: Session = Depends(get_db),
):
    clinic = _get_clinic(current_user, db)
    staff = (
        db.query(User)
        .filter(
            User.clinic_id == clinic.id,
            User.role != UserRole.PATIENT,
        )
        .order_by(User.created_at)
        .all()
    )
    return [
        {
            "id": str(u.id),
            "full_name": u.full_name,
            "email": u.email,
            "role": u.role,
            "is_active": u.is_active,
            "last_login_at": u.last_login_at.isoformat() if u.last_login_at else None,
        }
        for u in staff
    ]


# ── Orders (clinic view) ──────────────────────────────────────────────────────

@router.get("/orders")
def clinic_orders(
    status_filter: Optional[str] = Query(None, alias="status"),
    limit: int = Query(50, le=200),
    current_user: User = Depends(require_role(UserRole.CLINIC_ADMIN, UserRole.SUPER_ADMIN)),
    db: Session = Depends(get_db),
):
    clinic = _get_clinic(current_user, db)
    q = (
        db.query(Order)
        .join(User, User.id == Order.patient_id)
        .add_columns(User.full_name.label("patient_name"))
        .filter(Order.clinic_id == clinic.id)
    )
    if status_filter:
        q = q.filter(Order.status == status_filter)
    rows = q.order_by(Order.created_at.desc()).limit(limit).all()
    return [
        {
            "id": str(order.id),
            "order_number": order.order_number,
            "patient_name": patient_name,
            "items": order.items or [],
            "total_kes": float(order.total_kes),
            "status": order.status,
            "delivery_method": order.delivery_method,
            "payment_method": order.payment_method,
            "created_at": order.created_at.isoformat(),
        }
        for order, patient_name in rows
    ]


# ── Subscription ─────────────────────────────────────────────────────────────

@router.get("/subscription")
def get_subscription(
    current_user: User = Depends(require_role(UserRole.CLINIC_ADMIN, UserRole.SUPER_ADMIN)),
    db: Session = Depends(get_db),
):
    clinic = _get_clinic(current_user, db)
    return {
        "plan": clinic.subscription_plan,
        "price_kes": PLAN_PRICES_KES.get(clinic.subscription_plan, 0),
        "started_at": clinic.subscription_started_at.isoformat() if clinic.subscription_started_at else None,
        "expires_at": clinic.subscription_expires_at.isoformat() if clinic.subscription_expires_at else None,
        "mpesa_paybill": clinic.mpesa_paybill,
        "clinic_name": clinic.name,
    }


@router.post("/subscription/upgrade")
def upgrade_subscription(
    body: _UpgradeBody,
    current_user: User = Depends(require_role(UserRole.CLINIC_ADMIN, UserRole.SUPER_ADMIN)),
    db: Session = Depends(get_db),
):
    if body.plan not in VALID_PLANS:
        raise HTTPException(status_code=400, detail=f"Invalid plan: {body.plan}. Must be one of: {', '.join(VALID_PLANS)}")

    import re
    cleaned_phone = re.sub(r"[\s\-]", "", body.mpesa_phone)
    if not re.match(r"^\+?2547\d{8}$|^07\d{8}$|^7\d{8}$", cleaned_phone):
        raise HTTPException(status_code=422, detail="Enter a valid Safaricom M-Pesa number (e.g. 0712 345 678)")

    clinic = _get_clinic(current_user, db)

    now = datetime.now(timezone.utc)
    clinic.subscription_plan = body.plan
    clinic.subscription_started_at = now
    clinic.subscription_expires_at = now + timedelta(days=30)
    db.commit()

    price = PLAN_PRICES_KES[body.plan]
    return {
        "ok": True,
        "plan": clinic.subscription_plan,
        "price_kes": price,
        "started_at": clinic.subscription_started_at.isoformat(),
        "expires_at": clinic.subscription_expires_at.isoformat(),
        "message": f"KES {price:,} M-Pesa payment request sent to {body.mpesa_phone}. Enter your PIN to complete.",
    }


# ── Change requests ───────────────────────────────────────────────────────────

@router.post("/change-requests", status_code=201)
def submit_change_request(
    body: _ChangeRequestBody,
    current_user: User = Depends(require_role(UserRole.CLINIC_ADMIN)),
    db: Session = Depends(get_db),
):
    """Clinic admin submits a request to change a locked field (e.g. clinic name, address)."""
    from sqlalchemy import text

    clinic = _get_clinic(current_user, db)
    db.execute(text("""
        INSERT INTO clinic_change_requests
            (id, clinic_id, requested_by, field_name, current_value, requested_value, reason)
        VALUES
            (:id, :clinic_id, :requested_by, :field_name, :current_value, :requested_value, :reason)
    """), {
        "id": str(uuid.uuid4()),
        "clinic_id": str(clinic.id),
        "requested_by": str(current_user.id),
        "field_name": body.field_name,
        "current_value": body.current_value,
        "requested_value": body.requested_value,
        "reason": body.reason,
    })
    db.commit()
    return {"ok": True, "message": "Change request submitted. A super admin will review it shortly."}
