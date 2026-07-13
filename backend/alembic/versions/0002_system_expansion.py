"""Add staff lifecycle, patient journey, scheduling, and pharmacy domains.

This migration is intentionally defensive because the original 0001 migration
creates metadata dynamically. On a fresh database 0001 sees the current model;
on an existing database this revision adds columns and then creates only the
missing tables.
"""

from alembic import op
import sqlalchemy as sa

from app.database import Base
from app import models  # noqa: F401

revision = "0002_system_expansion"
down_revision = "0001_initial"
branch_labels = None
depends_on = None


def _columns(table: str) -> set[str]:
    inspector = sa.inspect(op.get_bind())
    return {column["name"] for column in inspector.get_columns(table)}


def _add(table: str, column: sa.Column) -> None:
    if column.name not in _columns(table):
        op.add_column(table, column)


def _extend_postgres_enums() -> None:
    if op.get_bind().dialect.name != "postgresql":
        return
    for value in ["nurse", "pharmacist"]:
        op.execute(f"ALTER TYPE role ADD VALUE IF NOT EXISTS '{value}'")
    for value in [
        "requested",
        "checked_in",
        "waiting",
        "in_progress",
        "rescheduled",
        "waitlisted",
        "entered_in_error",
    ]:
        op.execute(f"ALTER TYPE appointmentstatus ADD VALUE IF NOT EXISTS '{value}'")


def upgrade():
    bind = op.get_bind()
    _extend_postgres_enums()
    encounter_status = sa.Enum(
        "draft",
        "in_progress",
        "finalized",
        "amended",
        "entered_in_error",
        name="encounterstatus",
    )
    encounter_status.create(bind, checkfirst=True)

    _add("clinics", sa.Column("pharmacy_enabled", sa.Boolean(), nullable=False, server_default=sa.false()))
    _add("clinics", sa.Column("feature_flags", sa.JSON(), nullable=False, server_default="{}"))
    _add("users", sa.Column("permissions", sa.JSON(), nullable=False, server_default="[]"))
    _add("users", sa.Column("session_version", sa.Integer(), nullable=False, server_default="1"))
    _add("users", sa.Column("last_login_at", sa.DateTime(timezone=True), nullable=True))
    _add("users", sa.Column("disabled_at", sa.DateTime(timezone=True), nullable=True))

    _add("patients", sa.Column("patient_number", sa.String(40), nullable=True))
    _add("patients", sa.Column("arabic_name", sa.String(160), nullable=True))
    _add("patients", sa.Column("preferred_name", sa.String(120), nullable=True))
    _add("patients", sa.Column("preferred_language", sa.String(8), nullable=False, server_default="en"))
    _add("patients", sa.Column("communication_consent", sa.Boolean(), nullable=False, server_default=sa.false()))
    _add("patients", sa.Column("treatment_consent_state", sa.String(30), nullable=False, server_default="not_recorded"))
    _add("patients", sa.Column("archived_at", sa.DateTime(timezone=True), nullable=True))

    _add("appointments", sa.Column("room", sa.String(80), nullable=True))
    _add("appointments", sa.Column("booking_source", sa.String(40), nullable=False, server_default="staff"))
    _add("appointments", sa.Column("arrival_at", sa.DateTime(timezone=True), nullable=True))
    _add("appointments", sa.Column("conflict_override_reason", sa.Text(), nullable=True))
    _add("appointments", sa.Column("created_by_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True))

    _add("visits", sa.Column("status", encounter_status, nullable=False, server_default="draft"))
    _add("visits", sa.Column("finalized_by_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True))
    _add("visits", sa.Column("finalized_at", sa.DateTime(timezone=True), nullable=True))
    _add("visits", sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True))
    _add("prescriptions", sa.Column("status", sa.String(30), nullable=False, server_default="issued"))
    _add("prescription_items", sa.Column("quantity", sa.Integer(), nullable=False, server_default="1"))

    Base.metadata.create_all(bind=bind, checkfirst=True)

    patients = sa.table("patients", sa.column("id"), sa.column("clinic_id"), sa.column("patient_number"))
    rows = bind.execute(sa.select(patients.c.id, patients.c.clinic_id).where(patients.c.patient_number.is_(None))).all()
    for patient_id, clinic_id in rows:
        bind.execute(
            patients.update()
            .where(patients.c.id == patient_id)
            .values(patient_number=f"CF-{clinic_id:03d}-{patient_id:06d}")
        )


def downgrade():
    # Data-bearing expansion tables and immutable audit records are retained.
    # A destructive downgrade must be planned explicitly for a real clinic.
    pass
