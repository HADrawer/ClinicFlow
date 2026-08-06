from sqlalchemy import select

from app.models import User
from conftest import TestingSession


def login(client, email, password="password123"):
    response = client.post(
        "/api/auth/login", json={"email": email, "password": password}
    )
    assert response.status_code == 200, response.text
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def test_existing_clinic_is_not_forced_through_onboarding(client, auth):
    response = client.get("/api/clinics/me", headers=auth)
    assert response.status_code == 200, response.text
    assert response.json()["onboarding_completed"] is True


def test_newly_registered_clinic_starts_onboarding_incomplete(client):
    response = client.post(
        "/api/auth/register",
        json={
            "clinic_name": "Fresh Onboarding Clinic",
            "full_name": "New Owner",
            "email": "new.owner@example.test",
            "password": "password123",
            "phone": "+973 17222222",
        },
    )
    assert response.status_code == 201, response.text
    token = response.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    me = client.get("/api/clinics/me", headers=headers)
    assert me.status_code == 200
    assert me.json()["onboarding_completed"] is False

    completed = client.post("/api/clinics/me/onboarding/complete", headers=headers)
    assert completed.status_code == 200
    assert completed.json()["onboarding_completed"] is True

    reopened = client.post("/api/clinics/me/onboarding/reopen", headers=headers)
    assert reopened.status_code == 200
    assert reopened.json()["onboarding_completed"] is False


def test_invitation_with_multiple_permissions_is_stored_and_returned(client, auth):
    created = client.post(
        "/api/invitations",
        headers=auth,
        json={
            "email": "multi.perm@example.test",
            "full_name": "Multi Perm",
            "role": "receptionist",
            "permissions": ["patients.read", "billing.create", "waitlist.manage"],
        },
    )
    assert created.status_code == 201, created.text
    body = created.json()
    assert sorted(body["permissions"]) == [
        "billing.create",
        "patients.read",
        "waitlist.manage",
    ]

    listing = client.get("/api/invitations", headers=auth)
    row = next(item for item in listing.json() if item["id"] == body["id"])
    assert sorted(row["permissions"]) == sorted(body["permissions"])


def test_invitation_acceptance_transfers_permissions_to_staff_account(client, auth):
    created = client.post(
        "/api/invitations",
        headers=auth,
        json={
            "email": "accept.perm@example.test",
            "full_name": "Accept Perm",
            "role": "nurse",
            "permissions": ["orders.manage", "quality.manage"],
        },
    ).json()

    accepted = client.post(
        "/api/invitations/accept",
        json={
            "token": created["demo_token"],
            "password": "password123",
            "terms_accepted": True,
            "privacy_acknowledged": True,
        },
    )
    assert accepted.status_code == 200, accepted.text
    assert sorted(accepted.json()["permissions"]) == ["orders.manage", "quality.manage"]

    with TestingSession() as db:
        user = db.scalar(select(User).where(User.email == "accept.perm@example.test"))
        assert sorted(user.permissions) == ["orders.manage", "quality.manage"]


def test_revoked_invitation_cannot_be_accepted_and_grants_nothing(client, auth):
    created = client.post(
        "/api/invitations",
        headers=auth,
        json={
            "email": "revoked.perm@example.test",
            "full_name": "Revoked Perm",
            "role": "nurse",
            "permissions": ["orders.manage"],
        },
    ).json()
    revoke = client.post(f"/api/invitations/{created['id']}/revoke", headers=auth)
    assert revoke.status_code == 200

    accepted = client.post(
        "/api/invitations/accept",
        json={
            "token": created["demo_token"],
            "password": "password123",
            "terms_accepted": True,
            "privacy_acknowledged": True,
        },
    )
    assert accepted.status_code == 400
    with TestingSession() as db:
        user = db.scalar(select(User).where(User.email == "revoked.perm@example.test"))
        assert user is None


