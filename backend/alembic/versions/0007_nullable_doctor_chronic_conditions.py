"""make appointments.doctor_id nullable; add users.chronic_conditions

Revision ID: 0007_nullable_doctor_chronic_conditions
Revises: 0006_drop_stripe_customer_id
Create Date: 2026-06-21
"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import ARRAY

revision = '0007_schema_updates'
down_revision = '0006_drop_stripe_customer_id'
branch_labels = None
depends_on = None


def upgrade():
    # Fix #2: allow walk-in bookings without an assigned doctor
    op.alter_column('appointments', 'doctor_id', nullable=True)

    # Fix #6: persist patient chronic conditions
    op.add_column(
        'users',
        sa.Column('chronic_conditions', ARRAY(sa.Text()), nullable=True),
    )


def downgrade():
    op.drop_column('users', 'chronic_conditions')
    op.alter_column('appointments', 'doctor_id', nullable=False)
