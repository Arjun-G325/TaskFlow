from datetime import date, datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import and_, func, or_, select
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user
from app.database import get_db
from app.models import ActivityLog, Project, ProjectMember, Task, TaskAssignee, TaskStatus, User

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

    status_rows = db.execute(
        select(Task.status, func.count(Task.id))
        .where(Task.project_id == project_id)
        .group_by(Task.status)
    ).all()
    status_counts = {task_status.value: count for task_status, count in status_rows}
    total = sum(status_counts.values())
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    overdue = db.scalar(
        select(func.count(Task.id)).where(
            Task.project_id == project_id,
            Task.due_at.is_not(None),
            Task.due_at < now,
            Task.status != TaskStatus.DONE,
        )
    ) or 0

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
    assignment_counts = db.execute(
        select(TaskAssignee.user_id, Task.status, func.count(Task.id))
        .join(Task, Task.id == TaskAssignee.task_id)
        .where(Task.project_id == project_id)
        .group_by(TaskAssignee.user_id, Task.status)
    ).all()
    for assignee_id, task_status, count in assignment_counts:
        if assignee_id in workload:
            workload[assignee_id][task_status.value] = count
            workload[assignee_id]["total"] += count

    # Count every transition to Done, including tasks later reopened. MySQL
    # YEARWEEK(..., 3) groups by ISO week with Monday as the first day.
    completion_event = and_(
        ActivityLog.project_id == project_id,
        or_(
            and_(
                ActivityLog.action == "status_changed",
                ActivityLog.details["after"].as_string() == TaskStatus.DONE.value,
            ),
            and_(
                ActivityLog.action == "task_created",
                ActivityLog.details["status"].as_string() == TaskStatus.DONE.value,
            ),
        ),
    )
    weekly_rows = db.execute(
        select(func.yearweek(ActivityLog.created_at, 3), func.count(ActivityLog.id))
        .where(completion_event)
        .group_by(func.yearweek(ActivityLog.created_at, 3))
        .order_by(func.yearweek(ActivityLog.created_at, 3))
    ).all()
    completed_week_counts = {}
    for iso_year_week, count in weekly_rows:
        iso_year_week = int(iso_year_week)
        week_start = date.fromisocalendar(iso_year_week // 100, iso_year_week % 100, 1)
        completed_week_counts[week_start.isoformat()] = count

    # Include currently completed legacy tasks with no completion event yet.
    has_completion_event = (
        select(ActivityLog.id)
        .where(
            ActivityLog.task_id == Task.id,
            or_(
                and_(
                    ActivityLog.action == "status_changed",
                    ActivityLog.details["after"].as_string() == TaskStatus.DONE.value,
                ),
                and_(
                    ActivityLog.action == "task_created",
                    ActivityLog.details["status"].as_string() == TaskStatus.DONE.value,
                ),
            ),
        )
        .exists()
    )
    legacy_weekly_rows = db.execute(
        select(func.yearweek(Task.completed_at, 3), func.count(Task.id))
        .where(
            Task.project_id == project_id,
            Task.completed_at.is_not(None),
            ~has_completion_event,
        )
        .group_by(func.yearweek(Task.completed_at, 3))
        .order_by(func.yearweek(Task.completed_at, 3))
    ).all()
    for iso_year_week, count in legacy_weekly_rows:
        iso_year_week = int(iso_year_week)
        week_start = date.fromisocalendar(iso_year_week // 100, iso_year_week % 100, 1)
        key = week_start.isoformat()
        completed_week_counts[key] = completed_week_counts.get(key, 0) + count

    return {
        "total_tasks": total,
        "counts_by_status": [
            {"status": task_status.value, "count": status_counts.get(task_status.value, 0)}
            for task_status in TaskStatus
        ],
        "completion_percentage": round(status_counts.get(TaskStatus.DONE.value, 0) * 100 / total, 1) if total else 0,
        "overdue_tasks": overdue,
        "workload_by_member": sorted(workload.values(), key=lambda row: row["username"].lower()),
        "completed_per_week": [
            {"week": week, "count": count}
            for week, count in sorted(completed_week_counts.items())
        ],
    }
