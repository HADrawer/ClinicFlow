import logging
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Literal

from .config import settings

logger = logging.getLogger("clinicflow.email")

DeliveryErrorType = Literal["configuration", "provider"] | None


@dataclass
class EmailSendResult:
    success: bool
    provider_message_id: str | None = None
    error: str | None = None
    error_type: DeliveryErrorType = None


class EmailProvider(ABC):
    @abstractmethod
    def send(
        self, *, to: str, subject: str, html: str, text: str
    ) -> EmailSendResult: ...


class ResendEmailProvider(EmailProvider):
    """Production provider backed by the Resend API."""

    def send(self, *, to: str, subject: str, html: str, text: str) -> EmailSendResult:
        if not settings.resend_configured:
            return EmailSendResult(
                success=False,
                error=(
                    "Email delivery is not configured: RESEND_API_KEY and "
                    "RESEND_FROM_EMAIL must both be set."
                ),
                error_type="configuration",
            )
        import resend

        resend.api_key = settings.resend_api_key
        try:
            response = resend.Emails.send(
                {
                    "from": settings.resend_from_email,
                    "to": [to],
                    "subject": subject,
                    "html": html,
                    "text": text,
                }
            )
        except Exception as exc:  # Resend SDK raises provider-specific exceptions
            logger.error("Resend delivery failed for invitation email: %s", exc)
            return EmailSendResult(success=False, error=str(exc), error_type="provider")
        message_id = response.get("id") if isinstance(response, dict) else None
        return EmailSendResult(success=True, provider_message_id=message_id)


class LoggingEmailProvider(EmailProvider):
    """Safe local-development default: never calls the network, always logs."""

    def send(self, *, to: str, subject: str, html: str, text: str) -> EmailSendResult:
        logger.info("Development email suppressed (not sent): to=%s subject=%s", to, subject)
        return EmailSendResult(success=True, provider_message_id="dev-local")


@dataclass
class RecordedEmail:
    to: str
    subject: str
    html: str
    text: str


class MockEmailProvider(EmailProvider):
    """Test double: records every call and returns a configurable outcome."""

    def __init__(self, *, fail: bool = False, error: str = "mock delivery failure"):
        self.fail = fail
        self.error = error
        self.sent: list[RecordedEmail] = []

    def send(self, *, to: str, subject: str, html: str, text: str) -> EmailSendResult:
        self.sent.append(RecordedEmail(to=to, subject=subject, html=html, text=text))
        if self.fail:
            return EmailSendResult(success=False, error=self.error, error_type="provider")
        return EmailSendResult(success=True, provider_message_id="mock-message-id")


def get_email_provider() -> EmailProvider:
    if settings.is_production:
        return ResendEmailProvider()
    if settings.resend_configured:
        return ResendEmailProvider()
    return LoggingEmailProvider()
