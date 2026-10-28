from datetime import datetime, timezone

from pydantic import BaseModel, Field, field_serializer, field_validator

from app.models.enums import TaskStatus


class SubtaskCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    description: str | None = None
    is_ai_generated: bool = False

    @field_validator("title")
    @classmethod
    def title_not_blank(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Subtask title cannot be blank.")
        return value


class SubtaskUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = None
    is_done: bool | None = None

    @field_validator("title")
    @classmethod
    def title_not_blank(cls, value: str | None) -> str | None:
        if value is None:
            raise ValueError("Subtask title cannot be null.")
        value = value.strip()
        if not value:
            raise ValueError("Subtask title cannot be blank.")
        return value


class SubtaskRead(BaseModel):
    id: int
    task_id: int
    title: str
    description: str | None
    is_done: bool
    is_ai_generated: bool
    updated_at: datetime


class CommentCreate(BaseModel):
    body: str = Field(min_length=1, max_length=10000)

    @field_validator("body")
    @classmethod
    def body_not_blank(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Comment cannot be blank.")
        return value


class CommentRead(BaseModel):
    id: int
    subtask_id: int
    user_id: int
    username: str
    body: str
    created_at: datetime


class SubtaskDetail(SubtaskRead):
    project_id: int
    task_title: str
    comments: list[CommentRead]
    history: list[dict]


class TaskDetail(BaseModel):
    id: int
    project_id: int
    title: str
    description: str | None
    status: TaskStatus
    priority: str
    due_at: datetime | None
    due_timezone: str
    created_by_id: int
    created_by_username: str
    created_at: datetime
    updated_at: datetime
    assignee_ids: list[int]
    subtasks: list[SubtaskRead]

    @field_serializer("due_at")
    def deadline_as_utc(self, value: datetime | None) -> datetime | None:
        if value is None:
            return None
        if value.tzinfo is None or value.utcoffset() is None:
            return value.replace(tzinfo=timezone.utc)
        return value.astimezone(timezone.utc)


class AiAssistRequest(BaseModel):
    title: str = Field(min_length=3, max_length=200)

    @field_validator("title")
    @classmethod
    def title_not_blank(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Enter a task title first.")
        return value


class AiSubtaskSuggestion(BaseModel):
    title: str = Field(min_length=3, max_length=200)
    description: str | None = None


class AiSuggestionPayload(BaseModel):
    description: str = Field(min_length=10, max_length=10000)
    subtasks: list[AiSubtaskSuggestion] = Field(min_length=3, max_length=5)


class AiPlan(BaseModel):
    scope: str = Field(min_length=10, max_length=2000)
    steps: list[str] = Field(min_length=3, max_length=5)


class AiReview(BaseModel):
    valid: bool
    issues: list[str] = Field(default_factory=list, max_length=5)


class AiAssistRead(AiSuggestionPayload):
    prompt_sent: str
    ai_response: str
    ai_log_id: int | None = None


class AiLogInput(BaseModel):
    prompt_sent: str = Field(max_length=20000)
    ai_response: str = Field(max_length=20000)

