"""
Unified notification dispatcher.

Creates a DB notification record and fans out to:
  - in_app  (WebSocket publish + DB row)
  - sms     (Celery SMS task)
  - email   (Celery email task)

Usage:
    await notify(
        db, user,
        type="appointment_confirmed",
        title="Appointment Confirmed",
        body="Your appointment with Dr. X is confirmed.",
        data={"appointment_id": "...", "reference": "..."},
        channels=["in_app", "sms", "email"],
    )
"""
import asyncio
import uuid
from datetime import datetime, timezone
from typing import List, Optional

from sqlalchemy.orm import Session

from app.models.notification import Notification
from app.models.user import User


async def notify(
    db: Session,
    user: User,
    *,
    type: str,
    title: str,
    body: str,
    data: Optional[dict] = None,
    channels: Optional[List[str]] = None,
    clinic_id: Optional[uuid.UUID] = None,
) -> Notification:
    """
    Persist + dispatch a notification.
    channels defaults to ["in_app"] if not specified.
    """
    if channels is None:
        channels = ["in_app"]

    notif = Notification(
        user_id=user.id,
        clinic_id=clinic_id,
        type=type,
        title=title,
        body=body,
        data=data or {},
        channel=channels,
        sent_at=datetime.now(timezone.utc),
    )
    db.add(notif)
    db.flush()  # get the ID without committing yet

    # In-app: WebSocket push (non-blocking)
    if "in_app" in channels:
        from app.core.ws_manager import ws_manager
        # Strip email fields so they are never sent over the WebSocket
        ws_data = {k: v for k, v in (data or {}).items() if k not in ("email_html", "email_subject")}
        payload = {
            "type": "notification",
            "data": {
                "id": str(notif.id),
                "notif_type": type,
                "title": title,
                "body": body,
                "data": ws_data,
                "ts": notif.sent_at.isoformat(),
                "read": False,
            },
        }
        task = asyncio.ensure_future(ws_manager.publish_to_user(str(user.id), payload))
        task.add_done_callback(lambda _: None)  # keep strong reference until done

    # SMS: via Celery
    if "sms" in channels and user.phone:
        from app.tasks.sms_tasks import send_sms_task
        send_sms_task.delay(user.phone, body)

    # Email: via Celery (caller must provide pre-rendered HTML in data["email_html"] + data["email_subject"])
    if "email" in channels and user.email and data and data.get("email_html"):
        from app.tasks.email_tasks import send_email_task
        send_email_task.delay(
            user.email,
            user.full_name,
            data.get("email_subject", title),
            data["email_html"],
        )

    return notif


async def notify_clinic(
    db: Session,
    *,
    clinic_id: str,
    type: str,
    title: str,
    body: str,
    data: Optional[dict] = None,
) -> None:
    """Publish a real-time event to all clinic dashboard connections (no DB row)."""
    from app.core.ws_manager import ws_manager
    payload = {
        "type": type,
        "data": {"title": title, "body": body, **(data or {})},
    }
    task = asyncio.ensure_future(ws_manager.publish_to_clinic(clinic_id, payload))
    task.add_done_callback(lambda _: None)
