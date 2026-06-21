import asyncio
from datetime import date, datetime, timedelta
from typing import List, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session, joinedload

from app.core.deps import get_current_user, get_db
from app.models.appointment import Appointment, AppointmentStatus
from app.models.clinic import Clinic
from app.models.doctor import Doctor
from app.models.user import User
from app.schemas.appointment import AppointmentCreate, AppointmentResponse, AppointmentUpdate

router = APIRouter()


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

    time_str = data.appointment_time.strftime("%H:%M:%S")

    conflict = db.query(Appointment).filter(
        Appointment.clinic_id == data.clinic_id,
        Appointment.doctor_id == data.doctor_id,
        Appointment.appointment_date == data.appointment_date,
        Appointment.appointment_time == time_str,
        Appointment.status.notin_([AppointmentStatus.CANCELLED]),
    ).first()
    if conflict:
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
        appointment_time=time_str,
        reason=data.reason,
        amount_kes=data.amount_kes or 0.0,
    )
    db.add(appointment)
    db.commit()
    db.refresh(appointment)

    # ── Post-booking notifications ────────────────────────────────────────────
    background_tasks.add_task(
        _post_booking_notifications,
        appointment_id=str(appointment.id),
        patient=current_user,
        clinic=clinic,
        doctor=doctor,
        appt_date=str(data.appointment_date),
        appt_time=str(data.appointment_time)[:5],
    )

    return _fetch(db, str(appointment.id))


async def _post_booking_notifications(
    appointment_id: str,
    patient: User,
    clinic,
    doctor: Optional[Doctor],
    appt_date: str,
    appt_time: str,
) -> None:
    """Fire all post-booking side-effects without blocking the API response."""
    from app.database import SessionLocal
    from app.services.notification_service import notify, notify_clinic
    from app.services.sms import sms_appointment_confirmed
    from app.services.email import email_appointment_confirmed
    from app.tasks.sms_tasks import send_sms_task
    from app.tasks.email_tasks import send_email_task

    db = SessionLocal()
    try:
        # Re-fetch with the new session so we don't share the request session
        appt = db.query(Appointment).filter(Appointment.id == appointment_id).first()
        if not appt:
            return

        ref = _reference(appt.id)
        doctor_name = doctor.full_name if doctor else "the doctor"
        clinic_name = clinic.name if clinic else "the clinic"
        clinic_addr = clinic.address if clinic else ""
        clinic_phone = clinic.phone if clinic else ""

        # 1. In-app notification for patient
        sms_body = sms_appointment_confirmed(
            patient.full_name, doctor_name, clinic_name, appt_date, appt_time, ref
        )
        _, email_html = email_appointment_confirmed(
            patient_name=patient.full_name,
            doctor_name=doctor_name,
            clinic_name=clinic_name,
            clinic_address=clinic_addr,
            clinic_phone=clinic_phone,
            date=appt_date,
            time=appt_time,
            reference=ref,
            amount_kes=float(appt.amount_kes or 0),
            cancel_url=f"https://medassist.co.ke/appointments",
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

        # 2. Real-time clinic dashboard notification
        await notify_clinic(
            db,
            clinic_id=str(clinic.id),
            type="new_appointment",
            title="New Appointment",
            body=f"{patient.full_name} booked for {appt_date} at {appt_time}",
            data={
                "appointment_id": appointment_id,
                "patient_name": patient.full_name,
                "date": appt_date,
                "time": appt_time,
                "reference": ref,
            },
        )
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
    return _fetch(db, appointment_id)


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
    t = appt.appointment_time
    appt_time_obj = t if isinstance(t, time_type) else time_type.fromisoformat(str(t)[:8])
    appt_dt = datetime.combine(appt.appointment_date, appt_time_obj)
    if appt_dt - datetime.now() < timedelta(hours=2):
        raise HTTPException(
            status_code=400,
            detail="Appointments can only be cancelled at least 2 hours before the scheduled time.",
        )

    appt.status = AppointmentStatus.CANCELLED
    db.commit()
    db.refresh(appt)

    ref = _reference(appt.id)
    clinic_id = str(appt.clinic_id) if appt.clinic_id else None

    background_tasks.add_task(
        _post_cancel_notifications,
        appointment_id=appointment_id,
        patient=current_user,
        reference=ref,
        clinic_id=clinic_id,
        appt_date=str(appt.appointment_date),
        appt_time=str(appt.appointment_time)[:5],
    )

    return _fetch(db, str(appt.id))


async def _post_cancel_notifications(
    appointment_id: str, patient: User, reference: str,
    clinic_id: Optional[str], appt_date: str, appt_time: str,
) -> None:
    from app.database import SessionLocal
    from app.services.notification_service import notify, notify_clinic
    from app.services.sms import sms_appointment_cancelled

    db = SessionLocal()
    try:
        sms_body = sms_appointment_cancelled(patient.full_name, reference)
        await notify(
            db, patient,
            type="appointment_cancelled",
            title="Appointment Cancelled",
            body=f"Your appointment (Ref: {reference}) has been cancelled.",
            data={"appointment_id": appointment_id, "reference": reference},
            channels=["in_app", "sms"],
        )
        db.commit()

        if clinic_id:
            await notify_clinic(
                db,
                clinic_id=clinic_id,
                type="appointment_cancelled",
                title="Appointment Cancelled",
                body=f"Patient cancelled appointment on {appt_date} at {appt_time}",
                data={"appointment_id": appointment_id, "reference": reference},
            )
    finally:
        db.close()
