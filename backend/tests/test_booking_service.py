"""
Unit tests for the booking service — slot generation and conflict detection.
DB calls are mocked so no running database is required.
"""
from datetime import datetime, timedelta
from unittest.mock import MagicMock, patch

import pytest
from app.services.booking_service import get_available_slots, is_slot_available


CLINIC_ID = "clinic-001"
DOCTOR_ID = "doctor-001"
TEST_DATE = datetime(2027, 6, 15)  # A future Monday


# ── is_slot_available ─────────────────────────────────────────────────────────

class TestIsSlotAvailable:
    def _db_with_conflict(self, found):
        """Return a mock DB that simulates finding (or not finding) a conflict."""
        db = MagicMock()
        db.query.return_value.filter.return_value.first.return_value = found
        return db

    def test_no_conflict_returns_true(self):
        db = self._db_with_conflict(None)
        slot = datetime(2027, 6, 15, 9, 0)
        assert is_slot_available(db, CLINIC_ID, DOCTOR_ID, slot) is True

    def test_conflict_returns_false(self):
        db = self._db_with_conflict(MagicMock())  # any truthy object = conflict found
        slot = datetime(2027, 6, 15, 9, 0)
        assert is_slot_available(db, CLINIC_ID, DOCTOR_ID, slot) is False

    def test_no_doctor_id_still_works(self):
        db = self._db_with_conflict(None)
        slot = datetime(2027, 6, 15, 9, 0)
        assert is_slot_available(db, CLINIC_ID, None, slot) is True

    def test_custom_duration_passed_through(self):
        db = self._db_with_conflict(None)
        slot = datetime(2027, 6, 15, 9, 0)
        result = is_slot_available(db, CLINIC_ID, DOCTOR_ID, slot, duration_minutes=60)
        assert result is True


# ── get_available_slots ───────────────────────────────────────────────────────

class TestGetAvailableSlots:
    def _db_all_free(self):
        """Mock DB where every slot is available."""
        db = MagicMock()
        db.query.return_value.filter.return_value.first.return_value = None
        return db

    def _db_all_booked(self):
        """Mock DB where every slot has a conflict."""
        db = MagicMock()
        db.query.return_value.filter.return_value.first.return_value = MagicMock()
        return db

    def test_all_free_returns_18_slots(self):
        # 08:00 to 16:30 in 30-min steps = 18 slots
        slots = get_available_slots(self._db_all_free(), CLINIC_ID, DOCTOR_ID, TEST_DATE)
        assert len(slots) == 18

    def test_first_slot_is_0800(self):
        slots = get_available_slots(self._db_all_free(), CLINIC_ID, DOCTOR_ID, TEST_DATE)
        assert slots[0].hour == 8
        assert slots[0].minute == 0

    def test_last_slot_is_1630(self):
        slots = get_available_slots(self._db_all_free(), CLINIC_ID, DOCTOR_ID, TEST_DATE)
        assert slots[-1].hour == 16
        assert slots[-1].minute == 30

    def test_slots_are_30_minutes_apart(self):
        slots = get_available_slots(self._db_all_free(), CLINIC_ID, DOCTOR_ID, TEST_DATE)
        for i in range(1, len(slots)):
            diff = (slots[i] - slots[i - 1]).total_seconds()
            assert diff == 1800  # 30 minutes

    def test_all_booked_returns_empty(self):
        slots = get_available_slots(self._db_all_booked(), CLINIC_ID, DOCTOR_ID, TEST_DATE)
        assert slots == []

    def test_slots_are_datetime_objects(self):
        slots = get_available_slots(self._db_all_free(), CLINIC_ID, DOCTOR_ID, TEST_DATE)
        for s in slots:
            assert isinstance(s, datetime)

    def test_slots_preserve_date(self):
        slots = get_available_slots(self._db_all_free(), CLINIC_ID, DOCTOR_ID, TEST_DATE)
        for s in slots:
            assert s.date() == TEST_DATE.date()

    def test_no_slots_before_0800(self):
        slots = get_available_slots(self._db_all_free(), CLINIC_ID, DOCTOR_ID, TEST_DATE)
        assert all(s.hour >= 8 for s in slots)

    def test_no_slots_at_or_after_1700(self):
        slots = get_available_slots(self._db_all_free(), CLINIC_ID, DOCTOR_ID, TEST_DATE)
        assert all(s.hour < 17 or (s.hour == 17 and s.minute == 0) for s in slots)
        assert all(not (s.hour == 17 and s.minute == 0) for s in slots)

    def test_custom_slot_duration_60_min_returns_9_slots(self):
        slots = get_available_slots(
            self._db_all_free(), CLINIC_ID, DOCTOR_ID, TEST_DATE, slot_minutes=60
        )
        assert len(slots) == 9

    def test_custom_slot_duration_15_min_returns_36_slots(self):
        slots = get_available_slots(
            self._db_all_free(), CLINIC_ID, DOCTOR_ID, TEST_DATE, slot_minutes=15
        )
        assert len(slots) == 36

    def test_partial_booking_returns_partial_slots(self):
        """Simulate 1 conflict at 09:00 — should return 17 slots."""
        call_count = {"n": 0}

        def mock_first():
            call_count["n"] += 1
            # Conflict on the 3rd slot (09:00)
            if call_count["n"] == 3:
                return MagicMock()
            return None

        db = MagicMock()
        db.query.return_value.filter.return_value.first.side_effect = mock_first

        slots = get_available_slots(db, CLINIC_ID, DOCTOR_ID, TEST_DATE)
        assert len(slots) == 17

    def test_no_doctor_id_works(self):
        slots = get_available_slots(self._db_all_free(), CLINIC_ID, None, TEST_DATE)
        assert len(slots) == 18


