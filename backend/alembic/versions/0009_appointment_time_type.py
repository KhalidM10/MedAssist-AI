"""convert appointments.appointment_time from VARCHAR to TIME

Revision ID: 0009_appointment_time_type
Revises: 0008_prod_hardening
Create Date: 2026-06-23
"""
import sqlalchemy as sa
from alembic import op

revision = '0009_appointment_time_type'
down_revision = '0008_prod_hardening'
branch_labels = None
depends_on = None


def upgrade():
    op.execute("""
        ALTER TABLE appointments
        ALTER COLUMN appointment_time TYPE TIME
        USING appointment_time::TIME
    """)


def downgrade():
    op.execute("""
        ALTER TABLE appointments
        ALTER COLUMN appointment_time TYPE VARCHAR(8)
        USING TO_CHAR(appointment_time, 'HH24:MI:SS')
    """)
