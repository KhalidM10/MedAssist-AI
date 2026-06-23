import asyncio
import logging
from datetime import date, datetime, timedelta, timezone
from typing import List, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, status
from pydantic import BaseModel, field_validator
from sqlalchemy.orm import Session, joinedload

from app.config import get_settings
from app.core.deps import get_current_user, get_db
from app.models.appointment import Appointment, AppointmentStatus
from app.models.clinic import Clinic
from app.models.doctor import Doctor
from app.models.review import Review
from app.models.user import User, UserRole
from app.schemas.appointment import AppointmentCreate, AppointmentResponse, AppointmentUpdate

logger = logging.getLogger(__name__)
router = APIRouter()

CLINIC_ROLES = {
    UserRole.CLINIC_ADMIN, UserRole.CLINIC_DOCTOR,
    UserRole.CLINIC_RECEPTIONIST, UserRole.CLINIC_PHARMACIST,
}


def _fetch(db: Session, appointment_id: str) -> Appointment:
    appt = (
        db.query(Appointment)
        .options(joinedload(Appointment.clinic), joinedload(Appointment.doctor))
        .filter(Appointment.id == appointment_id)
        .first()
    )
    if not appt:
        raise HTTPException(status_code=404, detail="Appointment not found")
    return appt


def _reference(appointment_id) -> str:
    return f"MA-{str(appointment_id).upper().replace('-', '')[:8]}"


