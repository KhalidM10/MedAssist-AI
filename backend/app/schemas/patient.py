import re
import uuid
from datetime import date, datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, field_validator

_PHONE_RE = re.compile(r"^\+?[0-9\s\-]{7,20}$")
_VALID_BLOOD_TYPES = {"A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-", "Unknown"}
_VALID_GENDERS = {"male", "female", "other", "prefer_not_to_say"}


class PatientBase(BaseModel):
    full_name: str
    date_of_birth: Optional[date] = None
    gender: Optional[str] = None
    blood_type: Optional[str] = None
    county: Optional[str] = None
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None
    allergies: Optional[List[str]] = []
    chronic_conditions: Optional[List[str]] = []


class PatientCreate(PatientBase):
    pass


class PatientUpdate(BaseModel):
    full_name: Optional[str] = None
    date_of_birth: Optional[date] = None
    gender: Optional[str] = None
    blood_type: Optional[str] = None
    county: Optional[str] = None
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None
    allergies: Optional[List[str]] = None
    chronic_conditions: Optional[List[str]] = None

    @field_validator("emergency_contact_phone")
    @classmethod
    def validate_phone(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and not _PHONE_RE.match(v):
            raise ValueError("Invalid phone number format")
        return v

    @field_validator("blood_type")
    @classmethod
    def validate_blood_type(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in _VALID_BLOOD_TYPES:
            raise ValueError(f"Invalid blood type. Must be one of: {', '.join(sorted(_VALID_BLOOD_TYPES))}")
        return v

    @field_validator("gender")
    @classmethod
    def validate_gender(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in _VALID_GENDERS:
            raise ValueError(f"Invalid gender. Must be one of: {', '.join(sorted(_VALID_GENDERS))}")
        return v


class PatientResponse(PatientBase):
    id: uuid.UUID
    user_id: uuid.UUID
    medical_history: Dict[str, Any]
    created_at: datetime

    model_config = {"from_attributes": True}
