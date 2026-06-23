from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.config import get_settings
from app.core.deps import get_db
from app.models.appointment import Appointment, AppointmentStatus
from app.models.clinic import Clinic
from app.models.triage import TriageSession
from app.models.user import User, UserRole

router = APIRouter()


@router.get("/stats")
def platform_public_stats(db: Session = Depends(get_db)):
    """Public endpoint — returns aggregate platform counts for the landing page."""
    return {
        "total_clinics": db.query(func.count(Clinic.id)).filter(
            Clinic.approval_status == "approved", Clinic.is_active == True
        ).scalar() or 0,
        "total_triage_sessions": db.query(func.count(TriageSession.id)).scalar() or 0,
        "total_appointments": db.query(func.count(Appointment.id)).filter(
            Appointment.status == AppointmentStatus.COMPLETED
        ).scalar() or 0,
        "total_patients": db.query(func.count(User.id)).filter(
            User.role == UserRole.PATIENT,
            User.is_active == True,
        ).scalar() or 0,
    }


@router.get("/config")
def public_config():
    """Public configuration values the frontend needs (non-sensitive)."""
    s = get_settings()
    return {
        "delivery_fee_kes": int(s.delivery_fee_kes),
    }
