"""drop stripe_customer_id from clinics

Revision ID: 0006
Revises: 0005
Create Date: 2026-06-21
"""
from alembic import op

revision = '0006_drop_stripe_customer_id'
down_revision = '0005_clinic_onboarding'
branch_labels = None
depends_on = None


def upgrade():
    op.drop_column('clinics', 'stripe_customer_id')


def downgrade():
    import sqlalchemy as sa
    op.add_column('clinics', sa.Column('stripe_customer_id', sa.String(255), nullable=True))
