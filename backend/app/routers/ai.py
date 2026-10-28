from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user
from app.database import get_db
from app.models import AiLog, User
from app.routers.collaboration import _get_accessible_task
from app.schemas.collaboration import AiAssistRead, AiAssistRequest
from app.services.ai_agent import AiAssistUnavailable, generate_task_draft

router = APIRouter(prefix="/tasks", tags=["AI Assist"])


@router.post("/{task_id}/ai-assist", response_model=AiAssistRead)
def task_ai_assist(
    task_id: int,
    payload: AiAssistRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AiAssistRead:
    task = _get_accessible_task(db, task_id, current_user.id)
    try:
        draft = generate_task_draft(payload.title)
    except AiAssistUnavailable as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    log = AiLog(
        task_id=task.id,
        prompt_sent=draft.prompt_sent,
        ai_response=draft.ai_response,
        was_accepted=None,
    )
    db.add(log)
    db.commit()
    db.refresh(log)
    response_data = draft.model_dump()
    response_data["ai_log_id"] = log.id
    return AiAssistRead(**response_data)