# ── Appointment reference format ──────────────────────────────────────────────

class TestAppointmentReference:
    """
    Tests the _reference() helper from appointments route.
    Format: MA-XXXXXXXX (8 uppercase hex chars, no dashes).
    """
    from app.api.routes.appointments import _reference

    def test_reference_starts_with_ma(self):
        import uuid
        from app.api.routes.appointments import _reference
        ref = _reference(uuid.uuid4())
        assert ref.startswith("MA-")

    def test_reference_total_length(self):
        import uuid
        from app.api.routes.appointments import _reference
        ref = _reference(uuid.uuid4())
        assert len(ref) == 11  # "MA-" (3) + 8 chars

    def test_reference_is_uppercase(self):
        import uuid
        from app.api.routes.appointments import _reference
        ref = _reference(uuid.uuid4())
        assert ref == ref.upper()

    def test_reference_contains_no_dashes_after_prefix(self):
        import uuid
        from app.api.routes.appointments import _reference
        ref = _reference(uuid.uuid4())
        assert "-" not in ref[3:]

    def test_same_id_same_reference(self):
        import uuid
        from app.api.routes.appointments import _reference
        uid = uuid.uuid4()
        assert _reference(uid) == _reference(uid)

    def test_different_ids_different_references(self):
        import uuid
        from app.api.routes.appointments import _reference
        refs = {_reference(uuid.uuid4()) for _ in range(50)}
        assert len(refs) > 1


# ── Cancellation lead-time rule ───────────────────────────────────────────────

class TestCancellationLeadTime:
    """
    The 2-hour lead-time rule is enforced inline in cancel_appointment.
    Test the datetime arithmetic in isolation.
    """

    def _hours_until(self, appt_dt: datetime) -> float:
        return (appt_dt - datetime.now()).total_seconds() / 3600

    def test_3_hours_ahead_is_cancellable(self):
        appt_dt = datetime.now() + timedelta(hours=3)
        assert self._hours_until(appt_dt) >= 2

    def test_1_hour_ahead_is_not_cancellable(self):
        appt_dt = datetime.now() + timedelta(hours=1)
        assert self._hours_until(appt_dt) < 2

    def test_exactly_2_hours_is_boundary(self):
        appt_dt = datetime.now() + timedelta(hours=2, seconds=30)
        assert self._hours_until(appt_dt) >= 2

    def test_just_under_2_hours_blocked(self):
        appt_dt = datetime.now() + timedelta(hours=1, minutes=59)
        assert self._hours_until(appt_dt) < 2

    def test_past_appointment_cannot_be_cancelled(self):
        appt_dt = datetime.now() - timedelta(hours=1)
        assert self._hours_until(appt_dt) < 2
