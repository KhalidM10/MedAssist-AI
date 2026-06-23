import uuid
from datetime import date, datetime, time
from typing import Any, List, Optional

from pydantic import BaseModel, field_validator, model_validator

from app.models.appointment import AppointmentStatus


class AppointmentCreate(BaseModel):
    clinic_id: uuid.UUID
    doctor_id: Optional[uuid.UUID] = None
    appointment_date: date
    appointment_time: time
    reason: str
    amount_kes: Optional[float] = 0.0

    @field_validator("reason")
    @classmethod
    def reason_not_empty(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Reason for visit cannot be empty")
        if len(v) < 10:
            raise ValueError("Please describe your reason for the visit (at least 10 characters)")
        if len(v) > 1000:
            raise ValueError("Reason must be 1000 characters or less")
        return v


class AppointmentUpdate(BaseModel):
    appointment_date: Optional[date] = None
    appointment_time: Optional[time] = None
    doctor_id: Optional[uuid.UUID] = None
    status: Optional[AppointmentStatus] = None
    notes: Optional[str] = None
    payment_status: Optional[str] = None


class AppointmentResponse(BaseModel):
    id: uuid.UUID
    patient_id: uuid.UUID
    clinic_id: uuid.UUID
    doctor_id: Optional[uuid.UUID] = None
    appointment_date: date
    appointment_time: time
    status: AppointmentStatus
    reason: Optional[str] = None
    notes: Optional[str] = None
    payment_status: str
    amount_kes: float
    created_at: datetime
    booking_reference: str = ""
    clinic_name: Optional[str] = None
    doctor_name: Optional[str] = None

    @model_validator(mode="before")
    @classmethod
    def enrich_from_orm(cls, data: Any) -> Any:
        if isinstance(data, dict):
            return data
        cols = [
            "id", "patient_id", "clinic_id", "doctor_id",
            "appointment_date", "appointment_time", "status",
            "reason", "notes", "payment_status", "amount_kes", "created_at",
        ]
        d = {c: getattr(data, c, None) for c in cols}
        d["booking_reference"] = f"MA-{str(data.id).upper().replace('-', '')[:8]}"
        try:
            d["clinic_name"] = data.clinic.name if data.clinic else None
        except Exception:
            d["clinic_name"] = None
        try:
            d["doctor_name"] = data.doctor.full_name if data.doctor else None
        except Exception:
            d["doctor_name"] = None
        return d

    model_config = {"from_attributes": True}
