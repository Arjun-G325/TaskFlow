from pydantic import BaseModel, EmailStr, Field


class EmailCodeRequest(BaseModel):
    """Email address to which the signup verification code should be sent."""

    email: EmailStr


class EmailCodeVerifyRequest(BaseModel):
    """Email address and six-digit code entered by the user."""

    email: EmailStr
    code: str = Field(pattern=r"^\d{6}$")


class GoogleSignupRequest(BaseModel):
    """Google ID token received by the frontend after Google sign-in."""

    credential: str = Field(min_length=1)


class CompleteSignupRequest(BaseModel):
    """Verified signup token plus the credentials chosen in the signup form."""

    signup_token: str = Field(min_length=1)
    username: str = Field(
        min_length=3,
        max_length=50,
        pattern=r"^[A-Za-z0-9_]+$",
    )
    password: str = Field(min_length=8, max_length=128)


class LoginRequest(BaseModel):
    """Username and password submitted to the login endpoint."""

    username: str = Field(min_length=3, max_length=50)
    password: str = Field(min_length=1, max_length=128)
