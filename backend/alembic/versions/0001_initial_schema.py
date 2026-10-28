"""Create missing tables from the SQLAlchemy model metadata.

Revision ID: 0001_initial_schema
Revises:
"""
from alembic import op

from app.database import Base
import app.models  # noqa: F401

revision = "0001_initial_schema"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # checkfirst makes this baseline safe to apply to an already provisioned database.
    Base.metadata.create_all(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    # The baseline may be stamped onto databases with user data; never drop those tables.
    pass
