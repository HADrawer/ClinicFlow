"""Add clinic onboarding state and first-class invitation permissions."""

import json
from alembic import op
import sqlalchemy as sa

revision = "0005_onboarding_permissions"
down_revision = "0004_invitation_delivery"
branch_labels = None
depends_on = None


def _columns(table: str) -> set[str]:
    inspector = sa.inspect(op.get_bind())
    return {column["name"] for column in inspector.get_columns(table)}


def _add(table: str, column: sa.Column) -> None:
    if column.name not in _columns(table):
        op.add_column(table, column)


def upgrade():
    bind = op.get_bind()

    # Existing clinics keep working unmodified: server_default true means every
    # already-created clinic is marked onboarded by this migration.
    _add(
        "clinics",
        sa.Column(
            "onboarding_completed",
            sa.Boolean(),
            nullable=False,
            server_default=sa.true(),
        ),
    )
    _add(
        "clinics",
        sa.Column(
            "timezone", sa.String(60), nullable=False, server_default="Asia/Bahrain"
        ),
    )
    _add("clinics", sa.Column("contact_email", sa.String(255), nullable=True))

    _add(
        "staff_invitations",
        sa.Column("permissions", sa.JSON(), nullable=False, server_default="[]"),
    )

    invitations = sa.table(
        "staff_invitations",
        sa.column("id"),
        sa.column("profile_data"),
        sa.column("permissions"),
    )
    rows = bind.execute(
        sa.select(invitations.c.id, invitations.c.profile_data)
    ).all()
    for invitation_id, profile_data in rows:
        granted = (profile_data or {}).get("permissions") if profile_data else None
        if granted:
            bind.execute(
                sa.text(
                    """
                    UPDATE staff_invitations
                    SET permissions = CAST(:permissions AS JSON)
                    WHERE id = :invitation_id
                    """
                ),
                {
                    "permissions": json.dumps(sorted(granted)),
                    "invitation_id": invitation_id,
                },
            )


def downgrade():
    # Onboarding state and invitation permissions are additive; a destructive
    # downgrade must be planned explicitly for a real clinic.
    pass
