import logging
import time
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

from app.core.deps import get_db, get_optional_user
from app.models.triage import SymptomLog, TriageSession
from app.models.user import User
from app.schemas.triage import TriageAnalyzeRequest, TriageAnalyzeResponse
from app.services.triage_engine import TriageEngine

router = APIRouter()
_engine = TriageEngine()

_ACTION_MAP = {
    "mild": "rest_at_home",
    "moderate": "visit_clinic",
    "urgent": "emergency",
}


@router.post("/analyze", response_model=TriageAnalyzeResponse, status_code=status.HTTP_200_OK)
def analyze_symptoms(
    data: TriageAnalyzeRequest,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user),
):
    if not data.symptoms:
        raise HTTPException(status_code=400, detail="At least one symptom is required")

    # Derive per-symptom duration: prefer symptom_logs detail, else top-level duration_days
    log_durations = {
        log.symptom_name.lower(): log.duration_days
        for log in (data.symptom_logs or [])
        if log.duration_days is not None
    }
    duration_days = data.duration_days or (
        max(log_durations.values()) if log_durations else None
    )

    t_start = time.monotonic()

    result = _engine.analyze(
        symptoms=data.symptoms,
        age=data.user_age,
        gender=data.user_gender,
        duration_days=duration_days,
        pre_existing_conditions=data.pre_existing_conditions or [],
        county=data.county,
    )

    elapsed = int(time.monotonic() - t_start)
    result_dict = result.to_dict()

    # ── Persist to DB ─────────────────────────────────────────────────────────
    saved = False
    db_session_id = str(uuid.uuid4())  # fallback if DB save fails
    try:
        severity_str = result_dict["severity"]
        action_str = _ACTION_MAP.get(severity_str, "rest_at_home")

        # Flatten recommendations to a list of strings for the JSONB column
        recs = result_dict["recommendations"]
        when_esc = recs.get("when_to_escalate", "")
        rec_strings = (
            [recs.get("immediate_action", "")]
            + recs.get("home_care", [])
            + ([when_esc] if isinstance(when_esc, str) and when_esc else when_esc if isinstance(when_esc, list) else [])
        )
        rec_strings = [r for r in rec_strings if r]

        session = TriageSession(
            user_id=current_user.id if current_user else None,
            symptoms=data.symptoms,
            severity_level=severity_str,
            recommendations=rec_strings,
            recommended_action=action_str,
            patient_age=data.user_age,
            patient_gender=data.user_gender,
            county=data.county,
            session_duration_seconds=elapsed,
        )
        db.add(session)
        db.flush()

        # Save detailed symptom logs if provided; otherwise save bare symptom names
        if data.symptom_logs:
            for log in data.symptom_logs:
                db.add(SymptomLog(
                    triage_session_id=session.id,
                    symptom_name=log.symptom_name,
                    duration_days=log.duration_days,
                    severity_score=log.severity_score,
                    body_part=log.body_part,
                ))
        else:
            for symptom in data.symptoms:
                db.add(SymptomLog(
                    triage_session_id=session.id,
                    symptom_name=symptom,
                ))

        db.commit()
        db_session_id = str(session.id)
        saved = True
    except Exception:
        logger.exception("Failed to persist triage session for user %s", getattr(current_user, "id", "anonymous"))
        db.rollback()

    return TriageAnalyzeResponse(
        session_id=db_session_id,
        severity=result_dict["severity"],
        confidence=result_dict["confidence"],
        matched_conditions=result_dict["matched_conditions"],
        recommendations=result_dict["recommendations"],
        suggested_specializations=result_dict["suggested_specializations"],
        disclaimer=result_dict["disclaimer"],
        saved_to_db=saved,
    )


@router.patch("/sessions/{session_id}/feedback", status_code=status.HTTP_200_OK)
def submit_feedback(
    session_id: str,
    did_visit_doctor: bool,
    db: Session = Depends(get_db),
):
    session = db.query(TriageSession).filter(
        TriageSession.id == session_id
    ).first()
    if not session:
        raise HTTPException(status_code=404, detail="Triage session not found")

    session.did_visit_doctor = did_visit_doctor
    db.commit()
    return {"status": "updated", "session_id": session_id}
