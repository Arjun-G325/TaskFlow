from datetime import datetime

from pydantic import BaseModel, Field, field_validator

from app.models.enums import Priority, TaskStatus


class TaskCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    description: str | None = None
    status: TaskStatus = TaskStatus.TODO
    priority: Priority = Priority.MEDIUM
    due_at: datetime | None = None
    assignee_ids: list[int] = Field(default_factory=list)

    @field_validator("title")
    @classmethod
    def title_must_not_be_blank(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Task title cannot be blank.")
        return value


class TaskUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = None
    status: TaskStatus | None = None
    priority: Priority | None = None
    due_at: datetime | None = None
    assignee_ids: list[int] | None = None

    @field_validator("title")
    @classmethod
    def title_must_not_be_blank(cls, value: str | None) -> str | None:
        if value is None:
            raise ValueError("Task title cannot be null.")
        value = value.strip()
        if not value:
            raise ValueError("Task title cannot be blank.")
        return value


class TaskRead(BaseModel):
    id: int
    project_id: int
    title: str
    description: str | None
    status: TaskStatus
    priority: Priority
    due_at: datetime | None
    created_by_id: int
    created_at: datetime
    updated_at: datetime
    assignee_ids: list[int]
