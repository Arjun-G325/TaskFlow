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
