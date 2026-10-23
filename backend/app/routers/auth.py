import hashlib
import hmac
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user
from app.auth.google import GoogleTokenError, verify_google_credential
from app.auth.passwords import hash_password, verify_password
from app.auth.tokens import create_access_token, create_signup_token, read_signup_token
from app.config import SECRET_KEY
from app.database import get_db
from app.models import EmailVerification, User
from app.schemas.auth import (
    CompleteSignupRequest,
    EmailCodeRequest,
    EmailCodeVerifyRequest,
    LoginRequest,
    GoogleSignupRequest,
)
from app.services.email_service import EmailDeliveryError, send_verification_code

router = APIRouter(prefix="/auth", tags=["auth"])

CODE_LIFETIME = timedelta(minutes=10)
RESEND_COOLDOWN = timedelta(seconds=60)
MAX_SENDS_PER_CODE_PERIOD = 5


def _code_hash(email: str, code: str) -> str:
    """Create a keyed hash so the six-digit code itself is not stored."""
    if not SECRET_KEY:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Authentication is not configured on the server.",
        )
    code_and_email = f"{email}:{code}".encode("utf-8")
    return hmac.new(
        SECRET_KEY.encode("utf-8"), code_and_email, hashlib.sha256
    ).hexdigest()


@router.post("/email-code", status_code=status.HTTP_202_ACCEPTED)
def send_signup_code(
    payload: EmailCodeRequest,
    db: Session = Depends(get_db),
) -> dict[str, str]:
    email = str(payload.email).strip().lower()
    generic_response = {
        "message": "If this email can be registered, a verification code has been sent."
    }

    # Do not reveal whether an account with this email already exists.
    existing_user = db.scalar(select(User.id).where(User.email == email))
    if existing_user:
        return generic_response

    now = datetime.now(timezone.utc).replace(tzinfo=None)
    verification = db.scalar(
        select(EmailVerification).where(EmailVerification.email == email)
    )

    if verification:
        if now - verification.last_sent_at < RESEND_COOLDOWN:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Please wait before requesting another code.",
            )
        if verification.expires_at > now and verification.send_count >= MAX_SENDS_PER_CODE_PERIOD:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many code requests. Try again after the current code expires.",
            )

    code = f"{secrets.randbelow(1_000_000):06d}"
    code_hash = _code_hash(email, code)

    if verification is None:
        verification = EmailVerification(
            email=email,
            code_hash=code_hash,
            expires_at=now + CODE_LIFETIME,
            last_sent_at=now,
            send_count=1,
            attempts=0,
        )
        db.add(verification)
    else:
        expired = verification.expires_at <= now
        verification.code_hash = code_hash
        verification.expires_at = now + CODE_LIFETIME
        verification.last_sent_at = now
        verification.send_count = 1 if expired else verification.send_count + 1
        verification.attempts = 0
        verification.verified_at = None
        verification.consumed_at = None

    try:
        # Flush first so a duplicate-email race is handled before sending mail.
        db.flush()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A code request is already being processed. Please try again.",
        ) from exc

    try:
        send_verification_code(email, code)
        db.commit()
    except EmailDeliveryError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="The verification email could not be sent. Please try again later.",
        ) from exc

    return generic_response


@router.post("/google")
def verify_google_signup(
    payload: GoogleSignupRequest,
    db: Session = Depends(get_db),
) -> dict[str, str]:
    try:
        identity = verify_google_credential(payload.credential)
    except GoogleTokenError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Google could not verify this sign-in. Try again.",
        ) from exc

    existing_user = db.scalar(
        select(User.id).where(User.email == identity["email"])
    )
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account already uses this email. Sign in to that account.",
        )

    signup_token = create_signup_token(
        identity["email"], google_id=identity["google_id"]
    )
    return {"email": identity["email"], "signup_token": signup_token}


@router.post("/email-code/verify")
def verify_signup_code(
    payload: EmailCodeVerifyRequest,
    db: Session = Depends(get_db),
) -> dict[str, str]:
    email = str(payload.email).strip().lower()
    verification = db.scalar(
        select(EmailVerification).where(EmailVerification.email == email)
    )
    now = datetime.now(timezone.utc).replace(tzinfo=None)

    if (
        verification is None
        or verification.consumed_at is not None
        or verification.expires_at <= now
        or verification.attempts >= 5
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The code is invalid or expired. Request a new code.",
        )

    verification.attempts += 1
    submitted_hash = _code_hash(email, payload.code)
    if not hmac.compare_digest(verification.code_hash, submitted_hash):
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The code is invalid or expired. Request a new code.",
        )

    verification.verified_at = now
    db.commit()

    signup_token = create_signup_token(email, verification.id)
    return {"email": email, "signup_token": signup_token}


@router.post("/register", status_code=status.HTTP_201_CREATED)
def complete_signup(
    payload: CompleteSignupRequest,
    db: Session = Depends(get_db),
) -> dict[str, str]:
    try:
        claims = read_signup_token(payload.signup_token)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Signup verification is invalid or expired. Verify your email again.",
        ) from exc

    email = claims["sub"]
    method = claims["method"]
    now = datetime.now(timezone.utc).replace(tzinfo=None)

    verification = None
    if method == "email":
        verification = db.get(EmailVerification, claims["verification_id"])
        if (
            verification is None
            or verification.email != email
            or verification.verified_at is None
            or verification.consumed_at is not None
            or verification.expires_at <= now
        ):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Signup verification is invalid, expired, or already used.",
            )

    username = payload.username.strip().lower()
    user = User(
        username=username,
        name=username,
        email=email,
        password_hash=hash_password(payload.password),
        google_id=claims.get("google_id") if method == "google" else None,
    )
    if verification is not None:
        verification.consumed_at = now
    db.add(user)

    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="That email or username is already registered.",
        ) from exc

    return {"message": "Account created. You can now log in."}


@router.post("/login")
def login(
    payload: LoginRequest,
    db: Session = Depends(get_db),
) -> dict[str, str]:
    username = payload.username.strip().lower()
    user = db.scalar(select(User).where(User.username == username))

    if user is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return {
        "access_token": create_access_token(user.id),
        "token_type": "bearer",
    }


@router.get("/me")
def get_my_account(current_user: User = Depends(get_current_user)) -> dict[str, str | int]:
    """Return basic account details for the currently authenticated user."""
    return {
        "id": current_user.id,
        "username": current_user.username,
        "email": current_user.email,
        "name": current_user.name,
    }
