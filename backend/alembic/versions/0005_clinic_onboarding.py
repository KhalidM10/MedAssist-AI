"""Clinic onboarding: approval workflow, change requests, user moderation

Revision ID: 0005_clinic_onboarding
Revises: 0004_auth_security
Create Date: 2026-05-25
"""
from alembic import op

revision = "0005_clinic_onboarding"
down_revision = "0004_auth_security"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── Clinics: approval workflow ────────────────────────────────────────────────
    op.execute("""
        ALTER TABLE clinics
            ADD COLUMN IF NOT EXISTS approval_status              VARCHAR(20)   NOT NULL DEFAULT 'pending',
            ADD COLUMN IF NOT EXISTS approval_notes               TEXT,
            ADD COLUMN IF NOT EXISTS approved_by                  UUID REFERENCES users(id) ON DELETE SET NULL,
            ADD COLUMN IF NOT EXISTS approved_at                  TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS submitted_at                 TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS registration_reference       VARCHAR(20) UNIQUE,
            ADD COLUMN IF NOT EXISTS documents                    JSONB NOT NULL DEFAULT '[]',
            ADD COLUMN IF NOT EXISTS business_registration_number VARCHAR(100),
            ADD COLUMN IF NOT EXISTS year_established             INTEGER
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_clinics_approval_status ON clinics(approval_status)")

    # ── Users: moderation fields ──────────────────────────────────────────────────
    op.execute("""
        ALTER TABLE users
            ADD COLUMN IF NOT EXISTS is_clinic_approved BOOLEAN     NOT NULL DEFAULT FALSE,
            ADD COLUMN IF NOT EXISTS suspension_reason  TEXT,
            ADD COLUMN IF NOT EXISTS suspension_until   TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS ban_reason         TEXT,
            ADD COLUMN IF NOT EXISTS banned_at          TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS warning_count      INTEGER     NOT NULL DEFAULT 0
    """)

    # ── Clinic change requests ────────────────────────────────────────────────────
    op.execute("""
        CREATE TABLE IF NOT EXISTS clinic_change_requests (
            id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
            clinic_id       UUID         NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
            requested_by    UUID         NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
            field_name      VARCHAR(100) NOT NULL,
            current_value   TEXT,
            requested_value TEXT         NOT NULL,
            reason          TEXT,
            status          VARCHAR(20)  NOT NULL DEFAULT 'pending',
            reviewed_by     UUID REFERENCES users(id) ON DELETE SET NULL,
            reviewed_at     TIMESTAMPTZ,
            created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_change_req_clinic ON clinic_change_requests(clinic_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_change_req_status ON clinic_change_requests(status)")


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS clinic_change_requests")
    op.execute("""
        ALTER TABLE users
            DROP COLUMN IF EXISTS is_clinic_approved,
            DROP COLUMN IF EXISTS suspension_reason,
            DROP COLUMN IF EXISTS suspension_until,
            DROP COLUMN IF EXISTS ban_reason,
            DROP COLUMN IF EXISTS banned_at,
            DROP COLUMN IF EXISTS warning_count
    """)
    op.execute("DROP INDEX IF EXISTS ix_clinics_approval_status")
    op.execute("""
        ALTER TABLE clinics
            DROP COLUMN IF EXISTS approval_status,
            DROP COLUMN IF EXISTS approval_notes,
            DROP COLUMN IF EXISTS approved_by,
            DROP COLUMN IF EXISTS approved_at,
            DROP COLUMN IF EXISTS submitted_at,
            DROP COLUMN IF EXISTS registration_reference,
            DROP COLUMN IF EXISTS documents,
            DROP COLUMN IF EXISTS business_registration_number,
            DROP COLUMN IF EXISTS year_established
    """)
