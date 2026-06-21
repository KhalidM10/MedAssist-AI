import base64
import logging
from datetime import datetime, timezone

import httpx

from app.config import get_settings

logger = logging.getLogger(__name__)

_SANDBOX_BASE = "https://sandbox.safaricom.co.ke"
_PROD_BASE = "https://api.safaricom.co.ke"


def _base_url() -> str:
    settings = get_settings()
    return _SANDBOX_BASE if settings.mpesa_environment == "sandbox" else _PROD_BASE


async def _get_access_token() -> str:
    settings = get_settings()
    url = f"{_base_url()}/oauth/v1/generate?grant_type=client_credentials"
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(
            url,
            auth=(settings.mpesa_consumer_key, settings.mpesa_consumer_secret),
        )
        resp.raise_for_status()
        return resp.json()["access_token"]


def _stk_password(shortcode: str, passkey: str, timestamp: str) -> str:
    raw = f"{shortcode}{passkey}{timestamp}"
    return base64.b64encode(raw.encode()).decode()


async def stk_push(
    phone: str,
    amount: int,
    account_reference: str,
    description: str,
    callback_url: str,
) -> dict:
    """Initiate an M-Pesa STK push. Returns the raw Daraja response dict."""
    settings = get_settings()
    if not settings.mpesa_consumer_key or not settings.mpesa_shortcode:
        raise RuntimeError("M-Pesa credentials not configured")

    token = await _get_access_token()
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
    password = _stk_password(settings.mpesa_shortcode, settings.mpesa_passkey, timestamp)

    # Normalise phone to 2547XXXXXXXX
    cleaned = phone.replace(" ", "").replace("-", "").lstrip("+")
    if cleaned.startswith("0"):
        cleaned = "254" + cleaned[1:]
    elif not cleaned.startswith("254"):
        cleaned = "254" + cleaned

    payload = {
        "BusinessShortCode": settings.mpesa_shortcode,
        "Password": password,
        "Timestamp": timestamp,
        "TransactionType": "CustomerPayBillOnline",
        "Amount": max(1, int(amount)),
        "PartyA": cleaned,
        "PartyB": settings.mpesa_shortcode,
        "PhoneNumber": cleaned,
        "CallBackURL": callback_url,
        "AccountReference": account_reference[:12],
        "TransactionDesc": description[:13],
    }

    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.post(
            f"{_base_url()}/mpesa/stkpush/v1/processrequest",
            json=payload,
            headers={"Authorization": f"Bearer {token}"},
        )
        resp.raise_for_status()
        return resp.json()
