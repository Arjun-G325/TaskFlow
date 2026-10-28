"""Persist the timezone selected for each task deadline.

Revision ID: 0002_task_due_timezone
Revises: 0001_initial_schema
"""
from alembic import op
import sqlalchemy as sa


revision = "0002_task_due_timezone"
down_revision = "0001_initial_schema"
branch_labels = None
depends_on = None


def upgrade() -> None:
    columns = {column["name"] for column in sa.inspect(op.get_bind()).get_columns("tasks")}
    if "due_timezone" not in columns:
        op.add_column(
            "tasks",
            sa.Column(
                "due_timezone",
                sa.String(length=32),
                nullable=False,
                server_default="UTC",
            ),
        )


def downgrade() -> None:
    columns = {column["name"] for column in sa.inspect(op.get_bind()).get_columns("tasks")}
    if "due_timezone" in columns:
        op.drop_column("tasks", "due_timezone")
