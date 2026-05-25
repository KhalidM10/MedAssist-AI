import calendar as cal
import math
import re
import secrets
import uuid
from datetime import date, datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, EmailStr
from sqlalchemy import func, text
from sqlalchemy.orm import Session, joinedload

from app.core.deps import get_current_user, get_db, require_role
from app.core.security import hash_password
from app.models.appointment import Appointment, AppointmentStatus
from app.models.clinic import Clinic
from app.models.doctor import Doctor
from app.models.review import Review
from app.models.user import User, UserRole
from app.schemas.clinic import (
    AvailabilityResponse,
    ClinicCardResponse,
    ClinicCreate,
    ClinicDetailResponse,
    ClinicUpdate,
    DaySlotsResponse,
    DoctorCreate,
    DoctorResponse,
    FiltersResponse,
    NextAvailableSlot,
    PaginatedClinicsResponse,
    ReviewResponse,
    TimeSlot,
)

router = APIRouter()

_APPROVED = "approved"


# ── Registration schemas ──────────────────────────────────────────────────────

class AdminAccountData(BaseModel):
    full_name: str
    email: EmailStr
    phone: str
    password: str


class ClinicRegData(BaseModel):
    name: str
    county: str
    sub_county: Optional[str] = None
    address: str
    license_number: str
    business_registration_number: Optional[str] = None
    year_established: Optional[int] = None
    phone: str
    email: EmailStr
    website: Optional[str] = None
    description: Optional[str] = None
    specialties: List[str] = []
    operating_hours: Dict[str, Any] = {}


class DocumentInfo(BaseModel):
    type: str       # medical_license | business_registration | kra_pin
    filename: str


class ClinicRegistrationBody(BaseModel):
    admin: AdminAccountData
    clinic: ClinicRegData
    documents: List[DocumentInfo] = []


def _slug(name: str) -> str:
    base = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    return f"{base}-{uuid.uuid4().hex[:6]}"


def _gen_ref() -> str:
    return "CR-" + secrets.token_hex(4).upper()


# ── Helpers ───────────────────────────────────────────────────────────────────

def _is_open_now(operating_hours: dict) -> bool:
    now = datetime.now()
    day_name = now.strftime("%A").lower()
    hours = (operating_hours or {}).get(day_name)
    if not hours:
        return False
    try:
        oh, om = map(int, hours["open"].split(":"))
        ch, cm = map(int, hours["close"].split(":"))
        open_t = now.replace(hour=oh, minute=om, second=0, microsecond=0)
        close_t = now.replace(hour=ch, minute=cm, second=0, microsecond=0)
        return open_t <= now < close_t
    except Exception:
        return False


def _next_available_label(clinic: Clinic, active_doctors: list) -> Optional[str]:
    """Heuristic: no DB queries — checks schedule only."""
    if not active_doctors:
        return None
    today = date.today()
    for days_ahead in range(14):
        check_date = today + timedelta(days=days_ahead)
        day_name = check_date.strftime("%A").lower()
        if day_name not in (clinic.operating_hours or {}):
            continue
        dow = check_date.weekday()      # 0=Mon, 6=Sun
        for doc in active_doctors:
            if dow in (doc.available_days or []):
                if days_ahead == 0:
                    return "Today"
                if days_ahead == 1:
                    return "Tomorrow"
                return check_date.strftime("%a %d %b")
    return None


