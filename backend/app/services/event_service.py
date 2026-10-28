from fastapi.encoders import jsonable_encoder
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import ActivityLog, Notification, Task, TaskAssignee


def task_participant_ids(db: Session, task: Task) -> set[int]:
    user_ids = {task.created_by_id}
    user_ids.update(
        db.scalars(select(TaskAssignee.user_id).where(TaskAssignee.task_id == task.id)).all()
    )
    return user_ids


def record_event(
    db: Session,
    *,
    actor_id: int,
    project_id: int,
    action: str,
    details: dict | None = None,
    task: Task | None = None,
    subtask_id: int | None = None,
    notification_message: str | None = None,
    recipient_ids: set[int] | None = None,
) -> None:
    """Persist an activity row and optional notifications in the caller's transaction."""
    db.add(
        ActivityLog(
            project_id=project_id,
            task_id=task.id if task else None,
            subtask_id=subtask_id,
            user_id=actor_id,
            action=action,
            details=jsonable_encoder(details) if details is not None else None,
        )
    )
    if not notification_message:
        return
    recipients = recipient_ids or (task_participant_ids(db, task) if task else set())
    for user_id in recipients - {actor_id}:
        db.add(
            Notification(
                user_id=user_id,
                task_id=task.id if task else None,
                subtask_id=subtask_id,
                project_id=project_id,
                message=notification_message[:255],
            )
        )
