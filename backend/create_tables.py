"""Create any missing database tables defined by the SQLAlchemy models.

Run from the backend directory with:
    python create_tables.py

The database URL is loaded from backend/.env. This script is safe to rerun:
SQLAlchemy creates missing tables and leaves existing tables/data untouched.
"""

from sqlalchemy import inspect

from app.database import Base, engine
import app.models  # noqa: F401 - registers all models with Base.metadata


def main() -> None:
    if engine is None:
        raise SystemExit(
            "DATABASE_URL is not configured. Set it in backend/.env first."
        )

    Base.metadata.create_all(bind=engine)

    expected_tables = set(Base.metadata.tables)
    existing_tables = set(inspect(engine).get_table_names())
    missing_tables = expected_tables - existing_tables
    if missing_tables:
        raise SystemExit(
            "Table creation did not complete. Missing: "
            + ", ".join(sorted(missing_tables))
        )

    print(f"Verified {len(expected_tables)} model tables:")
    for table_name in sorted(expected_tables):
        print(f"- {table_name}")


if __name__ == "__main__":
    main()
