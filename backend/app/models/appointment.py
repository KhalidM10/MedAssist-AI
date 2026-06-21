import uuid
from datetime import date, datetime
from decimal import Decimal
from enum import Enum
from typing import TYPE_CHECKING, Optional

from sqlalchemy import (
    Boolean, CheckConstraint, Date, DateTime,
    ForeignKey, Index, Integer, Numeric, String, Text, func,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class AppointmentStatus(str, Enum):
    PENDING = "pending"
    CONFIRMED = "confirmed"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    NO_SHOW = "no_show"
    RESCHEDULED = "rescheduled"

if TYPE_CHECKING:
    from app.models.clinic import Clinic
    from app.models.user import User
    from app.models.doctor import Doctor
    from app.models.triage import TriageSession
    from app.models.review import Review


class Appointment(Base):
    __tablename__ = "appointments"
    __table_args__ = (
        CheckConstraint(
            "status IN ('pending','confirmed','in_progress','completed','cancelled','no_show','rescheduled')",
            name="ck_appointment_status",
        ),
        CheckConstraint(
            "payment_status IN ('pending','paid','refunded','waived')",
            name="ck_appointment_payment_status",
        ),
        Index("ix_appointments_clinic_id", "clinic_id"),
        Index("ix_appointments_patient_id", "patient_id"),
        Index("ix_appointments_doctor_id", "doctor_id"),
        Index("ix_appointments_appointment_date", "appointment_date"),
        Index("ix_appointments_status", "status"),
        Index("ix_appointments_created_at", "created_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    clinic_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("clinics.id"), nullable=False)
    patient_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    doctor_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("doctors.id"), nullable=True)
    triage_session_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("triage_sessions.id"), nullable=True)

    appointment_date: Mapped[date] = mapped_column(Date, nullable=False)
    appointment_time: Mapped[str] = mapped_column(String(8), nullable=False)  # "HH:MM:SS"
    duration_minutes: Mapped[int] = mapped_column(Integer, default=30, nullable=False)

    status: Mapped[str] = mapped_column(String(50), default="pending", nullable=False)
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    notes: Mapped[Optional[str]] = mapped_column(Text)
    doctor_notes: Mapped[Optional[str]] = mapped_column(Text)
    prescription: Mapped[Optional[dict]] = mapped_column(JSONB)
    follow_up_date: Mapped[Optional[date]] = mapped_column(Date)

    # Payment
    payment_status: Mapped[str] = mapped_column(String(50), default="pending", nullable=False)
    amount_kes: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 2))
    payment_method: Mapped[Optional[str]] = mapped_column(String(50))
    mpesa_transaction_id: Mapped[Optional[str]] = mapped_column(String(100))
    mpesa_receipt_number: Mapped[Optional[str]] = mapped_column(String(100))

    # Reminders
    reminder_sent_24h: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    reminder_sent_2h: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Cancellation
    cancelled_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    cancellation_reason: Mapped[Optional[str]] = mapped_column(Text)
    cancelled_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relationships
    clinic: Mapped["Clinic"] = relationship("Clinic", back_populates="appointments")
    patient: Mapped["User"] = relationship("User", foreign_keys=[patient_id], back_populates="appointments")
    doctor: Mapped["Doctor"] = relationship("Doctor", back_populates="appointments")
    triage_session: Mapped[Optional["TriageSession"]] = relationship("TriageSession", foreign_keys=[triage_session_id])
    cancelled_by_user: Mapped[Optional["User"]] = relationship("User", foreign_keys=[cancelled_by])
    review: Mapped[Optional["Review"]] = relationship("Review", back_populates="appointment", uselist=False)

    def __repr__(self) -> str:
        return f"<Appointment id={self.id} date={self.appointment_date} status={self.status!r}>"