@router.post("/", response_model=AppointmentResponse, status_code=status.HTTP_201_CREATED)
async def book_appointment(
    data: AppointmentCreate,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    clinic = db.query(Clinic).filter(
        Clinic.id == data.clinic_id, Clinic.is_active == True
    ).first()
    if not clinic:
        raise HTTPException(status_code=404, detail="Clinic not found")

    doctor: Optional[Doctor] = None
    if data.doctor_id:
        doctor = db.query(Doctor).filter(
            Doctor.id == data.doctor_id,
            Doctor.clinic_id == data.clinic_id,
            Doctor.is_active == True,
        ).first()
        if not doctor:
            raise HTTPException(status_code=404, detail="Doctor not found at this clinic")

    # Fix #9: conflict check scoped to doctor when specified, else any slot at the clinic
    conflict_q = db.query(Appointment).filter(
        Appointment.clinic_id == data.clinic_id,
        Appointment.appointment_date == data.appointment_date,
        Appointment.appointment_time == data.appointment_time,
        Appointment.status.notin_([AppointmentStatus.CANCELLED]),
    )
    if data.doctor_id:
        conflict_q = conflict_q.filter(Appointment.doctor_id == data.doctor_id)
    if conflict_q.first():
        raise HTTPException(
            status_code=409,
            detail="This slot was just booked. Please select a different time.",
        )

    appt_dt = datetime.combine(data.appointment_date, data.appointment_time)
    if appt_dt <= datetime.now():
        raise HTTPException(status_code=400, detail="Appointment must be in the future")

    appointment = Appointment(
        patient_id=current_user.id,
        clinic_id=data.clinic_id,
        doctor_id=data.doctor_id,
        appointment_date=data.appointment_date,
        appointment_time=data.appointment_time,
        reason=data.reason,
        amount_kes=data.amount_kes or 0.0,
    )
    db.add(appointment)
    db.commit()
    db.refresh(appointment)

    background_tasks.add_task(
        _post_booking_notifications,
        appointment_id=str(appointment.id),
        patient_id=str(current_user.id),
        patient_name=current_user.full_name,
        patient_email=current_user.email,
        patient_phone=current_user.phone,
        clinic_id=str(clinic.id),
        clinic_name=clinic.name,
        clinic_address=clinic.address or "",
        clinic_phone=clinic.phone,
        doctor_name=doctor.full_name if doctor else "the doctor",
        appt_date=str(data.appointment_date),
        appt_time=str(data.appointment_time)[:5],
    )

    return _fetch(db, str(appointment.id))


async def _post_booking_notifications(
    appointment_id: str,
    patient_id: str,
    patient_name: str,
    patient_email: str,
    patient_phone: Optional[str],
    clinic_id: str,
    clinic_name: str,
    clinic_address: str,
    clinic_phone: str,
    doctor_name: str,
    appt_date: str,
    appt_time: str,
) -> None:
    from app.database import SessionLocal
    from app.models.user import User as UserModel
    from app.services.notification_service import notify, notify_clinic
    from app.services.email import email_appointment_confirmed

    db = SessionLocal()
    try:
        appt = db.query(Appointment).filter(Appointment.id == appointment_id).first()
        if not appt:
            return

        patient = db.query(UserModel).filter(UserModel.id == patient_id).first()
        if not patient:
            return

        ref = _reference(appt.id)

        try:
            _, email_html = email_appointment_confirmed(
                patient_name=patient_name,
                doctor_name=doctor_name,
                clinic_name=clinic_name,
                clinic_address=clinic_address,
                clinic_phone=clinic_phone,
                date=appt_date,
                time=appt_time,
                reference=ref,
                amount_kes=float(appt.amount_kes or 0),
                cancel_url=f"{get_settings().app_base_url}/appointments",
            )
            await notify(
                db, patient,
                type="appointment_booked",
                title="Appointment Booked",
                body=f"Your appointment at {clinic_name} on {appt_date} at {appt_time} is pending confirmation.",
                data={
                    "appointment_id": appointment_id,
                    "reference": ref,
                    "email_subject": f"Appointment Booked — {appt_date} at {appt_time}",
                    "email_html": email_html,
                },
                channels=["in_app", "sms", "email"],
            )
            db.commit()
        except Exception:
            logger.exception("Failed to send patient booking notification for appointment %s", appointment_id)

        try:
            await notify_clinic(
                db,
                clinic_id=clinic_id,
                type="new_appointment",
                title="New Appointment",
                body=f"{patient_name} booked for {appt_date} at {appt_time}",
                data={
                    "appointment_id": appointment_id,
                    "patient_name": patient_name,
                    "date": appt_date,
                    "time": appt_time,
                    "reference": ref,
                },
            )
        except Exception:
            logger.exception("Failed to send clinic notification for appointment %s", appointment_id)
    finally:
        db.close()


@router.get("/my", response_model=List[AppointmentResponse])
def my_appointments(
    filter: Optional[str] = Query(None, description="upcoming | past | cancelled"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    q = (
        db.query(Appointment)
        .options(joinedload(Appointment.clinic), joinedload(Appointment.doctor))
        .filter(Appointment.patient_id == current_user.id)
    )
    today = date.today()
    if filter == "upcoming":
        q = q.filter(
            Appointment.appointment_date >= today,
            Appointment.status.in_([AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED]),
        )
    elif filter == "past":
        q = q.filter(
            Appointment.appointment_date < today,
            Appointment.status != AppointmentStatus.CANCELLED,
        )
    elif filter == "cancelled":
        q = q.filter(Appointment.status == AppointmentStatus.CANCELLED)
    return q.order_by(
        Appointment.appointment_date.desc(), Appointment.appointment_time.desc()
    ).all()


@router.get("/{appointment_id}", response_model=AppointmentResponse)
def get_appointment(
    appointment_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    appt = _fetch(db, appointment_id)
    # Fix #3: ownership check — patients can only see their own; clinic staff only their clinic's
    if current_user.role == UserRole.PATIENT:
        if str(appt.patient_id) != str(current_user.id):
            raise HTTPException(status_code=403, detail="Not your appointment")
    elif current_user.role in CLINIC_ROLES:
        if str(appt.clinic_id) != str(current_user.clinic_id):
            raise HTTPException(status_code=403, detail="Appointment not in your clinic")
    return appt


@router.patch("/{appointment_id}/cancel", response_model=AppointmentResponse)
async def cancel_appointment(
    appointment_id: str,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    appt = _fetch(db, appointment_id)
    if str(appt.patient_id) != str(current_user.id):
        raise HTTPException(status_code=403, detail="Not your appointment")
    if appt.status == AppointmentStatus.CANCELLED:
        raise HTTPException(status_code=400, detail="Already cancelled")
    if appt.status == AppointmentStatus.COMPLETED:
        raise HTTPException(status_code=400, detail="Cannot cancel a completed appointment")

    from datetime import time as time_type
    EAT = timezone(timedelta(hours=3))
    t = appt.appointment_time
    appt_time_obj = t if isinstance(t, time_type) else time_type.fromisoformat(str(t)[:8])
    appt_dt = datetime.combine(appt.appointment_date, appt_time_obj).replace(tzinfo=EAT)
    if appt_dt - datetime.now(EAT) < timedelta(hours=2):
        raise HTTPException(
            status_code=400,
            detail="Appointments can only be cancelled at least 2 hours before the scheduled time.",
        )

    appt.status = AppointmentStatus.CANCELLED
    db.commit()
    db.refresh(appt)

    ref = _reference(appt.id)
    cancel_clinic_id = str(appt.clinic_id) if appt.clinic_id else None

    background_tasks.add_task(
        _post_cancel_notifications,
        appointment_id=appointment_id,
        patient_id=str(current_user.id),
        reference=ref,
        clinic_id=cancel_clinic_id,
        appt_date=str(appt.appointment_date),
        appt_time=str(appt.appointment_time)[:5],
    )

    return _fetch(db, str(appt.id))


async def _post_cancel_notifications(
    appointment_id: str, patient_id: str, reference: str,
    clinic_id: Optional[str], appt_date: str, appt_time: str,
) -> None:
    from app.database import SessionLocal
    from app.models.user import User as UserModel
    from app.services.notification_service import notify, notify_clinic

    db = SessionLocal()
    try:
        patient = db.query(UserModel).filter(UserModel.id == patient_id).first()
        if patient:
            try:
                await notify(
                    db, patient,
                    type="appointment_cancelled",
                    title="Appointment Cancelled",
                    body=f"Your appointment (Ref: {reference}) has been cancelled.",
                    data={"appointment_id": appointment_id, "reference": reference},
                    channels=["in_app", "sms"],
                )
                db.commit()
            except Exception:
                logger.exception("Failed to send cancellation notification for appointment %s", appointment_id)

        if clinic_id:
            try:
                await notify_clinic(
                    db,
                    clinic_id=clinic_id,
                    type="appointment_cancelled",
                    title="Appointment Cancelled",
                    body=f"Patient cancelled appointment on {appt_date} at {appt_time}",
                    data={"appointment_id": appointment_id, "reference": reference},
                )
            except Exception:
                logger.exception("Failed to send clinic cancellation notification for appointment %s", appointment_id)
    finally:
        db.close()


# ── Review submission ─────────────────────────────────────────────────────────

class ReviewCreate(BaseModel):
    rating: int
    title: Optional[str] = None
    body: Optional[str] = None

    @field_validator("rating")
    @classmethod
    def validate_rating(cls, v: int) -> int:
        if not 1 <= v <= 5:
            raise ValueError("Rating must be between 1 and 5")
        return v

    @field_validator("title")
    @classmethod
    def validate_title(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and len(v.strip()) > 120:
            raise ValueError("Title must be 120 characters or less")
        return v.strip() if v else v

    @field_validator("body")
    @classmethod
    def validate_body(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and len(v.strip()) > 2000:
            raise ValueError("Review body must be 2000 characters or less")
        return v.strip() if v else v


@router.post("/{appointment_id}/review", status_code=201)
def submit_review(
    appointment_id: str,
    data: ReviewCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    appt = _fetch(db, appointment_id)
    if str(appt.patient_id) != str(current_user.id):
        raise HTTPException(status_code=403, detail="Not your appointment")
    if appt.status != AppointmentStatus.COMPLETED:
        raise HTTPException(status_code=400, detail="You can only review a completed appointment")

    cutoff = date.today() - timedelta(days=90)
    if appt.appointment_date < cutoff:
        raise HTTPException(status_code=400, detail="Reviews can only be submitted within 90 days of the appointment")

    existing = db.query(Review).filter(Review.appointment_id == appt.id).first()
    if existing:
        raise HTTPException(status_code=409, detail="You have already reviewed this appointment")

    review = Review(
        clinic_id=appt.clinic_id,
        patient_id=current_user.id,
        doctor_id=appt.doctor_id,
        appointment_id=appt.id,
        rating=data.rating,
        title=data.title,
        body=data.body,
        is_verified=True,
        is_published=True,
    )
    db.add(review)
    db.commit()
    db.refresh(review)

    # Issue #27: notify clinic staff of new review
    if appt.clinic_id:
        asyncio.ensure_future(_notify_new_review(
            clinic_id=str(appt.clinic_id),
            patient_name=current_user.full_name,
            rating=data.rating,
            review_id=str(review.id),
        ))

    return {
        "id": str(review.id),
        "rating": review.rating,
        "title": review.title,
        "body": review.body,
        "created_at": review.created_at.isoformat(),
    }


async def _notify_new_review(
    clinic_id: str, patient_name: str, rating: int, review_id: str,
) -> None:
    from app.database import SessionLocal
    from app.services.notification_service import notify_clinic

    db = SessionLocal()
    try:
        stars = "★" * rating + "☆" * (5 - rating)
        await notify_clinic(
            db,
            clinic_id=clinic_id,
            type="new_review",
            title="New Patient Review",
            body=f"{patient_name} left a {rating}-star review {stars}",
            data={"review_id": review_id, "patient_name": patient_name, "rating": rating},
        )
        db.commit()
    except Exception:
        logger.exception("Failed to send new review notification for clinic %s", clinic_id)
    finally:
        db.close()
