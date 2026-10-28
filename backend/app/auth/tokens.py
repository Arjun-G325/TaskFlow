from datetime import datetime, timedelta, timezone

from jose import JWTError, jwt

from app.config import SECRET_KEY

ALGORITHM = "HS256"
SIGNUP_TOKEN_LIFETIME = timedelta(minutes=10)
ACCESS_TOKEN_LIFETIME = timedelta(hours=1)


def create_access_token(user_id: int) -> str:
    """Create a one-hour token representing a signed-in user."""
    if not SECRET_KEY:
        raise RuntimeError("SECRET_KEY is not configured in backend/.env.")

    claims = {
        "sub": str(user_id),
        "purpose": "access",
        "exp": datetime.now(timezone.utc) + ACCESS_TOKEN_LIFETIME,
    }
    return jwt.encode(claims, SECRET_KEY, algorithm=ALGORITHM)


def read_access_token(token: str) -> int:
    """Validate an access token and return the ID of its user."""
    if not SECRET_KEY:
        raise RuntimeError("SECRET_KEY is not configured in backend/.env.")

    try:
        claims = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError as exc:
        raise ValueError("Access token is invalid or expired.") from exc

    if claims.get("purpose") != "access":
        raise ValueError("This token is not an access token.")

    subject = claims.get("sub")
    if not isinstance(subject, str) or not subject.isdecimal():
        raise ValueError("Access token has an invalid user ID.")

    return int(subject)


def create_signup_token(
    email: str,
    verification_id: int | None = None,
    *,
    google_id: str | None = None,
) -> str:
    """Create a short-lived token proving email-code or Google verification."""
    if not SECRET_KEY:
        raise RuntimeError("SECRET_KEY is not configured in backend/.env.")

    if (verification_id is None) == (google_id is None):
        raise ValueError("Provide either verification_id or google_id.")

    claims: dict[str, str | int | datetime] = {
        "sub": email,
        "purpose": "signup",
        "exp": datetime.now(timezone.utc) + SIGNUP_TOKEN_LIFETIME,
    }
    if verification_id is not None:
        claims["method"] = "email"
        claims["verification_id"] = verification_id
    else:
        assert google_id is not None
        claims["method"] = "google"
        claims["google_id"] = google_id
    return jwt.encode(claims, SECRET_KEY, algorithm=ALGORITHM)


def read_signup_token(token: str) -> dict:
    """Decode a signup token and reject tokens meant for another purpose."""
    if not SECRET_KEY:
        raise RuntimeError("SECRET_KEY is not configured in backend/.env.")

    try:
        claims = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError as exc:
        raise ValueError("Signup token is invalid or expired.") from exc

    if claims.get("purpose") != "signup":
        raise ValueError("This token is not for signup.")
    if not isinstance(claims.get("sub"), str):
        raise ValueError("Signup token has no email address.")
    method = claims.get("method")
    if method == "email" and not isinstance(claims.get("verification_id"), int):
        raise ValueError("Email signup token has no verification record ID.")
    if method == "google" and not isinstance(claims.get("google_id"), str):
        raise ValueError("Google signup token has no Google account ID.")
    if method not in {"email", "google"}:
        raise ValueError("Signup token has an unknown verification method.")
    return claims
