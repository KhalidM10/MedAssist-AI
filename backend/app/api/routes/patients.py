from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_db
from app.models.user import User
from app.schemas.patient import PatientResponse, PatientUpdate

router = APIRouter()


def _patient_response(user: User) -> dict:
    return {
        "id": user.id,
        "user_id": user.id,
        "full_name": user.full_name,
        "date_of_birth": user.date_of_birth,
        "gender": user.gender,
        "blood_type": user.blood_type,
        "county": user.county,
        "emergency_contact_name": (user.emergency_contact or {}).get("name"),
        "emergency_contact_phone": (user.emergency_contact or {}).get("phone"),
        "allergies": user.allergies or [],
        "chronic_conditions": user.chronic_conditions or [],
        "medical_history": {},
        "created_at": user.created_at,
    }


@router.get("/me", response_model=PatientResponse)
def get_my_profile(
    current_user: User = Depends(get_current_user),
):
    return _patient_response(current_user)


@router.put("/me", response_model=PatientResponse)
def update_my_profile(
    data: PatientUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    updates = data.model_dump(exclude_none=True)

    if "full_name" in updates:
        current_user.full_name = updates["full_name"]
    if "date_of_birth" in updates:
        current_user.date_of_birth = updates["date_of_birth"]
    if "gender" in updates:
        current_user.gender = updates["gender"]
    if "blood_type" in updates:
        current_user.blood_type = updates["blood_type"]
    if "county" in updates:
        current_user.county = updates["county"]
    if "allergies" in updates:
        current_user.allergies = updates["allergies"]
    if "chronic_conditions" in updates:
        current_user.chronic_conditions = updates["chronic_conditions"]
    if "emergency_contact_name" in updates or "emergency_contact_phone" in updates:
        ec = current_user.emergency_contact or {}
        if "emergency_contact_name" in updates:
            ec["name"] = updates["emergency_contact_name"]
        if "emergency_contact_phone" in updates:
            ec["phone"] = updates["emergency_contact_phone"]
        current_user.emergency_contact = ec

    db.commit()
    db.refresh(current_user)
    return _patient_response(current_user)


@router.delete("/me", status_code=204)
def delete_my_account(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """GDPR-compliant self-deletion: anonymise PII, preserve FK integrity."""
    anonymised_email = f"deleted_{current_user.id}@medassist.deleted"
    current_user.full_name = "Deleted User"
    current_user.email = anonymised_email
    current_user.phone = None
    current_user.password_hash = ""
    current_user.date_of_birth = None
    current_user.gender = None
    current_user.county = None
    current_user.allergies = None
    current_user.chronic_conditions = None
    current_user.emergency_contact = None
    current_user.two_factor_secret = None
    current_user.two_factor_enabled = False
    current_user.is_active = False

    from app.models.review import Review
    db.query(Review).filter(Review.patient_id == current_user.id).update({"is_published": False})

    db.commit()
    return Response(status_code=204)
