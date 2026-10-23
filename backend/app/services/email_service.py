import requests

from app.config import BREVO_API_KEY, BREVO_SENDER_EMAIL, BREVO_SENDER_NAME


BREVO_SEND_EMAIL_URL = "https://api.brevo.com/v3/smtp/email"


class EmailDeliveryError(Exception):
    """Raised when Brevo cannot accept a message for delivery."""


def send_verification_code(recipient_email: str, code: str) -> None:
    """Send a signup verification code through Brevo's transactional email API."""
    if not BREVO_API_KEY or not BREVO_SENDER_EMAIL:
        raise EmailDeliveryError(
            "Set BREVO_API_KEY and BREVO_SENDER_EMAIL in backend/.env."
        )

    message = {
        "sender": {
            "name": BREVO_SENDER_NAME,
            "email": BREVO_SENDER_EMAIL,
        },
        "to": [{"email": recipient_email}],
        "subject": "Your TaskFlow verification code",
        "textContent": (
            f"Your TaskFlow signup verification code is {code}. "
            "It expires in 10 minutes. If you did not request this code, "
            "you can ignore this email."
        ),
    }

    try:
        response = requests.post(
            BREVO_SEND_EMAIL_URL,
            headers={
                "api-key": BREVO_API_KEY,
                "accept": "application/json",
                "content-type": "application/json",
            },
            json=message,
            timeout=10,
        )
        response.raise_for_status()
    except requests.RequestException as exc:
        # Keep API credentials and provider response details out of user-facing errors.
        raise EmailDeliveryError("Brevo could not send the verification email.") from exc
