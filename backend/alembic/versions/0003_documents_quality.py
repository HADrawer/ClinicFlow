"""Add secure document and quality-record tables."""

from alembic import op
from app.database import Base
from app import models  # noqa: F401

revision = "0003_documents_quality"
down_revision = "0002_system_expansion"
branch_labels = None
depends_on = None


def upgrade():
    Base.metadata.create_all(bind=op.get_bind(), checkfirst=True)


def downgrade():
    pass
