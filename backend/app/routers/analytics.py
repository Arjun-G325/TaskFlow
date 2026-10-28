from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user
from app.database import get_db
from app.models import Project, ProjectMember, Task, TaskAssignee, TaskStatus, User

router = APIRouter(prefix="/projects/{project_id}/analytics", tags=["analytics"])


@router.get("")
def project_analytics(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    project = db.scalar(
        select(Project).where(
            Project.id == project_id,
            or_(Project.owner_id == current_user.id,
                Project.members.any(ProjectMember.user_id == current_user.id)),
        )
    )
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found.")

    tasks = list(db.scalars(select(Task).where(Task.project_id == project_id)).all())
    total = len(tasks)
    status_counts = Counter(task.status.value for task in tasks)
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    overdue = sum(
        1 for task in tasks
        if task.due_at is not None and task.due_at < now and task.status != TaskStatus.DONE
    )

    membership_rows = db.execute(
        select(ProjectMember.user_id, User.username)
        .join(User, User.id == ProjectMember.user_id)
        .where(ProjectMember.project_id == project_id)
    ).all()
    workload = {
        user_id: {"user_id": user_id, "username": username,
                  "todo": 0, "in_progress": 0, "done": 0, "total": 0}
        for user_id, username in membership_rows
    }
    assignments = db.execute(
        select(TaskAssignee.user_id, Task.status)
        .join(Task, Task.id == TaskAssignee.task_id)
        .where(Task.project_id == project_id)
    ).all()
    for assignee_id, task_status in assignments:
        if assignee_id in workload:
            workload[assignee_id][task_status.value] += 1
            workload[assignee_id]["total"] += 1

    weekly = defaultdict(int)
    for task in tasks:
        if task.completed_at:
            completed = task.completed_at
            week_start = (completed - timedelta(days=completed.weekday())).date().isoformat()
            weekly[week_start] += 1

    return {
        "total_tasks": total,
        "counts_by_status": [
            {"status": status.value, "count": status_counts.get(status.value, 0)}
            for status in TaskStatus
        ],
        "completion_percentage": round(status_counts.get(TaskStatus.DONE.value, 0) * 100 / total, 1) if total else 0,
        "overdue_tasks": overdue,
        "workload_by_member": sorted(workload.values(), key=lambda row: row["username"].lower()),
        "completed_per_week": [
            {"week": week, "count": weekly[week]} for week in sorted(weekly)
        ],
    }
