from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from apscheduler.schedulers.background import BackgroundScheduler
from sqlalchemy import select

from app.database import SessionLocal
from app.models import Notification, Task, TaskAssignee, TaskStatus

scheduler = BackgroundScheduler(timezone="UTC")


def check_deadline_notifications(task_id: int | None = None) -> int:
    if SessionLocal is None:
        return 0
    now_utc = datetime.now(timezone.utc)
    with SessionLocal() as db:
        statement = select(Task).where(
            Task.due_at.is_not(None),
            Task.status != TaskStatus.DONE,
            Task.due_at <= now_utc.replace(tzinfo=None) + timedelta(hours=24),
        )
        if task_id is not None:
            statement = statement.where(Task.id == task_id)
        tasks = db.scalars(statement).all()
        created = 0
        for task in tasks:
            task_timezone = ZoneInfo(task.due_timezone)
            now_local = now_utc.astimezone(task_timezone)
            local_day_start_utc = now_local.replace(
                hour=0, minute=0, second=0, microsecond=0
            ).astimezone(timezone.utc).replace(tzinfo=None)
            deadline = task.due_at.replace(tzinfo=timezone.utc).astimezone(task_timezone)
            overdue = deadline < now_local
            kind = "overdue" if overdue else "due soon"
            prefix = f"Deadline {kind}:"
            already_sent = db.scalar(
                select(Notification.id).where(
                    Notification.task_id == task.id,
                    Notification.message.like(prefix + "%"),
                    Notification.created_at >= local_day_start_utc,
                ).limit(1)
            )
            if already_sent:
                continue

            recipient_ids = set(
                db.scalars(
                    select(TaskAssignee.user_id).where(TaskAssignee.task_id == task.id)
                ).all()
            )
            timezone_label = "IST" if task.due_timezone == "Asia/Kolkata" else "UTC"
            if overdue:
                recipient_ids.add(task.created_by_id)
            for user_id in recipient_ids:
                db.add(
                    Notification(
                        user_id=user_id,
                        task_id=task.id,
                        project_id=task.project_id,
                        message=(
                            f"{prefix} task '{task.title}' is due "
                            f"{deadline:%Y-%m-%d %H:%M} {timezone_label}."
                        ),
                    )
                )
                created += 1
        db.commit()
        return created


def start_scheduler() -> None:
    if SessionLocal is None or scheduler.running:
        return
    scheduler.add_job(
        check_deadline_notifications,
        trigger="interval",
        hours=1,
        id="task-deadline-notifications",
        replace_existing=True,
        max_instances=1,
    )
    scheduler.start()


def stop_scheduler() -> None:
    if scheduler.running:
        scheduler.shutdown(wait=False)