def _compute_doctor_next_available(
    doc: Doctor, clinic: Clinic, db: Session
) -> Optional[NextAvailableSlot]:
    today = date.today()
    to_date = today + timedelta(days=14)

    rows = db.query(
        Appointment.appointment_date,
        Appointment.appointment_time,
    ).filter(
        Appointment.clinic_id == clinic.id,
        Appointment.doctor_id == doc.id,
        Appointment.appointment_date >= today,
        Appointment.appointment_date <= to_date,
        Appointment.status.notin_([AppointmentStatus.CANCELLED]),
    ).all()

    booked_map: dict = {}
    for row in rows:
        d = row.appointment_date
        t_raw = row.appointment_time
        t = t_raw.strftime("%H:%M") if hasattr(t_raw, "strftime") else str(t_raw)[:5]
        booked_map.setdefault(d, set()).add(t)

    for days_ahead in range(14):
        check_date = today + timedelta(days=days_ahead)
        day_name = check_date.strftime("%A").lower()
        dow = check_date.weekday()

        if dow not in (doc.available_days or []):
            continue
        hours = (clinic.operating_hours or {}).get(day_name)
        if not hours:
            continue

        try:
            oh, om = map(int, hours["open"].split(":"))
            ch, cm = map(int, hours["close"].split(":"))
        except Exception:
            continue

        booked_times = booked_map.get(check_date, set())
        current = datetime(check_date.year, check_date.month, check_date.day, oh, om)
        end = datetime(check_date.year, check_date.month, check_date.day, ch, cm)
        while current < end:
            t = current.strftime("%H:%M")
            if t not in booked_times:
                return NextAvailableSlot(
                    doctor_name=doc.full_name,
                    date=str(check_date),
                    time=t,
                )
            current += timedelta(minutes=doc.slot_duration_minutes or 30)
    return None


