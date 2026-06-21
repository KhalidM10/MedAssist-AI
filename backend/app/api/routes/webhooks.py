"""
M-Pesa Daraja STK Push callback webhook.
Safaricom POSTs here after the customer enters their PIN.
"""
import logging
from datetime import timezone, datetime
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_db
from app.models.appointment import Appointment, AppointmentStatus
from app.models.user import User
from app.services.mpesa import stk_push
from app.config import get_settings

logger = logging.getLogger(__name__)
router = APIRouter()


# ── Appointment payment initiation ────────────────────────────────────────────

@router.post("/appointments/{appointment_id}/initiate-payment", status_code=202)
async def initiate_appointment_payment(
    appointment_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Send an M-Pesa STK push to the patient's registered phone for an appointment."""
    appt = (
        db.query(Appointment)
        .filter(Appointment.id == appointment_id)
        .first()
    )
    if not appt:
        raise HTTPException(status_code=404, detail="Appointment not found")
    if str(appt.patient_id) != str(current_user.id):
        raise HTTPException(status_code=403, detail="Not your appointment")
    if appt.payment_status == "paid":
        raise HTTPException(status_code=400, detail="Appointment already paid")
    if not appt.amount_kes or appt.amount_kes <= 0:
        raise HTTPException(status_code=400, detail="No payment amount set for this appointment")
    if not current_user.phone:
        raise HTTPException(status_code=400, detail="No phone number on your account")

    settings = get_settings()
    reference = f"MA-{str(appt.id).upper().replace('-', '')[:8]}"
    callback_url = f"{settings.mpesa_callback_url}/api/v1/webhooks/mpesa/stk-callback"

    try:
        result = await stk_push(
            phone=current_user.phone,
            amount=int(appt.amount_kes),
            account_reference=reference,
            description=f"Appointment {reference}",
            callback_url=callback_url,
        )
    except Exception as exc:
        logger.exception("M-Pesa STK push failed for appointment %s", appointment_id)
        raise HTTPException(status_code=502, detail="Payment initiation failed. Please try again.")

    checkout_request_id = result.get("CheckoutRequestID")
    if checkout_request_id:
        appt.mpesa_transaction_id = checkout_request_id
        db.commit()

    return {
        "message": f"M-Pesa prompt sent to {current_user.phone}. Enter your PIN to confirm.",
        "checkout_request_id": checkout_request_id,
    }


# ── M-Pesa STK callback ────────────────────────────────────────────────────────

@router.post("/mpesa/stk-callback")
async def mpesa_stk_callback(request: Request, db: Session = Depends(get_db)):
    """
    Safaricom calls this URL after the customer completes or dismisses the STK prompt.
    Payload structure: { "Body": { "stkCallback": { ... } } }
    """
    try:
        payload = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON body")

    callback = payload.get("Body", {}).get("stkCallback", {})
    result_code = callback.get("ResultCode")
    checkout_request_id = callback.get("CheckoutRequestID")

    if not checkout_request_id:
        logger.warning("M-Pesa callback missing CheckoutRequestID: %s", payload)
        return {"ResultCode": 0, "ResultDesc": "Accepted"}

    appt = db.query(Appointment).filter(
        Appointment.mpesa_transaction_id == checkout_request_id
    ).first()

    if not appt:
        logger.warning("No appointment found for CheckoutRequestID %s", checkout_request_id)
        return {"ResultCode": 0, "ResultDesc": "Accepted"}

    if result_code == 0:
        # Successful payment
        metadata_items = callback.get("CallbackMetadata", {}).get("Item", [])
        meta = {item["Name"]: item.get("Value") for item in metadata_items}

        appt.payment_status = "paid"
        appt.payment_method = "mpesa"
        appt.mpesa_receipt_number = meta.get("MpesaReceiptNumber")
        db.commit()
        logger.info(
            "Payment confirmed for appointment %s — receipt %s",
            appt.id, appt.mpesa_receipt_number,
        )
    else:
        logger.info(
            "M-Pesa STK failed for appointment %s — ResultCode %s: %s",
            appt.id, result_code, callback.get("ResultDesc"),
        )

    return {"ResultCode": 0, "ResultDesc": "Accepted"}
