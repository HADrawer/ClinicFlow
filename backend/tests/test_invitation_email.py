import pytest
from sqlalchemy import select

from app.config import settings
from app.email_provider import MockEmailProvider, get_email_provider
from app.main import app
from app.models import StaffInvitation
from conftest import TestingSession


@pytest.fixture
def mock_provider():
    provider = MockEmailProvider()
    app.dependency_overrides[get_email_provider] = lambda: provider
    yield provider
    app.dependency_overrides.pop(get_email_provider, None)


def test_invitation_delivery_succeeds_with_mock_provider_and_correct_link(
    client, auth, mock_provider
):
    created = client.post(
        "/api/invitations",
        headers=auth,
        json={
            "email": "resend.mock@example.test",
            "full_name": "Mock Delivery",
            "role": "receptionist",
        },
    )
    assert created.status_code == 201, created.text
    body = created.json()
    assert body["delivery_status"] == "sent"
    assert body["delivery_attempts"] == 1
    assert body["sent_at"] is not None
    assert body["last_delivery_error"] is None

    token = body["demo_token"]
    assert token
    expected_link = f"{settings.app_base_url}/invite/{token}"

    assert len(mock_provider.sent) == 1
    email = mock_provider.sent[0]
    assert email.to == "resend.mock@example.test"
    assert expected_link in email.html
    assert expected_link in email.text
    assert "Test Clinic" in email.subject


def test_resend_sends_a_new_email_and_increments_attempts(client, auth, mock_provider):
    created = client.post(
        "/api/invitations",
        headers=auth,
        json={
            "email": "resend.twice@example.test",
            "full_name": "Resend Twice",
            "role": "nurse",
        },
    ).json()
    first_token = created["demo_token"]

    resent = client.post(
        f"/api/invitations/{created['id']}/resend", headers=auth
    )
    assert resent.status_code == 200, resent.text
    resent_body = resent.json()
    second_token = resent_body["demo_token"]

    assert second_token != first_token
    assert resent_body["delivery_status"] == "sent"
    assert resent_body["delivery_attempts"] == 2
    assert len(mock_provider.sent) == 2
    assert first_token in mock_provider.sent[0].text
    assert second_token in mock_provider.sent[1].text


def test_provider_failure_marks_delivery_failed_but_creates_invitation(
    client, auth, mock_provider
):
    mock_provider.fail = True
    mock_provider.error = "upstream SMTP timeout"

    created = client.post(
        "/api/invitations",
        headers=auth,
        json={
            "email": "resend.failure@example.test",
            "full_name": "Failure Case",
            "role": "receptionist",
        },
    )
    assert created.status_code == 201, created.text
    body = created.json()
    assert body["delivery_status"] == "failed"
    assert body["last_delivery_error"] == "upstream SMTP timeout"
    assert body["delivery_attempts"] == 1
    assert body["status"] == "pending"
    # The invitation itself is still usable even though delivery failed.
    assert body["demo_token"]


def test_missing_production_config_returns_error_and_preserves_state(
    client, auth, monkeypatch
):
    monkeypatch.setattr(settings, "environment", "production")
    monkeypatch.setattr(settings, "resend_api_key", None)
    monkeypatch.setattr(settings, "resend_from_email", None)

    response = client.post(
        "/api/invitations",
        headers=auth,
        json={
            "email": "resend.noconfig@example.test",
            "full_name": "No Config",
            "role": "receptionist",
        },
    )
    assert response.status_code == 502
    assert "not configured" in response.json()["detail"].lower()

    with TestingSession() as db:
        invitation = db.scalar(
            select(StaffInvitation).where(
                StaffInvitation.email == "resend.noconfig@example.test"
            )
        )
        assert invitation.delivery_status.value == "failed"
        assert invitation.delivery_attempts == 1
        assert invitation.last_delivery_error is not None
        assert invitation.token_hash is not None
        assert len(invitation.token_hash) == 64


def test_production_response_never_exposes_raw_token(client, auth, mock_provider, monkeypatch):
    monkeypatch.setattr(settings, "environment", "production")

    created = client.post(
        "/api/invitations",
        headers=auth,
        json={
            "email": "resend.prodtoken@example.test",
            "full_name": "Prod Token",
            "role": "receptionist",
        },
    )
    assert created.status_code == 201, created.text
    body = created.json()
    assert body["delivery_status"] == "sent"
    assert body.get("demo_token") is None

    with TestingSession() as db:
        invitation = db.scalar(
            select(StaffInvitation).where(
                StaffInvitation.email == "resend.prodtoken@example.test"
            )
        )
        raw_token = mock_provider.sent[0].text
        # The stored hash must never equal (or contain) the raw token text.
        assert invitation.token_hash not in raw_token
        assert len(invitation.token_hash) == 64


def test_delivery_status_persists_and_is_visible_on_list(client, auth, mock_provider):
    created = client.post(
        "/api/invitations",
        headers=auth,
        json={
            "email": "resend.liststatus@example.test",
            "full_name": "List Status",
            "role": "receptionist",
        },
    ).json()

    listing = client.get("/api/invitations", headers=auth)
    assert listing.status_code == 200
    row = next(item for item in listing.json() if item["id"] == created["id"])
    assert row["delivery_status"] == "sent"
    assert row["sent_at"] is not None
