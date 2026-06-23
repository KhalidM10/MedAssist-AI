"""unique index for walk-in bookings (null doctor_id)

Revision ID: 0010_null_doctor_booking_index
Revises: 0009_appointment_time_type
Create Date: 2026-06-23
"""
from alembic import op

revision = '0010_null_doctor_booking_index'
down_revision = '0009_appointment_time_type'
branch_labels = None
depends_on = None


def upgrade():
    # Issue #19: prevent double-booking for walk-in slots where doctor_id IS NULL.
    # The existing uix_appointments_slot only covers non-null doctor_id because
    # NULL != NULL in PostgreSQL unique constraint comparisons.
    op.execute("""
        CREATE UNIQUE INDEX IF NOT EXISTS
            uix_appointments_slot_walkin
        ON appointments (clinic_id, appointment_date, appointment_time)
        WHERE doctor_id IS NULL
          AND status NOT IN ('cancelled', 'rescheduled')
    """)


def downgrade():
    op.execute("DROP INDEX IF EXISTS uix_appointments_slot_walkin")
