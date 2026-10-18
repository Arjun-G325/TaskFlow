from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, false, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Subtask(Base):
    __tablename__ = "subtasks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    task_id: Mapped[int] = mapped_column(ForeignKey("tasks.id"), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_done: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default=false())
    is_ai_generated: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default=false()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.now(), onupdate=func.now()
    )

    task: Mapped["Task"] = relationship(back_populates="subtasks")
    comments: Mapped[list["Comment"]] = relationship(back_populates="subtask")
    activities: Mapped[list["ActivityLog"]] = relationship(back_populates="subtask")
    notifications: Mapped[list["Notification"]] = relationship(back_populates="subtask")
