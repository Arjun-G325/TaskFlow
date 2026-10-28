from datetime import datetime, timezone
import json

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import delete, or_, select
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user
from app.database import get_db
from app.models import (
    ActivityLog,
    AiLog,
    Comment,
    Notification,
    Project,
    ProjectMember,
    Subtask,
    Task,
    TaskAssignee,
    User,
)
from app.models.enums import TaskStatus
from app.schemas.collaboration import AiAssistRead, AiAssistRequest
from app.schemas.tasks import TaskCreate, TaskRead, TaskStatusUpdate, TaskUpdate
from app.services.ai_agent import AiAssistUnavailable, generate_task_draft
from app.services.event_service import record_event

router = APIRouter(prefix="/projects/{project_id}/tasks", tags=["tasks"])
task_alias_router = APIRouter(prefix="/tasks", tags=["tasks"])


@router.post("/ai-assist", response_model=AiAssistRead)
def ai_assist(
    project_id: int,
    payload: AiAssistRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AiAssistRead:
    _require_project_member(db, project_id, current_user.id)
    try:
        return generate_task_draft(payload.title)
    except AiAssistUnavailable as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


def _require_project_member(db: Session, project_id: int, user_id: int) -> None:
    project = db.scalar(
        select(Project.id).where(
            Project.id == project_id,
            or_(
                Project.owner_id == user_id,
                Project.members.any(ProjectMember.user_id == user_id),
            ),
        )
    )
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found.")


def _get_task(db: Session, project_id: int, task_id: int, user_id: int) -> Task:
    _require_project_member(db, project_id, user_id)
    task = db.scalar(
        select(Task).where(Task.id == task_id, Task.project_id == project_id)
    )
    if task is None:
        raise HTTPException(status_code=404, detail="Task not found.")
    return task


def _sync_assignees(db: Session, project_id: int, task: Task, assignee_ids: list[int]) -> None:
    requested_ids = set(assignee_ids)
    if len(requested_ids) != len(assignee_ids):
        raise HTTPException(status_code=422, detail="Assignee IDs must not repeat.")
    member_ids = set(
        db.scalars(
            select(ProjectMember.user_id).where(
                ProjectMember.project_id == project_id,
                ProjectMember.user_id.in_(requested_ids),
            )
        ).all()
    ) if requested_ids else set()
    if member_ids != requested_ids:
        raise HTTPException(
            status_code=422,
            detail="Every assignee must be a member of this project.",
        )
    db.execute(delete(TaskAssignee).where(TaskAssignee.task_id == task.id))
    db.add_all(
        TaskAssignee(task_id=task.id, user_id=user_id)
        for user_id in assignee_ids
    )
    db.expire(task, ["assignee_links"])


def _task_response(task: Task) -> dict:
    return {
        "id": task.id,
        "project_id": task.project_id,
        "title": task.title,
        "description": task.description,
        "status": task.status,
        "priority": task.priority,
        "due_at": task.due_at,
        "due_timezone": task.due_timezone,
        "created_by_id": task.created_by_id,
        "created_at": task.created_at,
        "updated_at": task.updated_at,
        "assignee_ids": [link.user_id for link in task.assignee_links],
    }


def _ai_was_accepted(ai_log, description: str | None, subtasks) -> bool:
    try:
        suggestion = json.loads(ai_log.ai_response)
        suggested_subtasks = [
            {"title": item.get("title"), "description": item.get("description")}
            for item in suggestion.get("subtasks", [])
        ]
        submitted_subtasks = [
            {"title": item.title.strip(), "description": item.description}
            for item in subtasks
        ]
        return (
            description == suggestion.get("description")
            and submitted_subtasks == suggested_subtasks
        )
    except (ValueError, TypeError, AttributeError):
        return False


def _save_ai_log(db: Session, task: Task, ai_log, description: str | None, subtasks) -> None:
    if ai_log is None:
        return
    db.add(
        AiLog(
            task_id=task.id,
            prompt_sent=ai_log.prompt_sent,
            ai_response=ai_log.ai_response,
            was_accepted=_ai_was_accepted(ai_log, description, subtasks),
        )
    )


@router.get("", response_model=list[TaskRead])
def list_tasks(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[dict]:
    _require_project_member(db, project_id, current_user.id)
    tasks = list(
        db.scalars(
            select(Task)
            .where(Task.project_id == project_id)
            .order_by(Task.created_at.desc(), Task.id.desc())
        ).all()
    )
    return [_task_response(task) for task in tasks]


@router.post("", response_model=TaskRead, status_code=status.HTTP_201_CREATED)
def create_task(
    project_id: int,
    payload: TaskCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    _require_project_member(db, project_id, current_user.id)
    task = Task(
        project_id=project_id,
        title=payload.title,
        description=payload.description,
        status=payload.status,
        priority=payload.priority,
        due_at=payload.due_at,
        due_timezone=payload.due_timezone,
        created_by_id=current_user.id,
        completed_at=(
            datetime.now(timezone.utc).replace(tzinfo=None)
            if payload.status == TaskStatus.DONE
            else None
        ),
    )
    db.add(task)
    db.flush()
    _sync_assignees(db, project_id, task, payload.assignee_ids)
    if payload.status == TaskStatus.DONE:
        task.completed_at = datetime.now(timezone.utc).replace(tzinfo=None)
    record_event(
        db,
        actor_id=current_user.id,
        project_id=project_id,
        action="task_created",
        details={"title": task.title, "status": task.status.value},
        task=task,
        notification_message="You were assigned a task." if payload.assignee_ids else None,
        recipient_ids=set(payload.assignee_ids),
    )
    for draft in payload.subtasks:
        subtask = Subtask(
            task_id=task.id,
            title=draft.title,
            description=draft.description,
            is_ai_generated=draft.is_ai_generated,
        )
        db.add(subtask)
        db.flush()
        record_event(
            db,
            actor_id=current_user.id,
            project_id=project_id,
            action="subtask_created",
            details={"title": subtask.title},
            task=task,
            subtask_id=subtask.id,
        )
    _save_ai_log(db, task, payload.ai_log, task.description, payload.subtasks)
    db.commit()
    db.refresh(task)
    return _task_response(task)


@router.put("/{task_id}", response_model=TaskRead)
def update_task(
    project_id: int,
    task_id: int,
    payload: TaskUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    task = _get_task(db, project_id, task_id, current_user.id)
    changes = payload.model_dump(
        exclude_unset=True, exclude={"subtasks", "ai_log", "ai_log_id"}
    )
    if not changes:
        raise HTTPException(
            status_code=422,
            detail="Provide at least one task field to update.",
        )

    old_status = task.status
    old_assignees = {link.user_id for link in task.assignee_links}
    assignee_ids = changes.pop("assignee_ids", None)
    new_subtasks = payload.subtasks if "subtasks" in payload.model_fields_set else None
    ai_log = payload.ai_log
    ai_log_id = payload.ai_log_id
    changed_fields = {key: getattr(task, key) for key in changes}
    for field, value in changes.items():
        setattr(task, field, value)
    if assignee_ids is not None:
        _sync_assignees(db, project_id, task, assignee_ids)
        db.flush()
    if changed_fields:
        record_event(
            db,
            actor_id=current_user.id,
            project_id=project_id,
            action="task_updated",
            details={
                "title": task.title,
                "changes": {
                    key: {"before": changed_fields[key], "after": value}
                    for key, value in changes.items()
                },
            },
            task=task,
        )
    if "status" in changes:
        task.completed_at = (
            datetime.now(timezone.utc).replace(tzinfo=None)
            if task.status == TaskStatus.DONE
            else None
        )
        if old_status != task.status:
            record_event(
                db,
                actor_id=current_user.id,
                project_id=project_id,
                action="status_changed",
                details={"title": task.title, "before": old_status.value, "after": task.status.value},
                task=task,
                notification_message=f"Task '{task.title}' moved to {task.status.value.replace('_', ' ')}.",
            )
    if assignee_ids is not None:
        newly_assigned = set(assignee_ids) - old_assignees
        if newly_assigned:
            record_event(
                db,
                actor_id=current_user.id,
                project_id=project_id,
                action="task_assigned",
                details={"title": task.title, "user_ids": sorted(newly_assigned)},
                task=task,
                notification_message=f"You were assigned task '{task.title}'.",
                recipient_ids=newly_assigned,
            )
    if new_subtasks:
        for draft in new_subtasks:
            subtask = Subtask(
                task_id=task.id,
                title=draft.title,
                description=draft.description,
                is_ai_generated=draft.is_ai_generated,
            )
            db.add(subtask)
            db.flush()
            record_event(
                db,
                actor_id=current_user.id,
                project_id=project_id,
                action="subtask_created",
                details={"title": subtask.title},
                task=task,
                subtask_id=subtask.id,
            )
    _save_ai_log(db, task, ai_log, task.description, new_subtasks or [])
    if ai_log_id is not None:
        saved_ai_log = db.scalar(
            select(AiLog).where(AiLog.id == ai_log_id, AiLog.task_id == task.id)
        )
        if saved_ai_log is None:
            raise HTTPException(status_code=404, detail="AI suggestion log not found for this task.")
        saved_ai_log.was_accepted = _ai_was_accepted(
            saved_ai_log, task.description, new_subtasks or []
        )

    db.commit()
    db.refresh(task)
    return _task_response(task)


@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_task(
    project_id: int,
    task_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Response:
    task = _get_task(db, project_id, task_id, current_user.id)
    record_event(
        db,
        actor_id=current_user.id,
        project_id=project_id,
        action="task_deleted",
        details={"title": task.title},
    )
    subtask_ids = select(Subtask.id).where(Subtask.task_id == task.id)
    db.execute(delete(Comment).where(Comment.subtask_id.in_(subtask_ids)))
    db.execute(
        delete(Notification).where(
            or_(
                Notification.task_id == task.id,
                Notification.subtask_id.in_(subtask_ids),
            )
        )
    )
    db.execute(
        delete(ActivityLog).where(
            or_(
                ActivityLog.task_id == task.id,
                ActivityLog.subtask_id.in_(subtask_ids),
            )
        )
    )
    db.execute(delete(AiLog).where(AiLog.task_id == task.id))
    db.execute(delete(Subtask).where(Subtask.task_id == task.id))
    db.execute(delete(TaskAssignee).where(TaskAssignee.task_id == task.id))
    db.delete(task)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


def _get_task_by_id(db: Session, task_id: int, user_id: int) -> Task:
    task = db.scalar(
        select(Task)
        .join(Project, Project.id == Task.project_id)
        .outerjoin(ProjectMember, ProjectMember.project_id == Project.id)
        .where(
            Task.id == task_id,
            or_(Project.owner_id == user_id, ProjectMember.user_id == user_id),
        )
    )
    if task is None:
        raise HTTPException(status_code=404, detail="Task not found.")
    return task


@task_alias_router.put("/{task_id}", response_model=TaskRead)
def update_task_by_id(
    task_id: int,
    payload: TaskUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    task = _get_task_by_id(db, task_id, current_user.id)
    return update_task(task.project_id, task_id, payload, db, current_user)


@task_alias_router.patch("/{task_id}/status", response_model=TaskRead)
def update_task_status(
    task_id: int,
    payload: TaskStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    task = _get_task_by_id(db, task_id, current_user.id)
    return update_task(task.project_id, task_id, TaskUpdate(status=payload.status), db, current_user)


@task_alias_router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_task_by_id(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Response:
    task = _get_task_by_id(db, task_id, current_user.id)
    return delete_task(task.project_id, task_id, db, current_user)
