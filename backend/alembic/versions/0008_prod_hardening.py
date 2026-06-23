"""production hardening: booking uniqueness, notification index, payment method constraint

Revision ID: 0008_prod_hardening
Revises: 0007_schema_updates
Create Date: 2026-06-23
"""
import sqlalchemy as sa
from alembic import op

revision = '0008_prod_hardening'
down_revision = '0007_schema_updates'
branch_labels = None
depends_on = None


def upgrade():
    # Issue #1: prevent double-booking at the DB level via unique partial index.
    op.execute("""
        CREATE UNIQUE INDEX IF NOT EXISTS
            uix_appointments_slot
        ON appointments (clinic_id, doctor_id, appointment_date, appointment_time)
        WHERE status NOT IN ('cancelled', 'rescheduled')
    """)

    # Issue #24: composite index for notification inbox queries (user + unread)
    op.execute("""
        CREATE INDEX IF NOT EXISTS
            ix_notifications_user_unread
        ON notifications (user_id, is_read)
        WHERE is_read = false
    """)

    # Issue #47: payment_method CHECK constraint on orders
    op.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint
                WHERE conname = 'ck_orders_payment_method'
                  AND conrelid = 'orders'::regclass
            ) THEN
                ALTER TABLE orders
                ADD CONSTRAINT ck_orders_payment_method
                CHECK (payment_method IN ('mpesa', 'cash', 'insurance', 'card'))
                NOT VALID;
            END IF;
        END $$
    """)
    op.execute("ALTER TABLE orders VALIDATE CONSTRAINT ck_orders_payment_method")


def downgrade():
    op.execute("ALTER TABLE orders DROP CONSTRAINT IF EXISTS ck_orders_payment_method")
    op.execute("DROP INDEX IF EXISTS ix_notifications_user_unread")
    op.execute("DROP INDEX IF EXISTS uix_appointments_slot")
