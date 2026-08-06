"""Add email delivery tracking to staff invitations."""

from alembic import op
import sqlalchemy as sa

revision = "0004_invitation_delivery"
down_revision = "0003_documents_quality"
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
    delivery_status = sa.Enum("pending", "sent", "failed", name="deliverystatus")
    delivery_status.create(bind, checkfirst=True)

    _add(
        "staff_invitations",
        sa.Column(
            "delivery_status",
            delivery_status,
            nullable=False,
            server_default="pending",
        ),
    )
    _add(
        "staff_invitations",
        sa.Column("sent_at", sa.DateTime(timezone=True), nullable=True),
    )
    _add(
        "staff_invitations",
        sa.Column("last_delivery_error", sa.Text(), nullable=True),
    )
    _add(
        "staff_invitations",
        sa.Column(
            "delivery_attempts", sa.Integer(), nullable=False, server_default="0"
        ),
    )


def downgrade():
    # Delivery tracking is additive metadata; a destructive downgrade must be
    # planned explicitly for a real clinic.
    pass