def test_permission_protected_endpoint_rejects_user_without_grant(client, auth):
    reception = login(client, "reception@example.test")
    denied = client.post(
        "/api/settings/services",
        headers=reception,
        json={"name": "Unauthorized Service", "price": 10, "duration_minutes": 15},
    )
    assert denied.status_code == 403


def test_granting_settings_manage_unlocks_the_protected_endpoint(client, auth):
    reception_id = next(
        row["id"]
        for row in client.get("/api/staff", headers=auth).json()
        if row["email"] == "reception@example.test"
    )
    grant = client.patch(
        f"/api/staff/{reception_id}/permissions",
        headers=auth,
        json={"permissions": ["settings.manage"]},
    )
    assert grant.status_code == 200, grant.text
    assert "settings.manage" in grant.json()["permissions"]

    reception = login(client, "reception@example.test")
    allowed = client.post(
        "/api/settings/services",
        headers=reception,
        json={"name": "Now Allowed Service", "price": 12, "duration_minutes": 20},
    )
    assert allowed.status_code == 201, allowed.text

    # Clean up the grant so later tests see the original receptionist state.
    client.patch(
        f"/api/staff/{reception_id}/permissions", headers=auth, json={"permissions": []}
    )


def test_unauthorized_staff_cannot_modify_permissions(client, auth):
    reception = login(client, "reception@example.test")
    owner_id = next(
        row["id"]
        for row in client.get("/api/staff", headers=auth).json()
        if row["email"] == "owner@example.test"
    )
    denied = client.patch(
        f"/api/staff/{owner_id}/permissions",
        headers=reception,
        json={"permissions": ["staff.manage"]},
    )
    assert denied.status_code == 403


def test_staff_manager_cannot_grant_permission_they_do_not_hold(client, auth):
    # Give reception staff.manage only, without settings.manage.
    reception_id = next(
        row["id"]
        for row in client.get("/api/staff", headers=auth).json()
        if row["email"] == "reception@example.test"
    )
    client.patch(
        f"/api/staff/{reception_id}/permissions",
        headers=auth,
        json={"permissions": ["staff.manage"]},
    )
    reception = login(client, "reception@example.test")
    nurse_id = next(
        row["id"]
        for row in client.get("/api/staff", headers=reception).json()
        if row["email"] == "nurse@example.test"
    )
    escalation = client.patch(
        f"/api/staff/{nurse_id}/permissions",
        headers=reception,
        json={"permissions": ["settings.manage"]},
    )
    assert escalation.status_code == 403

    invite_escalation = client.post(
        "/api/invitations",
        headers=reception,
        json={
            "email": "escalation.attempt@example.test",
            "full_name": "Escalation Attempt",
            "role": "nurse",
            "permissions": ["settings.manage"],
        },
    )
    assert invite_escalation.status_code == 403

    # Clean up the grant.
    client.patch(
        f"/api/staff/{reception_id}/permissions", headers=auth, json={"permissions": []}
    )


def test_editing_a_pending_invitation_updates_its_permissions(client, auth):
    created = client.post(
        "/api/invitations",
        headers=auth,
        json={
            "email": "editable.perm@example.test",
            "full_name": "Editable Perm",
            "role": "nurse",
            "permissions": ["patients.read"],
        },
    ).json()
    assert created["permissions"] == ["patients.read"]

    edited = client.patch(
        f"/api/invitations/{created['id']}/permissions",
        headers=auth,
        json={"permissions": ["patients.read", "quality.manage", "orders.manage"]},
    )
    assert edited.status_code == 200, edited.text
    assert sorted(edited.json()["permissions"]) == [
        "orders.manage",
        "patients.read",
        "quality.manage",
    ]

    listing = client.get("/api/invitations", headers=auth)
    row = next(item for item in listing.json() if item["id"] == created["id"])
    assert sorted(row["permissions"]) == ["orders.manage", "patients.read", "quality.manage"]

    accepted = client.post(
        "/api/invitations/accept",
        json={
            "token": created["demo_token"],
            "password": "password123",
            "terms_accepted": True,
            "privacy_acknowledged": True,
        },
    )
    assert accepted.status_code == 200, accepted.text
    assert sorted(accepted.json()["permissions"]) == [
        "orders.manage",
        "patients.read",
        "quality.manage",
    ]


