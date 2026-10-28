from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user
from app.database import get_db
from app.models import ActivityLog, Project, ProjectMember, User

router = APIRouter(prefix="/projects/{project_id}/activity", tags=["activity"])


@router.get("")
def project_activity(
    project_id: int,
    user_id: int | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[dict]:
    accessible = db.scalar(
        select(Project.id).where(
            Project.id == project_id,
            or_(Project.owner_id == current_user.id,
                Project.members.any(ProjectMember.user_id == current_user.id)),
        )
    )
    if accessible is None:
        raise HTTPException(status_code=404, detail="Project not found.")
    statement = (
        select(ActivityLog, User.username)
        .join(User, User.id == ActivityLog.user_id)
        .where(ActivityLog.project_id == project_id)
        .order_by(ActivityLog.created_at.desc(), ActivityLog.id.desc())
    )
    if user_id is not None:
        statement = statement.where(ActivityLog.user_id == user_id)
    rows = db.execute(statement.limit(250)).all()
    return [
        {
            "id": item.id,
            "project_id": item.project_id,
            "task_id": item.task_id,
            "subtask_id": item.subtask_id,
            "user_id": item.user_id,
            "username": username,
            "action": item.action,
            "details": item.details,
            "created_at": item.created_at,
        }
        for item, username in rows
    ]
