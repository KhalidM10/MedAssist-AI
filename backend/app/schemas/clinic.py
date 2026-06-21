import math
import uuid
from datetime import date, datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, EmailStr


class NextAvailableSlot(BaseModel):
    doctor_name: str
    date: str   # "2026-05-24"
    time: str   # "14:00"


class DoctorResponse(BaseModel):
    id: uuid.UUID
    clinic_id: uuid.UUID
    full_name: str
    specialty: str
    sub_specialty: Optional[str] = None
    qualification: Optional[str] = None
    license_number: Optional[str] = None
    bio: Optional[str] = None
    photo_url: Optional[str] = None
    consultation_fee_kes: float
    available_days: List[int]          # 0=Mon … 6=Sun (Python weekday())
    slot_duration_minutes: int
    rating: float
    total_reviews: int
    is_active: bool
    next_available: Optional[NextAvailableSlot] = None

    model_config = {"from_attributes": True}


class ReviewResponse(BaseModel):
    id: uuid.UUID
    patient_name: str
    rating: int
    title: Optional[str] = None
    body: Optional[str] = None
    created_at: datetime
    is_verified: bool
    doctor_name: Optional[str] = None
    response: Optional[str] = None
    response_at: Optional[datetime] = None


class ClinicCardResponse(BaseModel):
    id: uuid.UUID
    slug: str
    name: str
    address: str
    county: str
    phone: str
    email: Optional[str] = None
    logo_url: Optional[str] = None
    cover_image_url: Optional[str] = None
    is_verified: bool
    specialties: List[str] = []
    operating_hours: Dict[str, Any] = {}
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    distance_km: Optional[float] = None
    next_available: Optional[str] = None          # human string: "Today", "Tomorrow", "Mon 26 May"
    next_available_slot: Optional[NextAvailableSlot] = None
    rating: float = 0.0
    total_reviews: int = 0
    doctors_count: int = 0
    is_open_now: bool = False

    model_config = {"from_attributes": True}


class PaginatedClinicsResponse(BaseModel):
    clinics: List[ClinicCardResponse]
    total: int
    page: int
    total_pages: int


class FiltersResponse(BaseModel):
    counties: List[str]
    specialties: List[str]


class ClinicDetailResponse(BaseModel):
    id: uuid.UUID
    slug: str
    name: str
    address: str
    county: str
    phone: str
    email: Optional[str] = None
    website: Optional[str] = None
    logo_url: Optional[str] = None
    cover_image_url: Optional[str] = None
    description: Optional[str] = None
    is_verified: bool
    specialties: List[str] = []
    operating_hours: Dict[str, Any] = {}
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    is_open_now: bool = False
    rating: float = 0.0
    total_reviews: int = 0
    rating_breakdown: Dict[int, int] = {}         # {5: 60, 4: 25, ...} percentages
    subscription_plan: str
    license_number: Optional[str] = None
    doctors: List[DoctorResponse] = []
    reviews: List[ReviewResponse] = []
    doctors_count: int = 0

    model_config = {"from_attributes": True}


class TimeSlot(BaseModel):
    time: str           # "09:00"
    is_available: bool


class DaySlotsResponse(BaseModel):
    date: date
    slots: List[TimeSlot]


class AvailabilityResponse(BaseModel):
    available_dates: List[str]          # ["2026-05-24", "2026-05-25", ...]


# ── Write schemas ─────────────────────────────────────────────────────────────

class ClinicCreate(BaseModel):
    name: str
    address: str
    county: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    phone: str
    email: Optional[EmailStr] = None
    license_number: Optional[str] = None
    operating_hours: Optional[Dict[str, Any]] = {}
    specialties: Optional[List[str]] = []


class ClinicUpdate(BaseModel):
    name: Optional[str] = None
    address: Optional[str] = None
    county: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    phone: Optional[str] = None
    email: Optional[EmailStr] = None
    license_number: Optional[str] = None
    operating_hours: Optional[Dict[str, Any]] = None
    specialties: Optional[List[str]] = None


class DoctorCreate(BaseModel):
    full_name: str
    specialty: str
    qualification: Optional[str] = None
    bio: Optional[str] = None
    available_days: Optional[List[int]] = []
    consultation_fee_kes: Optional[float] = 1500.0
    photo_url: Optional[str] = None
