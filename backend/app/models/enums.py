from enum import Enum


class StringEnum(str, Enum):
    """String-valued enum that is convenient to use in API schemas too."""


class ProjectRole(StringEnum):
    OWNER = "owner"
    MEMBER = "member"


class TaskStatus(StringEnum):
    TODO = "todo"
    IN_PROGRESS = "in_progress"
    DONE = "done"


class Priority(StringEnum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class ActivityAction(StringEnum):
    TASK_CREATED = "task_created"
    TASK_UPDATED = "task_updated"
    TASK_ASSIGNED = "task_assigned"
    STATUS_CHANGED = "status_changed"
    SUBTASK_CREATED = "subtask_created"
    SUBTASK_UPDATED = "subtask_updated"
    SUBTASK_DELETED = "subtask_deleted"
    COMMENT_ADDED = "comment_added"
    MEMBER_ADDED = "member_added"