def test_editing_permissions_on_an_accepted_invitation_is_rejected(client, auth):
    created = client.post(
        "/api/invitations",
        headers=auth,
        json={
            "email": "already.accepted@example.test",
            "full_name": "Already Accepted",
            "role": "nurse",
            "permissions": ["patients.read"],
        },
    ).json()
    client.post(
        "/api/invitations/accept",
        json={
            "token": created["demo_token"],
            "password": "password123",
            "terms_accepted": True,
            "privacy_acknowledged": True,
        },
    )
    blocked = client.patch(
        f"/api/invitations/{created['id']}/permissions",
        headers=auth,
        json={"permissions": ["staff.manage"]},
    )
    assert blocked.status_code == 404


def test_staff_manager_cannot_escalate_a_pending_invitation_via_edit(client, auth):
    reception_id = next(
        row["id"]
        for row in client.get("/api/staff", headers=auth).json()
        if row["email"] == "reception@example.test"
    )
    client.patch(
        f"/api/staff/{reception_id}/permissions",
        headers=auth,
        json={"permissions": ["staff.manage"]},
    )
    created = client.post(
        "/api/invitations",
        headers=auth,
        json={
            "email": "edit.escalation@example.test",
            "full_name": "Edit Escalation",
            "role": "nurse",
            "permissions": ["patients.read"],
        },
    ).json()
    reception = login(client, "reception@example.test")
    escalation = client.patch(
        f"/api/invitations/{created['id']}/permissions",
        headers=reception,
        json={"permissions": ["settings.manage"]},
    )
    assert escalation.status_code == 403

    client.patch(
        f"/api/staff/{reception_id}/permissions", headers=auth, json={"permissions": []}
    )


def test_resending_an_invitation_preserves_its_permissions(client, auth):
    created = client.post(
        "/api/invitations",
        headers=auth,
        json={
            "email": "resend.keeps.perms@example.test",
            "full_name": "Resend Keeps Perms",
            "role": "receptionist",
            "permissions": ["patients.read", "waitlist.manage"],
        },
    ).json()
    resent = client.post(
        f"/api/invitations/{created['id']}/resend", headers=auth
    )
    assert resent.status_code == 200, resent.text
    assert sorted(resent.json()["permissions"]) == ["patients.read", "waitlist.manage"]


def test_cross_clinic_patient_access_is_rejected(client, auth):
    outsider = login(client, "other@example.test")
    private_patient = next(
        row
        for row in client.get("/api/patients", headers=outsider).json()
        if row["full_name"] == "Private Patient"
    )
    cross_get = client.get(f"/api/patients/{private_patient['id']}", headers=auth)
    assert cross_get.status_code == 404


def test_cross_clinic_staff_and_invitations_are_isolated(client, auth):
    outsider = login(client, "other@example.test")
    created = client.post(
        "/api/invitations",
        headers=auth,
        json={
            "email": "clinic.isolated@example.test",
            "full_name": "Clinic Isolated",
            "role": "receptionist",
            "permissions": ["patients.read"],
        },
    ).json()

    cross_get = client.get(f"/api/staff/{created['id']}", headers=outsider)
    assert cross_get.status_code == 404

    cross_resend = client.post(
        f"/api/invitations/{created['id']}/resend", headers=outsider
    )
    assert cross_resend.status_code == 404

    cross_permissions_edit = client.patch(
        f"/api/invitations/{created['id']}/permissions",
        headers=outsider,
        json={"permissions": ["staff.manage"]},
    )
    assert cross_permissions_edit.status_code == 404

    outsider_list = client.get("/api/invitations", headers=outsider)
    assert all(item["id"] != created["id"] for item in outsider_list.json())
