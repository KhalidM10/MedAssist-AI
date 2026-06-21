"""
Appointment booking service — business logic layer.
Handles availability checking, conflict detection, and slot generation.
Phase 2: integrate calendar sync and SMS reminders.
"""
from datetime import datetime, timedelta
from typing import List, Optional

from sqlalchemy.orm import Session

from app.models.appointment import Appointment, AppointmentStatus


def is_slot_available(
    db: Session,
    clinic_id: str,
    doctor_id: Optional[str],
    scheduled_at: datetime,
    duration_minutes: int = 30,
) -> bool:
    slot_date = scheduled_at.date()
    start_str = scheduled_at.strftime("%H:%M:%S")
    end_str = (scheduled_at + timedelta(minutes=duration_minutes)).strftime("%H:%M:%S")
    conflict = (
        db.query(Appointment)
        .filter(
            Appointment.clinic_id == clinic_id,
            Appointment.doctor_id == doctor_id,
            Appointment.status.notin_([AppointmentStatus.CANCELLED]),
            Appointment.appointment_date == slot_date,
            Appointment.appointment_time >= start_str,
            Appointment.appointment_time < end_str,
        )
        .first()
    )
    return conflict is None


def get_available_slots(
    db: Session,
    clinic_id: str,
    doctor_id: Optional[str],
    for_date: datetime,
    slot_minutes: int = 30,
) -> List[datetime]:
    """Return available slot start times for a given day (08:00–17:00 EAT)."""
    slots: List[datetime] = []
    current = for_date.replace(hour=8, minute=0, second=0, microsecond=0)
    end = for_date.replace(hour=17, minute=0, second=0, microsecond=0)
    while current < end:
        if is_slot_available(db, clinic_id, doctor_id, current, slot_minutes):
            slots.append(current)
        current += timedelta(minutes=slot_minutes)
    return slots
