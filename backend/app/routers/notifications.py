from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user
from app.database import get_db
from app.models import Notification, User

router = APIRouter(prefix="/notifications", tags=["notifications"])


def _notification(item: Notification) -> dict:
    return {
        "id": item.id,
        "task_id": item.task_id,
        "subtask_id": item.subtask_id,
        "project_id": item.project_id,
        "message": item.message,
        "is_read": item.is_read,
        "created_at": item.created_at,
    }


@router.get("")
def list_notifications(
    unread_only: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    unread_count = db.scalar(
        select(func.count(Notification.id)).where(
            Notification.user_id == current_user.id,
            Notification.is_read.is_(False),
        )
    ) or 0
    statement = select(Notification).where(Notification.user_id == current_user.id)
    if unread_only:
        statement = statement.where(Notification.is_read.is_(False))
    items = db.scalars(
        statement.order_by(Notification.created_at.desc(), Notification.id.desc()).limit(100)
    ).all()
    return {"items": [_notification(item) for item in items], "unread_count": unread_count}


@router.patch("/{notification_id}/read")
def mark_read(
    notification_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    item = db.scalar(
        select(Notification).where(
            Notification.id == notification_id,
            Notification.user_id == current_user.id,
        )
    )
    if item is None:
        raise HTTPException(status_code=404, detail="Notification not found.")
    item.is_read = True
    db.commit()
    return _notification(item)


@router.post("/read-all")
def mark_all_read(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict[str, int]:
    result = db.execute(
        update(Notification)
        .where(Notification.user_id == current_user.id, Notification.is_read.is_(False))
        .values(is_read=True)
    )
    db.commit()
    return {"updated": result.rowcount or 0}
