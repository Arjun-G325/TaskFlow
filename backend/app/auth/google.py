from google.auth import exceptions
from google.auth.transport.requests import Request
from google.oauth2 import id_token

from app.config import GOOGLE_CLIENT_ID


class GoogleTokenError(Exception):
    """Raised when a Google credential is missing, invalid, or unverified."""


def verify_google_credential(credential: str) -> dict[str, str]:
    """Verify a Google ID token and return identity claims Google confirmed."""
    if not GOOGLE_CLIENT_ID:
        raise RuntimeError("GOOGLE_CLIENT_ID is not configured in backend/.env.")

    try:
        claims = id_token.verify_oauth2_token(
            credential,
            Request(),
            audience=GOOGLE_CLIENT_ID,
        )
    except (ValueError, exceptions.TransportError) as exc:
        raise GoogleTokenError("Google credential is invalid or expired.") from exc

    email = claims.get("email")
    google_id = claims.get("sub")
    if not isinstance(email, str) or not isinstance(google_id, str):
        raise GoogleTokenError("Google credential has no verified account identity.")
    if claims.get("email_verified") is not True:
        raise GoogleTokenError("Google has not verified this email address.")

    name = claims.get("name")
    picture = claims.get("picture")
    identity = {
        "email": email.strip().lower(),
        "google_id": google_id,
    }
    if isinstance(name, str):
        identity["name"] = name
    if isinstance(picture, str):
        identity["avatar_url"] = picture
    return identity
