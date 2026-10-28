from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import delete, or_, select
from sqlalchemy.orm import Session, joinedload

from app.auth.dependencies import get_current_user
from app.database import get_db
from app.models import ActivityLog, Comment, Notification, Project, ProjectMember, Subtask, Task, User
from app.schemas.collaboration import (
    CommentCreate,
    CommentRead,
    SubtaskCreate,
    SubtaskDetail,
    SubtaskRead,
    SubtaskUpdate,
    TaskDetail,
)
from app.services.event_service import record_event

task_router = APIRouter(prefix="/tasks", tags=["task details"])
subtask_router = APIRouter(prefix="/subtasks", tags=["subtasks"])


def _get_accessible_task(db: Session, task_id: int, user_id: int) -> Task:
    task = db.scalars(
        select(Task)
        .join(Project, Project.id == Task.project_id)
        .outerjoin(ProjectMember, ProjectMember.project_id == Project.id)
        .where(
            Task.id == task_id,
            or_(Project.owner_id == user_id, ProjectMember.user_id == user_id),
        )
        .options(joinedload(Task.creator), joinedload(Task.assignee_links), joinedload(Task.subtasks))
    ).unique().one_or_none()
    if task is None:
        raise HTTPException(status_code=404, detail="Task not found.")
    return task


def _get_accessible_subtask(db: Session, subtask_id: int, user_id: int) -> tuple[Subtask, Task]:
    result = db.execute(
        select(Subtask, Task)
        .join(Task, Task.id == Subtask.task_id)
        .join(Project, Project.id == Task.project_id)
        .outerjoin(ProjectMember, ProjectMember.project_id == Project.id)
        .where(
            Subtask.id == subtask_id,
            or_(Project.owner_id == user_id, ProjectMember.user_id == user_id),
        )
    ).first()
    if result is None:
        raise HTTPException(status_code=404, detail="Subtask not found.")
    return result[0], result[1]


@task_router.get("/{task_id}", response_model=TaskDetail)
def get_task_detail(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    task = _get_accessible_task(db, task_id, current_user.id)
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
        "created_by_username": task.creator.username,
        "created_at": task.created_at,
        "updated_at": task.updated_at,
        "assignee_ids": [link.user_id for link in task.assignee_links],
        "subtasks": sorted(task.subtasks, key=lambda item: item.id),
    }


