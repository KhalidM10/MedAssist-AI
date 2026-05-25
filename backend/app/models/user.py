import uuid
from datetime import date, datetime
from typing import TYPE_CHECKING, List, Optional

from sqlalchemy import (
    Boolean, CheckConstraint, Date, DateTime,
    ForeignKey, Index, Integer, String, Text, func,
)
from sqlalchemy.dialects.postgresql import ARRAY, INET, JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from app.models.clinic import Clinic
    from app.models.appointment import Appointment
    from app.models.triage import TriageSession
    from app.models.order import Order
    from app.models.review import Review
    from app.models.notification import Notification
    from app.models.audit import UserSession, AuditLog


VALID_ROLES = (
    "super_admin", "clinic_admin", "clinic_doctor",
    "clinic_receptionist", "clinic_pharmacist", "patient",
)


class UserRole:
    SUPER_ADMIN = "super_admin"
    CLINIC_ADMIN = "clinic_admin"
    CLINIC_DOCTOR = "clinic_doctor"
    CLINIC_RECEPTIONIST = "clinic_receptionist"
    CLINIC_PHARMACIST = "clinic_pharmacist"
    PATIENT = "patient"


class User(Base):
    __tablename__ = "users"
    __table_args__ = (
        CheckConstraint(f"role IN {VALID_ROLES}", name="ck_users_role"),
        Index("ix_users_email", "email"),
        Index("ix_users_phone", "phone"),
        Index("ix_users_role", "role"),
        Index("ix_users_clinic_id", "clinic_id"),
        Index("ix_users_is_active", "is_active"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    clinic_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("clinics.id", ondelete="SET NULL"), nullable=True)

    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    phone: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(Text, nullable=False)
    role: Mapped[str] = mapped_column(String(50), nullable=False)

    # Profile
    avatar_url: Mapped[Optional[str]] = mapped_column(Text)
    county: Mapped[Optional[str]] = mapped_column(String(100))
    date_of_birth: Mapped[Optional[date]] = mapped_column(Date)
    gender: Mapped[Optional[str]] = mapped_column(String(20))
    blood_type: Mapped[Optional[str]] = mapped_column(String(5))
    allergies: Mapped[Optional[List[str]]] = mapped_column(ARRAY(Text))
    emergency_contact: Mapped[Optional[dict]] = mapped_column(JSONB)

    # Status
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_email_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_phone_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_clinic_approved: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Moderation
    warning_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    suspension_reason: Mapped[Optional[str]] = mapped_column(Text)
    suspension_until: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    ban_reason: Mapped[Optional[str]] = mapped_column(Text)
    banned_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))

    # Login tracking
    last_login_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    last_login_ip: Mapped[Optional[str]] = mapped_column(INET)
    failed_login_attempts: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    locked_until: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))

    # 2FA
    two_factor_enabled: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    two_factor_secret: Mapped[Optional[str]] = mapped_column(Text)

    # Token fields
    password_reset_token: Mapped[Optional[str]] = mapped_column(Text)
    password_reset_expires: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    email_verify_token: Mapped[Optional[str]] = mapped_column(Text)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relationships
    clinic: Mapped[Optional["Clinic"]] = relationship("Clinic", back_populates="users", foreign_keys=[clinic_id])
    appointments: Mapped[List["Appointment"]] = relationship("Appointment", foreign_keys="Appointment.patient_id", back_populates="patient")
    triage_sessions: Mapped[List["TriageSession"]] = relationship("TriageSession", back_populates="user")
    orders: Mapped[List["Order"]] = relationship("Order", back_populates="patient")
    reviews: Mapped[List["Review"]] = relationship("Review", foreign_keys="Review.patient_id", back_populates="patient")
    notifications: Mapped[List["Notification"]] = relationship("Notification", back_populates="user")
    sessions: Mapped[List["UserSession"]] = relationship("UserSession", back_populates="user", cascade="all, delete-orphan")
    audit_logs: Mapped[List["AuditLog"]] = relationship("AuditLog", foreign_keys="AuditLog.user_id", back_populates="user")

    def __repr__(self) -> str:
        return f"<User id={self.id} email={self.email!r} role={self.role!r}>"