def _haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    R = 6371.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlam = math.radians(lng2 - lng1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlam / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def _lookup_clinic(slug_or_id: str, db: Session, approved_only: bool = True) -> Clinic:
    try:
        uid = uuid.UUID(slug_or_id)
        q = db.query(Clinic).filter(Clinic.id == uid)
    except ValueError:
        q = db.query(Clinic).filter(Clinic.slug == slug_or_id)
    if approved_only:
        q = q.filter(Clinic.approval_status == _APPROVED, Clinic.is_active == True)
    clinic = q.first()
    if not clinic:
        raise HTTPException(status_code=404, detail="Clinic not found")
    return clinic


# ── Routes ────────────────────────────────────────────────────────────────────

@router.post("/register", status_code=201)
def register_clinic(body: ClinicRegistrationBody, db: Session = Depends(get_db)):
    """Public endpoint — creates clinic + admin user in pending/inactive state."""
    if len(body.admin.password) < 8:
        raise HTTPException(400, "Password must be at least 8 characters")
    if db.query(User).filter(User.email == body.admin.email).first():
        raise HTTPException(409, "An account with that email already exists")
    if db.query(User).filter(User.phone == body.admin.phone).first():
        raise HTTPException(409, "An account with that phone number already exists")
    if db.query(Clinic).filter(Clinic.email == str(body.clinic.email)).first():
        raise HTTPException(409, "A clinic with that email already exists")

    # Unique registration reference
    ref = _gen_ref()
    while db.query(Clinic).filter(Clinic.registration_reference == ref).first():
        ref = _gen_ref()

    # Create admin user — inactive until approved
    admin_user = User(
        full_name=body.admin.full_name,
        email=str(body.admin.email),
        phone=body.admin.phone,
        password_hash=hash_password(body.admin.password),
        role=UserRole.CLINIC_ADMIN,
        is_active=False,
        is_email_verified=False,
        is_clinic_approved=False,
    )
    db.add(admin_user)
    db.flush()

    # Build operating_hours (remove 'closed' helper key if present)
    op_hours: Dict[str, Any] = {}
    for day, val in (body.clinic.operating_hours or {}).items():
        if isinstance(val, dict) and not val.get("closed", False):
            op_hours[day] = {"open": val.get("open", "08:00"), "close": val.get("close", "17:00")}

    # Create clinic — pending approval
    clinic = Clinic(
        name=body.clinic.name,
        slug=_slug(body.clinic.name),
        county=body.clinic.county,
        sub_county=body.clinic.sub_county,
        address=body.clinic.address,
        phone=body.clinic.phone,
        email=str(body.clinic.email),
        website=body.clinic.website or None,
        description=body.clinic.description or None,
        license_number=body.clinic.license_number,
        business_registration_number=body.clinic.business_registration_number or None,
        year_established=body.clinic.year_established,
        specialties=body.clinic.specialties or [],
        operating_hours=op_hours,
        is_verified=False,
        is_active=False,
        approval_status="pending",
        submitted_at=datetime.now(timezone.utc),
        registration_reference=ref,
        documents=[
            {"type": d.type, "filename": d.filename, "uploaded_at": datetime.now(timezone.utc).isoformat()}
            for d in body.documents
        ],
    )
    db.add(clinic)
    db.flush()

    admin_user.clinic_id = clinic.id
    db.commit()

    return {
        "registration_reference": ref,
        "clinic_name": clinic.name,
        "admin_email": str(body.admin.email),
    }


@router.get("/", response_model=PaginatedClinicsResponse)
def list_clinics(
    county: Optional[str] = Query(None),
    specialty: Optional[str] = Query(None),
    available_today: bool = Query(False),
    search: Optional[str] = Query(None),
    lat: Optional[float] = Query(None),
    lng: Optional[float] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(12, le=50),
    db: Session = Depends(get_db),
):
    q = db.query(Clinic).filter(Clinic.approval_status == _APPROVED, Clinic.is_active == True)
    if county:
        q = q.filter(Clinic.county.ilike(f"%{county}%"))
    if specialty:
        q = q.filter(Clinic.specialties.contains([specialty]))
    if available_today:
        today_name = datetime.now().strftime("%A").lower()
        q = q.filter(Clinic.operating_hours[today_name].isnot(None))
    if search:
        q = q.filter(
            Clinic.name.ilike(f"%{search}%")
            | Clinic.address.ilike(f"%{search}%")
            | Clinic.county.ilike(f"%{search}%")
        )

    total = q.count()
    clinics = q.order_by(Clinic.name).offset((page - 1) * limit).limit(limit).all()

    if not clinics:
        return PaginatedClinicsResponse(clinics=[], total=total, page=page, total_pages=0)

    clinic_ids = [c.id for c in clinics]

    # Batch: ratings
    rating_rows = (
        db.query(
            Review.clinic_id,
            func.avg(Review.rating).label("avg_r"),
            func.count(Review.id).label("cnt"),
        )
        .filter(Review.clinic_id.in_(clinic_ids), Review.is_published == True)
        .group_by(Review.clinic_id)
        .all()
    )
    rating_map = {str(r.clinic_id): (round(float(r.avg_r), 1), r.cnt) for r in rating_rows}

    # Batch: doctor counts + active doctors (for next_available heuristic)
    all_docs = (
        db.query(Doctor)
        .filter(Doctor.clinic_id.in_(clinic_ids), Doctor.is_active == True)
        .all()
    )
    docs_by_clinic: dict = {}
    for d in all_docs:
        docs_by_clinic.setdefault(str(d.clinic_id), []).append(d)

    result = []
    for clinic in clinics:
        cid = str(clinic.id)
        rating, total_reviews = rating_map.get(cid, (0.0, 0))
        active_docs = docs_by_clinic.get(cid, [])

        dist_km = None
        if lat is not None and lng is not None and clinic.latitude and clinic.longitude:
            dist_km = round(_haversine_km(lat, lng, float(clinic.latitude), float(clinic.longitude)), 1)

        result.append(ClinicCardResponse(
            id=clinic.id,
            slug=clinic.slug,
            name=clinic.name,
            address=clinic.address,
            county=clinic.county,
            phone=clinic.phone,
            email=clinic.email,
            logo_url=clinic.logo_url,
            cover_image_url=clinic.cover_image_url,
            is_verified=clinic.is_verified,
            specialties=clinic.specialties or [],
            operating_hours=clinic.operating_hours or {},
            latitude=float(clinic.latitude) if clinic.latitude else None,
            longitude=float(clinic.longitude) if clinic.longitude else None,
            distance_km=dist_km,
            next_available=_next_available_label(clinic, active_docs),
            rating=rating,
            total_reviews=total_reviews,
            doctors_count=len(active_docs),
            is_open_now=_is_open_now(clinic.operating_hours),
        ))

    if lat is not None and lng is not None:
        result.sort(key=lambda x: x.distance_km if x.distance_km is not None else 9999)

    return PaginatedClinicsResponse(
        clinics=result,
        total=total,
        page=page,
        total_pages=math.ceil(total / limit) if total > 0 else 0,
    )


@router.get("/filters", response_model=FiltersResponse)
def get_filters(db: Session = Depends(get_db)):
    counties = [
        r[0]
        for r in db.query(func.distinct(Clinic.county))
        .filter(Clinic.approval_status == _APPROVED, Clinic.is_active == True)
        .order_by(Clinic.county)
        .all()
        if r[0]
    ]
    rows = db.execute(
        text("SELECT DISTINCT unnest(specialties) AS s FROM clinics WHERE approval_status = 'approved' AND is_active = true ORDER BY s")
    ).fetchall()
    specialties = [r[0] for r in rows if r[0]]
    return FiltersResponse(counties=counties, specialties=specialties)


@router.post("/", status_code=201)
def create_clinic(
    data: ClinicCreate,
    current_user: User = Depends(require_role(UserRole.CLINIC_ADMIN, UserRole.SUPER_ADMIN)),
    db: Session = Depends(get_db),
):
    clinic = Clinic(**data.model_dump())
    db.add(clinic)
    db.commit()
    db.refresh(clinic)
    return {"id": str(clinic.id), "slug": clinic.slug, "name": clinic.name}


@router.get("/{slug_or_id}", response_model=ClinicDetailResponse)
def get_clinic(slug_or_id: str, db: Session = Depends(get_db)):
    clinic = _lookup_clinic(slug_or_id, db)

    # Reviews (published, latest 20)
    review_rows = (
        db.query(Review)
        .filter(Review.clinic_id == clinic.id, Review.is_published == True)
        .order_by(Review.created_at.desc())
        .limit(20)
        .all()
    )
    total_reviews = len(review_rows)
    avg_rating = (
        round(sum(r.rating for r in review_rows) / total_reviews, 1)
        if total_reviews else 0.0
    )

    rating_breakdown = {
        star: (round(sum(1 for r in review_rows if r.rating == star) / total_reviews * 100)
               if total_reviews else 0)
        for star in range(1, 6)
    }

    patient_ids = list({str(r.patient_id) for r in review_rows})
    doctor_ids = list({str(r.doctor_id) for r in review_rows if r.doctor_id})
    patient_names = (
        {str(u.id): u.full_name
         for u in db.query(User.id, User.full_name).filter(User.id.in_(patient_ids)).all()}
        if patient_ids else {}
    )
    doctor_names = (
        {str(d.id): d.full_name
         for d in db.query(Doctor.id, Doctor.full_name).filter(Doctor.id.in_(doctor_ids)).all()}
        if doctor_ids else {}
    )

    reviews_out = [
        ReviewResponse(
            id=r.id,
            patient_name=patient_names.get(str(r.patient_id), "Anonymous"),
            rating=r.rating,
            title=r.title,
            body=r.body,
            created_at=r.created_at,
            is_verified=r.is_verified,
            doctor_name=doctor_names.get(str(r.doctor_id)) if r.doctor_id else None,
            response=r.response,
            response_at=r.response_at,
        )
        for r in review_rows
    ]

    # Doctors with next available
    active_doctors = (
        db.query(Doctor)
        .filter(Doctor.clinic_id == clinic.id, Doctor.is_active == True)
        .all()
    )
    doctors_out = [
        DoctorResponse(
            id=doc.id,
            clinic_id=doc.clinic_id,
            full_name=doc.full_name,
            specialty=doc.specialty,
            sub_specialty=doc.sub_specialty,
            qualification=doc.qualification,
            license_number=doc.license_number,
            bio=doc.bio,
            photo_url=doc.photo_url,
            consultation_fee_kes=float(doc.consultation_fee_kes),
            available_days=doc.available_days or [],
            slot_duration_minutes=doc.slot_duration_minutes or 30,
            rating=float(doc.rating),
            total_reviews=doc.total_reviews,
            is_active=doc.is_active,
            next_available=_compute_doctor_next_available(doc, clinic, db),
        )
        for doc in active_doctors
    ]

    return ClinicDetailResponse(
        id=clinic.id,
        slug=clinic.slug,
        name=clinic.name,
        address=clinic.address,
        county=clinic.county,
        phone=clinic.phone,
        email=clinic.email,
        website=clinic.website,
        logo_url=clinic.logo_url,
        cover_image_url=clinic.cover_image_url,
        description=clinic.description,
        is_verified=clinic.is_verified,
        specialties=clinic.specialties or [],
        operating_hours=clinic.operating_hours or {},
        latitude=float(clinic.latitude) if clinic.latitude else None,
        longitude=float(clinic.longitude) if clinic.longitude else None,
        is_open_now=_is_open_now(clinic.operating_hours),
        rating=avg_rating,
        total_reviews=total_reviews,
        rating_breakdown=rating_breakdown,
        subscription_plan=str(clinic.subscription_plan),
        license_number=clinic.license_number,
        doctors=doctors_out,
        reviews=reviews_out,
        doctors_count=len(active_doctors),
    )


@router.put("/{slug_or_id}")
def update_clinic(
    slug_or_id: str,
    data: ClinicUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    clinic = _lookup_clinic(slug_or_id, db, approved_only=False)
    if current_user.clinic_id != clinic.id and current_user.role != UserRole.SUPER_ADMIN:
        raise HTTPException(status_code=403, detail="Not authorized")
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(clinic, field, value)
    db.commit()
    db.refresh(clinic)
    return {"id": str(clinic.id), "slug": clinic.slug}


@router.get("/{slug_or_id}/availability", response_model=AvailabilityResponse)
def get_availability(
    slug_or_id: str,
    month: str = Query(..., description="YYYY-MM"),
    doctor_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    clinic = _lookup_clinic(slug_or_id, db)

    try:
        year, mon = map(int, month.split("-"))
        month_start = date(year, mon, 1)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid month format. Use YYYY-MM")

    month_days = cal.monthrange(year, mon)[1]
    month_end = date(year, mon, month_days)
    today = date.today()

    docs_q = db.query(Doctor).filter(Doctor.clinic_id == clinic.id, Doctor.is_active == True)
    if doctor_id:
        docs_q = docs_q.filter(Doctor.id == doctor_id)
    doctors = docs_q.all()
    if not doctors:
        return AvailabilityResponse(available_dates=[])

    # Batch booked counts for the month
    booked_q = (
        db.query(
            Appointment.doctor_id,
            Appointment.appointment_date,
            func.count(Appointment.id).label("cnt"),
        )
        .filter(
            Appointment.clinic_id == clinic.id,
            Appointment.appointment_date >= month_start,
            Appointment.appointment_date <= month_end,
            Appointment.status.notin_([AppointmentStatus.CANCELLED]),
        )
    )
    if doctor_id:
        booked_q = booked_q.filter(Appointment.doctor_id == doctor_id)
    booked_map = {
        (str(r.doctor_id), r.appointment_date): r.cnt
        for r in booked_q.group_by(Appointment.doctor_id, Appointment.appointment_date).all()
    }

    available_dates = []
    for offset in range(month_days):
        check_date = month_start + timedelta(days=offset)
        if check_date < today:
            continue
        day_name = check_date.strftime("%A").lower()
        dow = check_date.weekday()

        for doc in doctors:
            if dow not in (doc.available_days or []):
                continue
            hours = (clinic.operating_hours or {}).get(day_name)
            if not hours:
                continue
            try:
                oh, om = map(int, hours["open"].split(":"))
                ch, cm = map(int, hours["close"].split(":"))
                total_slots = ((ch * 60 + cm) - (oh * 60 + om)) // (doc.slot_duration_minutes or 30)
            except Exception:
                continue
            booked_cnt = booked_map.get((str(doc.id), check_date), 0)
            if booked_cnt < total_slots:
                available_dates.append(str(check_date))
                break

    return AvailabilityResponse(available_dates=available_dates)


@router.get("/{slug_or_id}/slots", response_model=DaySlotsResponse)
def get_slots(
    slug_or_id: str,
    slot_date: date = Query(..., alias="date"),
    doctor_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    clinic = _lookup_clinic(slug_or_id, db)

    docs_q = db.query(Doctor).filter(Doctor.clinic_id == clinic.id, Doctor.is_active == True)
    if doctor_id:
        docs_q = docs_q.filter(Doctor.id == doctor_id)
    doctors = docs_q.all()
    if not doctors:
        return DaySlotsResponse(date=slot_date, slots=[])

    day_name = slot_date.strftime("%A").lower()
    dow = slot_date.weekday()

    booked_q = db.query(Appointment).filter(
        Appointment.clinic_id == clinic.id,
        Appointment.appointment_date == slot_date,
        Appointment.status.notin_([AppointmentStatus.CANCELLED]),
    )
    if doctor_id:
        booked_q = booked_q.filter(Appointment.doctor_id == doctor_id)

    booked_set = set()
    for a in booked_q.all():
        t_raw = a.appointment_time
        t = t_raw.strftime("%H:%M") if hasattr(t_raw, "strftime") else str(t_raw)[:5]
        booked_set.add((str(a.doctor_id), t))

    # Collect all possible times; mark available if any doctor is free at that time
    all_times: dict = {}   # time → is_available
    for doc in doctors:
        if dow not in (doc.available_days or []):
            continue
        hours = (clinic.operating_hours or {}).get(day_name, {"open": "08:00", "close": "17:00"})
        try:
            oh, om = map(int, hours["open"].split(":"))
            ch, cm = map(int, hours["close"].split(":"))
        except Exception:
            continue
        current = datetime(slot_date.year, slot_date.month, slot_date.day, oh, om)
        end = datetime(slot_date.year, slot_date.month, slot_date.day, ch, cm)
        while current < end:
            t = current.strftime("%H:%M")
            available = (str(doc.id), t) not in booked_set
            all_times[t] = all_times.get(t, False) or available
            current += timedelta(minutes=doc.slot_duration_minutes or 30)

    return DaySlotsResponse(
        date=slot_date,
        slots=[TimeSlot(time=t, is_available=av) for t, av in sorted(all_times.items())],
    )


@router.get("/{slug_or_id}/doctors")
def list_doctors(slug_or_id: str, db: Session = Depends(get_db)):
    clinic = _lookup_clinic(slug_or_id, db)
    return [
        {
            "id": str(d.id),
            "full_name": d.full_name,
            "specialty": d.specialty,
            "qualification": d.qualification,
            "consultation_fee_kes": float(d.consultation_fee_kes),
            "available_days": d.available_days or [],
            "photo_url": d.photo_url,
            "rating": float(d.rating),
            "total_reviews": d.total_reviews,
            "is_active": d.is_active,
        }
        for d in db.query(Doctor).filter(Doctor.clinic_id == clinic.id, Doctor.is_active == True).all()
    ]


@router.post("/{slug_or_id}/doctors", status_code=201)
def add_doctor(
    slug_or_id: str,
    data: DoctorCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    clinic = _lookup_clinic(slug_or_id, db, approved_only=False)
    if current_user.clinic_id != clinic.id and current_user.role != UserRole.SUPER_ADMIN:
        raise HTTPException(status_code=403, detail="Not authorized")
    doctor = Doctor(**data.model_dump(), clinic_id=clinic.id)
    db.add(doctor)
    db.commit()
    db.refresh(doctor)
    return {"id": str(doctor.id), "full_name": doctor.full_name}
