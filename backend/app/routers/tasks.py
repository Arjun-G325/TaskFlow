from datetime import datetime, timezone

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
from app.schemas.tasks import TaskCreate, TaskRead, TaskUpdate

router = APIRouter(prefix="/projects/{project_id}/tasks", tags=["tasks"])


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
        "created_by_id": task.created_by_id,
        "created_at": task.created_at,
        "updated_at": task.updated_at,
        "assignee_ids": [link.user_id for link in task.assignee_links],
    }


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
    changes = payload.model_dump(exclude_unset=True)
    if not changes:
        raise HTTPException(
            status_code=422,
            detail="Provide at least one task field to update.",
        )

    assignee_ids = changes.pop("assignee_ids", None)
    for field, value in changes.items():
        setattr(task, field, value)
    if assignee_ids is not None:
        _sync_assignees(db, project_id, task, assignee_ids)
    if "status" in changes:
        task.completed_at = (
            datetime.now(timezone.utc).replace(tzinfo=None)
            if task.status == TaskStatus.DONE
            else None
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
