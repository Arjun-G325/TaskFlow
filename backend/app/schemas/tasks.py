from datetime import datetime, timezone
from typing import Literal

from pydantic import BaseModel, Field, field_serializer, field_validator

from app.models.enums import Priority, TaskStatus
from app.schemas.collaboration import AiLogInput, SubtaskCreate


def _normalize_due_at(value: datetime | None) -> datetime | None:
    """Store deadlines as naive UTC values for MySQL DATETIME columns."""
    if value is None:
        return None
    if value.tzinfo is None or value.utcoffset() is None:
        raise ValueError("Deadline must include a timezone; send an ISO timestamp with Z or an offset.")
    return value.astimezone(timezone.utc).replace(tzinfo=None)


def _serialize_due_at(value: datetime | None) -> datetime | None:
    """Mark stored UTC deadlines as UTC in API responses for browser-local display."""
    if value is None:
        return None
    if value.tzinfo is None or value.utcoffset() is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


class TaskCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    description: str | None = None
    status: TaskStatus = TaskStatus.TODO
    priority: Priority = Priority.MEDIUM
    due_at: datetime | None = None
    due_timezone: Literal["UTC", "Asia/Kolkata"] = "Asia/Kolkata"
    assignee_ids: list[int] = Field(default_factory=list)
    subtasks: list[SubtaskCreate] = Field(default_factory=list, max_length=50)
    ai_log: AiLogInput | None = None

    @field_validator("title")
    @classmethod
    def title_must_not_be_blank(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Task title cannot be blank.")
        return value

    @field_validator("due_at")
    @classmethod
    def deadline_to_utc(cls, value: datetime | None) -> datetime | None:
        return _normalize_due_at(value)


class TaskUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = None
    status: TaskStatus | None = None
    priority: Priority | None = None
    due_at: datetime | None = None
    due_timezone: Literal["UTC", "Asia/Kolkata"] | None = None
    assignee_ids: list[int] | None = None
    subtasks: list[SubtaskCreate] | None = Field(default=None, max_length=50)
    ai_log: AiLogInput | None = None
    ai_log_id: int | None = None

    @field_validator("title")
    @classmethod
    def title_must_not_be_blank(cls, value: str | None) -> str | None:
        if value is None:
            raise ValueError("Task title cannot be null.")
        value = value.strip()
        if not value:
            raise ValueError("Task title cannot be blank.")
        return value

    @field_validator("due_at")
    @classmethod
    def deadline_to_utc(cls, value: datetime | None) -> datetime | None:
        return _normalize_due_at(value)

    @field_validator("due_timezone")
    @classmethod
    def timezone_cannot_be_null(cls, value: str | None) -> str:
        if value is None:
            raise ValueError("Choose UTC or IST for the deadline timezone.")
        return value


class TaskStatusUpdate(BaseModel):
    status: TaskStatus


class TaskRead(BaseModel):
    id: int
    project_id: int
    title: str
    description: str | None
    status: TaskStatus
    priority: Priority
    due_at: datetime | None
    due_timezone: Literal["UTC", "Asia/Kolkata"]
    created_by_id: int
    created_at: datetime
    updated_at: datetime
    assignee_ids: list[int]

    @field_serializer("due_at")
    def deadline_as_utc(self, value: datetime | None) -> datetime | None:
        return _serialize_due_at(value)
