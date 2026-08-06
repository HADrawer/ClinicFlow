"""Add per-clinic Quick Create action configuration."""

import json

from alembic import op
import sqlalchemy as sa

from app.quick_create import DEFAULT_QUICK_CREATE_ACTIONS

revision = "0006_quick_create_config"
down_revision = "0005_onboarding_permissions"
branch_labels = None
depends_on = None


def _columns(table: str) -> set[str]:
    inspector = sa.inspect(op.get_bind())
    return {column["name"] for column in inspector.get_columns(table)}


def _add(table: str, column: sa.Column) -> None:
    if column.name not in _columns(table):
        op.add_column(table, column)


def upgrade():
    # Existing clinics get the same sensible default new clinics start with
    # (server_default applies to every already-created row too), so nobody's
    # Quick Create menu silently empties out after this migration.
    _add(
        "clinics",
        sa.Column(
            "quick_create_actions",
            sa.JSON(),
            nullable=False,
            server_default=json.dumps(DEFAULT_QUICK_CREATE_ACTIONS),
        ),
    )


def downgrade():
    # Additive, no data-loss concern either way; a destructive downgrade must
    # be planned explicitly for a real clinic.
    pass
