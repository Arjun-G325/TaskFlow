from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import DATABASE_URL


class Base(DeclarativeBase):
    """Base class for all SQLAlchemy models."""


engine = (
    create_engine(DATABASE_URL, pool_pre_ping=True)
    if DATABASE_URL
    else None
)

SessionLocal = (
    sessionmaker(bind=engine, autoflush=False, autocommit=False)
    if engine
    else None
)


def get_db() -> Generator[Session, None, None]:
    """Yield a database session for a request, closing it afterward."""
    if SessionLocal is None:
        raise RuntimeError(
            "DATABASE_URL is not configured. Create backend/.env from "
            "backend/.env.example and set DATABASE_URL."
        )

    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
