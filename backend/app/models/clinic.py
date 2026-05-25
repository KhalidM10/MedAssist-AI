import uuid
from datetime import datetime
from decimal import Decimal
from enum import Enum
from typing import TYPE_CHECKING, List, Optional

from sqlalchemy import (
    Boolean, CheckConstraint, DateTime, ForeignKey, Index,
    Integer, Numeric, String, Text, func,
)
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class SubscriptionPlan(str, Enum):
    BASIC = "basic"
    PRO = "pro"
    ENTERPRISE = "enterprise"


class ApprovalStatus(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    SUSPENDED = "suspended"

if TYPE_CHECKING:
    from app.models.user import User
    from app.models.doctor import Doctor
    from app.models.appointment import Appointment
    from app.models.product import Product
    from app.models.order import Order
    from app.models.review import Review
    from app.models.analytics import AnalyticsSnapshot
    from app.models.notification import Notification


class Clinic(Base):
    __tablename__ = "clinics"
    __table_args__ = (
        Index("ix_clinics_county", "county"),
        Index("ix_clinics_slug", "slug"),
        Index("ix_clinics_is_active", "is_active"),
        Index("ix_clinics_subscription_plan", "subscription_plan"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), unique=True, nullable=False, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    license_number: Mapped[Optional[str]] = mapped_column(String(100), unique=True)

    # Location
    address: Mapped[str] = mapped_column(Text, nullable=False)
    county: Mapped[str] = mapped_column(String(100), nullable=False)
    sub_county: Mapped[Optional[str]] = mapped_column(String(100))
    latitude: Mapped[Optional[Decimal]] = mapped_column(Numeric(9, 6))
    longitude: Mapped[Optional[Decimal]] = mapped_column(Numeric(9, 6))

    # Contact
    phone: Mapped[str] = mapped_column(String(20), nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    website: Mapped[Optional[str]] = mapped_column(String(255))

    # Profile
    description: Mapped[Optional[str]] = mapped_column(Text)
    logo_url: Mapped[Optional[str]] = mapped_column(Text)
    cover_image_url: Mapped[Optional[str]] = mapped_column(Text)
    specialties: Mapped[Optional[List[str]]] = mapped_column(ARRAY(Text), server_default="{}")
    operating_hours: Mapped[dict] = mapped_column(JSONB, nullable=False, server_default="{}")

    # Status
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Approval workflow
    approval_status: Mapped[str] = mapped_column(String(20), default="pending", nullable=False)
    approval_notes: Mapped[Optional[str]] = mapped_column(Text)
    approved_by: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    approved_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    submitted_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    registration_reference: Mapped[Optional[str]] = mapped_column(String(20), unique=True)
    documents: Mapped[list] = mapped_column(JSONB, nullable=False, server_default="[]")
    business_registration_number: Mapped[Optional[str]] = mapped_column(String(100))
    year_established: Mapped[Optional[int]] = mapped_column(Integer)

    # Subscription
    subscription_plan: Mapped[str] = mapped_column(
        String(50), default="basic", nullable=False
    )
    subscription_started_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    subscription_expires_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    stripe_customer_id: Mapped[Optional[str]] = mapped_column(String(255))
    mpesa_paybill: Mapped[Optional[str]] = mapped_column(String(20))
    settings: Mapped[dict] = mapped_column(JSONB, server_default="{}")

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relationships
    users: Mapped[List["User"]] = relationship("User", back_populates="clinic", foreign_keys="[User.clinic_id]")
    doctors: Mapped[List["Doctor"]] = relationship("Doctor", back_populates="clinic", cascade="all, delete-orphan")
    appointments: Mapped[List["Appointment"]] = relationship("Appointment", back_populates="clinic")
    products: Mapped[List["Product"]] = relationship("Product", back_populates="clinic", cascade="all, delete-orphan")
    orders: Mapped[List["Order"]] = relationship("Order", back_populates="clinic")
    reviews: Mapped[List["Review"]] = relationship("Review", back_populates="clinic")
    analytics_snapshots: Mapped[List["AnalyticsSnapshot"]] = relationship("AnalyticsSnapshot", back_populates="clinic", cascade="all, delete-orphan")
    notifications: Mapped[List["Notification"]] = relationship("Notification", back_populates="clinic")

    def __repr__(self) -> str:
        return f"<Clinic id={self.id} name={self.name!r}>"
