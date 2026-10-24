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
    ProjectRole,
    Subtask,
    Task,
    TaskAssignee,
    User,
)
from app.schemas.projects import (
    ProjectCreate,
    ProjectMemberAdd,
    ProjectMemberRead,
    ProjectRead,
    ProjectUpdate,
)

router = APIRouter(prefix="/projects", tags=["projects"])


def _get_accessible_project(db: Session, project_id: int, user_id: int) -> Project:
    project = db.scalar(
        select(Project).where(
            Project.id == project_id,
            or_(
                Project.owner_id == user_id,
                Project.members.any(ProjectMember.user_id == user_id),
            ),
        )
    )
    if project is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found.",
        )
    return project


def _require_owner(project: Project, user_id: int) -> None:
    if project.owner_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the project owner can edit or delete this project.",
        )


@router.get("", response_model=list[ProjectRead])
def list_projects(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[Project]:
    """List projects owned by or shared with the signed-in user."""
    statement = (
        select(Project)
        .outerjoin(ProjectMember, ProjectMember.project_id == Project.id)
        .where(
            or_(
                Project.owner_id == current_user.id,
                ProjectMember.user_id == current_user.id,
            )
        )
        .order_by(Project.created_at.desc(), Project.id.desc())
    )
    return list(db.scalars(statement).unique().all())


@router.post("", response_model=ProjectRead, status_code=status.HTTP_201_CREATED)
def create_project(
    payload: ProjectCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Project:
    """Create a project owned by the signed-in user."""
    project = Project(
        name=payload.name,
        description=payload.description,
        owner_id=current_user.id,
    )
    db.add(project)
    db.flush()
    db.add(
        ProjectMember(
            project_id=project.id,
            user_id=current_user.id,
            role=ProjectRole.OWNER,
        )
    )
    db.commit()
    db.refresh(project)
    return project


@router.get("/{project_id}", response_model=ProjectRead)
def get_project(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Project:
    """View a project if the signed-in user owns it or is a member."""
    return _get_accessible_project(db, project_id, current_user.id)


@router.get("/{project_id}/members", response_model=list[ProjectMemberRead])
def list_project_members(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[dict]:
    _get_accessible_project(db, project_id, current_user.id)
    members = db.scalars(
        select(ProjectMember)
        .where(ProjectMember.project_id == project_id)
        .order_by(ProjectMember.role, ProjectMember.user_id)
    ).all()
    return [
        {
            "user_id": membership.user.id,
            "username": membership.user.username,
            "email": membership.user.email,
            "role": membership.role,
        }
        for membership in members
    ]


@router.post(
    "/{project_id}/members",
    response_model=ProjectMemberRead,
    status_code=status.HTTP_201_CREATED,
)
def add_project_member(
    project_id: int,
    payload: ProjectMemberAdd,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    project = _get_accessible_project(db, project_id, current_user.id)
    _require_owner(project, current_user.id)

    email = str(payload.email).strip().lower()
    member = db.scalar(select(User).where(User.email == email))
    if member is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No TaskFlow account uses that email address.",
        )
    existing = db.get(ProjectMember, (project_id, member.id))
    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="That user is already a project member.",
        )

    membership = ProjectMember(
        project_id=project_id,
        user_id=member.id,
        role=ProjectRole.MEMBER,
    )
    db.add(membership)
    db.commit()
    return {
        "user_id": member.id,
        "username": member.username,
        "email": member.email,
        "role": ProjectRole.MEMBER,
    }


@router.delete("/{project_id}/members/{member_user_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_project_member(
    project_id: int,
    member_user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Response:
    """Remove a member and their task assignments from an owned project."""
    project = _get_accessible_project(db, project_id, current_user.id)
    _require_owner(project, current_user.id)
    if member_user_id == project.owner_id:
        raise HTTPException(status_code=400, detail="The project owner cannot be removed.")

    membership = db.get(ProjectMember, (project_id, member_user_id))
    if membership is None:
        raise HTTPException(status_code=404, detail="Project member not found.")

    task_ids = select(Task.id).where(Task.project_id == project_id)
    db.execute(
        delete(TaskAssignee).where(
            TaskAssignee.task_id.in_(task_ids),
            TaskAssignee.user_id == member_user_id,
        )
    )
    db.delete(membership)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.put("/{project_id}", response_model=ProjectRead)
def update_project(
    project_id: int,
    payload: ProjectUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Project:
    """Update a project's name and/or description; only its owner may edit it."""
    project = _get_accessible_project(db, project_id, current_user.id)
    _require_owner(project, current_user.id)

    changes = payload.model_dump(exclude_unset=True)
    if not changes:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Provide a project name or description to update.",
        )

    for field, value in changes.items():
        setattr(project, field, value)

    db.commit()
    db.refresh(project)
    return project


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Response:
    """Delete an owned project and its dependent project data."""
    project = _get_accessible_project(db, project_id, current_user.id)
    _require_owner(project, current_user.id)

    task_ids = select(Task.id).where(Task.project_id == project.id)
    subtask_ids = select(Subtask.id).where(Subtask.task_id.in_(task_ids))

    # Remove rows that reference subtasks and tasks before removing their parents.
    db.execute(delete(Comment).where(Comment.subtask_id.in_(subtask_ids)))
    db.execute(
        delete(Notification).where(
            or_(
                Notification.project_id == project.id,
                Notification.task_id.in_(task_ids),
                Notification.subtask_id.in_(subtask_ids),
            )
        )
    )
    db.execute(delete(ActivityLog).where(ActivityLog.project_id == project.id))
    db.execute(delete(AiLog).where(AiLog.task_id.in_(task_ids)))
    db.execute(delete(Subtask).where(Subtask.task_id.in_(task_ids)))
    db.execute(delete(TaskAssignee).where(TaskAssignee.task_id.in_(task_ids)))
    db.execute(delete(Task).where(Task.project_id == project.id))
    db.execute(delete(ProjectMember).where(ProjectMember.project_id == project.id))
    db.execute(delete(Project).where(Project.id == project.id))
    db.commit()

    return Response(status_code=status.HTTP_204_NO_CONTENT)