@task_router.post("/{task_id}/subtasks", response_model=SubtaskRead, status_code=status.HTTP_201_CREATED)
def create_subtask(
    task_id: int,
    payload: SubtaskCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Subtask:
    task = _get_accessible_task(db, task_id, current_user.id)
    subtask = Subtask(
        task_id=task.id,
        title=payload.title,
        description=payload.description,
        is_ai_generated=payload.is_ai_generated,
    )
    db.add(subtask)
    db.flush()
    record_event(
        db,
        actor_id=current_user.id,
        project_id=task.project_id,
        action="subtask_created",
        details={"title": subtask.title},
        task=task,
        subtask_id=subtask.id,
    )
    db.commit()
    db.refresh(subtask)
    return subtask


@subtask_router.get("/{subtask_id}", response_model=SubtaskDetail)
def get_subtask_detail(
    subtask_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    subtask, task = _get_accessible_subtask(db, subtask_id, current_user.id)
    comments = db.execute(
        select(Comment, User.username)
        .join(User, User.id == Comment.user_id)
        .where(Comment.subtask_id == subtask_id)
        .order_by(Comment.created_at.asc(), Comment.id.asc())
    ).all()
    history = db.execute(
        select(ActivityLog, User.username)
        .join(User, User.id == ActivityLog.user_id)
        .where(ActivityLog.subtask_id == subtask_id)
        .order_by(ActivityLog.created_at.asc(), ActivityLog.id.asc())
    ).all()
    return {
        "id": subtask.id,
        "task_id": task.id,
        "title": subtask.title,
        "description": subtask.description,
        "is_done": subtask.is_done,
        "is_ai_generated": subtask.is_ai_generated,
        "updated_at": subtask.updated_at,
        "project_id": task.project_id,
        "task_title": task.title,
        "comments": [
            {"id": c.id, "subtask_id": c.subtask_id, "user_id": c.user_id,
             "username": username, "body": c.body, "created_at": c.created_at}
            for c, username in comments
        ],
        "history": [
            {"action": a.action, "user_id": a.user_id, "username": username,
             "details": a.details, "created_at": a.created_at}
            for a, username in history
        ],
    }


@subtask_router.put("/{subtask_id}", response_model=SubtaskRead)
def update_subtask(
    subtask_id: int,
    payload: SubtaskUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Subtask:
    subtask, task = _get_accessible_subtask(db, subtask_id, current_user.id)
    changes = payload.model_dump(exclude_unset=True)
    if not changes:
        raise HTTPException(status_code=422, detail="Provide subtask fields to update.")
    before = {field: getattr(subtask, field) for field in changes}
    for field, value in changes.items():
        setattr(subtask, field, value)
    record_event(
        db,
        actor_id=current_user.id,
        project_id=task.project_id,
        action="subtask_updated",
        details={
            "title": subtask.title,
            "changes": {
                field: {"before": before[field], "after": value}
                for field, value in changes.items()
            },
        },
        task=task,
        subtask_id=subtask.id,
        notification_message=f"Subtask '{subtask.title}' was updated.",
    )
    db.commit()
    db.refresh(subtask)
    return subtask


@subtask_router.patch("/{subtask_id}", response_model=SubtaskRead)
def patch_subtask(
    subtask_id: int,
    payload: SubtaskUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Subtask:
    return update_subtask(subtask_id, payload, db, current_user)


@subtask_router.delete("/{subtask_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_subtask(
    subtask_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Response:
    subtask, task = _get_accessible_subtask(db, subtask_id, current_user.id)
    record_event(
        db,
        actor_id=current_user.id,
        project_id=task.project_id,
        action="subtask_deleted",
        details={"title": subtask.title},
        task=task,
        notification_message=f"Subtask '{subtask.title}' was deleted.",
    )
    db.execute(delete(Comment).where(Comment.subtask_id == subtask_id))
    db.execute(delete(Notification).where(Notification.subtask_id == subtask_id))
    db.execute(delete(ActivityLog).where(ActivityLog.subtask_id == subtask_id))
    db.delete(subtask)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@subtask_router.get("/{subtask_id}/comments", response_model=list[CommentRead])
def list_comments(
    subtask_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[dict]:
    _get_accessible_subtask(db, subtask_id, current_user.id)
    rows = db.execute(
        select(Comment, User.username)
        .join(User, User.id == Comment.user_id)
        .where(Comment.subtask_id == subtask_id)
        .order_by(Comment.created_at.asc(), Comment.id.asc())
    ).all()
    return [
        {"id": c.id, "subtask_id": c.subtask_id, "user_id": c.user_id,
         "username": username, "body": c.body, "created_at": c.created_at}
        for c, username in rows
    ]


@subtask_router.post("/{subtask_id}/comments", response_model=CommentRead, status_code=status.HTTP_201_CREATED)
def add_comment(
    subtask_id: int,
    payload: CommentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    subtask, task = _get_accessible_subtask(db, subtask_id, current_user.id)
    comment = Comment(subtask_id=subtask.id, user_id=current_user.id, body=payload.body)
    db.add(comment)
    db.flush()
    record_event(
        db,
        actor_id=current_user.id,
        project_id=task.project_id,
        action="comment_added",
        details={"title": subtask.title, "comment_id": comment.id},
        task=task,
        subtask_id=subtask.id,
        notification_message=f"New comment on subtask '{subtask.title}'.",
    )
    db.commit()
    db.refresh(comment)
    return {
        "id": comment.id,
        "subtask_id": comment.subtask_id,
        "user_id": comment.user_id,
        "username": current_user.username,
        "body": comment.body,
        "created_at": comment.created_at,
    }
