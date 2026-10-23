from passlib.context import CryptContext


password_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    """Turn a plain password into a one-way hash for database storage."""
    return password_context.hash(password)


def verify_password(password: str, password_hash: str | None) -> bool:
    """Check a submitted password against the stored hash."""
    if not password_hash:
        return False
    return password_context.verify(password, password_hash)
