from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers.auth import router as auth_router
from app.routers.collaboration import subtask_router, task_router
from app.routers.projects import router as projects_router
from app.routers.tasks import router as tasks_router, task_alias_router
from app.routers.analytics import router as analytics_router
from app.routers.activity import router as activity_router
from app.routers.notifications import router as notifications_router
from app.routers.ai import router as ai_router
from app.config import FRONTEND_ORIGINS
from app.services.scheduler import start_scheduler, stop_scheduler


@asynccontextmanager
async def lifespan(_app: FastAPI):
    start_scheduler()
    try:
        yield
    finally:
        stop_scheduler()


app = FastAPI(title="TaskFlow API", version="0.1.0", lifespan=lifespan)
app.include_router(auth_router)
app.include_router(projects_router)
app.include_router(tasks_router)
app.include_router(task_alias_router)
app.include_router(task_router)
app.include_router(subtask_router)
app.include_router(activity_router)
app.include_router(analytics_router)
app.include_router(notifications_router)
app.include_router(ai_router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=FRONTEND_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health_check() -> dict[str, str]:
    return {"status": "ok"}
