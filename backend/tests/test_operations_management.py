from sqlalchemy import select

from app.models import Appointment, User
from conftest import TestingSession


def login(client, email, password="password123"):
    response = client.post(
        "/api/auth/login", json={"email": email, "password": password}
    )
    assert response.status_code == 200, response.text
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def create_invoice(client, auth, patient_id):
    response = client.post(
        "/api/billing/invoices",
        headers=auth,
        json={
            "patient_id": patient_id,
            "items": [{"description": "Consultation", "quantity": 1, "unit_price": 40}],
        },
    )
    assert response.status_code == 201, response.text
    return response.json()


def create_claim(client, auth, invoice, company_id, amount=10):
    response = client.post(
        "/api/insurance/claims",
        headers=auth,
        json={
            "invoice_id": invoice["id"],
            "insurance_company_id": company_id,
            "policy_number": "POL-1",
            "claim_amount": amount,
        },
    )
    assert response.status_code == 201, response.text
    return response.json()


def seeded_ids(client, auth):
    settings = client.get("/api/settings", headers=auth).json()
    patient_id = client.get("/api/patients", headers=auth).json()[0]["id"]
    return settings, patient_id


# ---------------------------------------------------------------------------
# Insurance claim status transitions
# ---------------------------------------------------------------------------


def test_valid_claim_transitions_progress_through_the_lifecycle(client, auth):
    settings, patient_id = seeded_ids(client, auth)
    company_id = settings["insurance_companies"][0]["id"]
    invoice = create_invoice(client, auth, patient_id)
    claim = create_claim(client, auth, invoice, company_id)

    submitted = client.patch(
        f"/api/insurance/claims/{claim['id']}/status",
        headers=auth,
        json={"status": "submitted"},
    )
    assert submitted.status_code == 200, submitted.text
    assert submitted.json()["status"] == "submitted"
    assert submitted.json()["submitted_date"] is not None

    approved = client.patch(
        f"/api/insurance/claims/{claim['id']}/status",
        headers=auth,
        json={"status": "approved"},
    )
    assert approved.status_code == 200, approved.text

    paid = client.patch(
        f"/api/insurance/claims/{claim['id']}/status",
        headers=auth,
        json={"status": "paid"},
    )
    assert paid.status_code == 200, paid.text
    assert paid.json()["paid_date"] is not None


def test_invalid_claim_transitions_are_rejected_by_the_backend(client, auth):
    settings, patient_id = seeded_ids(client, auth)
    company_id = settings["insurance_companies"][0]["id"]
    invoice = create_invoice(client, auth, patient_id)
    claim = create_claim(client, auth, invoice, company_id)

    # draft -> paid skips the whole lifecycle
    skip = client.patch(
        f"/api/insurance/claims/{claim['id']}/status",
        headers=auth,
        json={"status": "paid"},
    )
    assert skip.status_code == 409

    # a no-op "transition" to the same status is also rejected
    same = client.patch(
        f"/api/insurance/claims/{claim['id']}/status",
        headers=auth,
        json={"status": "draft"},
    )
    assert same.status_code == 409

    client.patch(
        f"/api/insurance/claims/{claim['id']}/status",
        headers=auth,
        json={"status": "submitted"},
    )
    rejected = client.patch(
        f"/api/insurance/claims/{claim['id']}/status",
        headers=auth,
        json={"status": "rejected"},
    )
    assert rejected.status_code == 200
    assert rejected.json()["rejection_reason"]

    # a paid/rejected claim can never jump straight to approved
    reject_to_approved = client.patch(
        f"/api/insurance/claims/{claim['id']}/status",
        headers=auth,
        json={"status": "approved"},
    )
    assert reject_to_approved.status_code == 409

    # but resubmission is a real, allowed move
    resubmit = client.patch(
        f"/api/insurance/claims/{claim['id']}/status",
        headers=auth,
        json={"status": "submitted"},
    )
    assert resubmit.status_code == 200


def test_claims_list_supports_search_filters_and_pagination(client, auth):
    settings, patient_id = seeded_ids(client, auth)
    company_id = settings["insurance_companies"][0]["id"]
    invoice = create_invoice(client, auth, patient_id)
    claim = create_claim(client, auth, invoice, company_id)

    by_status = client.get(
        "/api/insurance/claims", headers=auth, params={"status": "draft"}
    )
    assert by_status.status_code == 200
    assert claim["id"] in [c["id"] for c in by_status.json()["items"]]

    by_company = client.get(
        "/api/insurance/claims", headers=auth, params={"company_id": company_id}
    )
    assert claim["id"] in [c["id"] for c in by_company.json()["items"]]

    by_claim_number = client.get(
        "/api/insurance/claims",
        headers=auth,
        params={"claim_number": str(claim["id"])},
    )
    assert [c["id"] for c in by_claim_number.json()["items"]] == [claim["id"]]

    no_match = client.get(
        "/api/insurance/claims", headers=auth, params={"patient": "Nobody Real Xyz"}
    )
    assert no_match.json()["items"] == []

    paged = client.get(
        "/api/insurance/claims", headers=auth, params={"limit": 1, "offset": 0}
    )
    assert paged.status_code == 200
    assert len(paged.json()["items"]) <= 1
    assert "total" in paged.json()


def test_accountant_without_claims_manage_is_rejected(client):
    reception = login(client, "reception@example.test")
    denied = client.get("/api/insurance/claims", headers=reception)
    assert denied.status_code == 403


# ---------------------------------------------------------------------------
# Service delete/deactivate safety
# ---------------------------------------------------------------------------


def test_unreferenced_service_can_be_deleted(client, auth):
    created = client.post(
        "/api/settings/services",
        headers=auth,
        json={"name": "Throwaway Service", "price": 5, "duration_minutes": 15},
    ).json()
    deleted = client.delete(f"/api/settings/services/{created['id']}", headers=auth)
    assert deleted.status_code == 204


def test_service_referenced_by_appointment_cannot_be_deleted(client, auth):
    service = client.post(
        "/api/settings/services",
        headers=auth,
        json={"name": "In-Use Service", "price": 5, "duration_minutes": 15},
    ).json()
    with TestingSession() as db:
        doctor = db.scalar(select(User).where(User.email == "doctor@example.test"))
        clinic_id = doctor.clinic_id
        doctor_id = doctor.id
    patient_id = client.get("/api/patients", headers=auth).json()[0]["id"]
    appointment = client.post(
        "/api/appointments",
        headers=auth,
        json={
            "patient_id": patient_id,
            "doctor_id": doctor_id,
            "service_id": service["id"],
            "start_time": "2026-09-01T09:00:00Z",
            "end_time": "2026-09-01T09:30:00Z",
            "reason": "Checkup",
        },
    )
    assert appointment.status_code == 201, appointment.text

    blocked = client.delete(f"/api/settings/services/{service['id']}", headers=auth)
    assert blocked.status_code == 409

    # deactivating (editing active=false) via the existing edit endpoint
    # remains the safe path
    deactivated = client.put(
        f"/api/settings/services/{service['id']}",
        headers=auth,
        json={"name": "In-Use Service", "price": 5, "duration_minutes": 15, "active": False},
    )
    assert deactivated.status_code == 200
    assert deactivated.json()["active"] is False


def test_service_management_requires_settings_manage(client):
    reception = login(client, "reception@example.test")
    denied = client.post(
        "/api/settings/services",
        headers=reception,
        json={"name": "Unauthorized", "price": 5, "duration_minutes": 15},
    )
    assert denied.status_code == 403


# ---------------------------------------------------------------------------
# Insurance company delete/deactivate safety + duplicate names
# ---------------------------------------------------------------------------


def test_unreferenced_insurance_company_can_be_deleted(client, auth):
    created = client.post(
        "/api/settings/insurance-companies", headers=auth, json={"name": "Throwaway Insurer"}
    ).json()
    deleted = client.delete(
        f"/api/settings/insurance-companies/{created['id']}", headers=auth
    )
    assert deleted.status_code == 204


def test_insurance_company_referenced_by_claim_cannot_be_deleted(client, auth):
    settings, patient_id = seeded_ids(client, auth)
    company = client.post(
        "/api/settings/insurance-companies", headers=auth, json={"name": "In-Use Insurer"}
    ).json()
    invoice = create_invoice(client, auth, patient_id)
    create_claim(client, auth, invoice, company["id"])

    blocked = client.delete(
        f"/api/settings/insurance-companies/{company['id']}", headers=auth
    )
    assert blocked.status_code == 409

    deactivated = client.put(
        f"/api/settings/insurance-companies/{company['id']}",
        headers=auth,
        json={"name": "In-Use Insurer", "active": False},
    )
    assert deactivated.status_code == 200
    assert deactivated.json()["active"] is False


def test_duplicate_insurance_company_name_is_rejected(client, auth):
    client.post(
        "/api/settings/insurance-companies", headers=auth, json={"name": "Unique Assurance Co"}
    )
    dup = client.post(
        "/api/settings/insurance-companies",
        headers=auth,
        json={"name": "unique assurance co"},
    )
    assert dup.status_code == 409


# ---------------------------------------------------------------------------
# Message template variable validation
# ---------------------------------------------------------------------------


def test_message_template_with_supported_variables_is_accepted(client, auth):
    created = client.post(
        "/api/settings/message-templates",
        headers=auth,
        json={
            "name": "Reminder",
            "kind": "appointment_reminder",
            "language": "en",
            "body": "Hi {{patient_name}}, your visit with {{doctor_name}} is on {{appointment_date}}.",
        },
    )
    assert created.status_code == 201, created.text


def test_message_template_with_unsupported_variable_is_rejected(client, auth):
    bad = client.post(
        "/api/settings/message-templates",
        headers=auth,
        json={
            "name": "Bad",
            "kind": "appointment_reminder",
            "language": "en",
            "body": "Hi {{patient_name}}, your {{made_up_field}} is ready.",
        },
    )
    assert bad.status_code == 422
    assert "made_up_field" in bad.json()["detail"]


def test_message_template_can_be_deleted(client, auth):
    created = client.post(
        "/api/settings/message-templates",
        headers=auth,
        json={"name": "Temp", "kind": "custom", "language": "en", "body": "Hello {{patient_name}}"},
    ).json()
    deleted = client.delete(
        f"/api/settings/message-templates/{created['id']}", headers=auth
    )
    assert deleted.status_code == 204


def test_message_template_variables_catalog_is_available(client, auth):
    catalog = client.get("/api/settings/message-template-variables", headers=auth)
    assert catalog.status_code == 200
    assert "patient_name" in catalog.json()


# ---------------------------------------------------------------------------
# Quick Create configuration
# ---------------------------------------------------------------------------


def test_quick_create_config_defaults_and_can_be_updated(client, auth):
    me = client.get("/api/clinics/me", headers=auth)
    assert me.status_code == 200
    assert "add_patient" in me.json()["quick_create_actions"]
    assert "invite_staff" not in me.json()["quick_create_actions"]

    catalog = client.get("/api/clinics/me/quick-create-catalog", headers=auth)
    assert catalog.status_code == 200
    assert "invite_staff" not in catalog.json()

    updated = client.put(
        "/api/clinics/me/quick-create-config",
        headers=auth,
        json={"actions": ["new_invoice", "add_patient", "add_patient"]},
    )
    assert updated.status_code == 200, updated.text
    assert updated.json()["quick_create_actions"] == ["new_invoice", "add_patient"]

    # restore defaults so later tests see the original clinic state
    client.put(
        "/api/clinics/me/quick-create-config",
        headers=auth,
        json={
            "actions": [
                "add_patient",
                "new_appointment",
                "new_invoice",
                "upload_document",
                "record_incident",
            ]
        },
    )


def test_quick_create_config_rejects_unknown_actions(client, auth):
    response = client.put(
        "/api/clinics/me/quick-create-config",
        headers=auth,
        json={"actions": ["invite_staff"]},
    )
    assert response.status_code == 422


def test_quick_create_config_requires_settings_manage(client):
    reception = login(client, "reception@example.test")
    denied = client.put(
        "/api/clinics/me/quick-create-config",
        headers=reception,
        json={"actions": ["add_patient"]},
    )
    assert denied.status_code == 403


# ---------------------------------------------------------------------------
# Quality incident time validation
# ---------------------------------------------------------------------------


def test_incident_cannot_be_recorded_in_the_future(client, auth):
    future = client.post(
        "/api/quality/incidents",
        headers=auth,
        json={
            "incident_type": "clinical_process",
            "occurred_at": "2099-01-01T00:00:00Z",
            "location": "Ward 1",
            "description": "Future incident",
            "immediate_action": "None yet",
            "severity": "low",
        },
    )
    assert future.status_code == 422


# ---------------------------------------------------------------------------
# Cross-clinic isolation
# ---------------------------------------------------------------------------


def test_cross_clinic_service_and_company_access_is_rejected(client, auth):
    outsider = login(client, "other@example.test")
    service = client.post(
        "/api/settings/services",
        headers=auth,
        json={"name": "Clinic-Scoped Service", "price": 5, "duration_minutes": 15},
    ).json()
    company = client.post(
        "/api/settings/insurance-companies", headers=auth, json={"name": "Clinic-Scoped Insurer"}
    ).json()

    assert (
        client.put(
            f"/api/settings/services/{service['id']}",
            headers=outsider,
            json={"name": "Hijacked", "price": 1, "duration_minutes": 5},
        ).status_code
        == 404
    )
    assert (
        client.delete(f"/api/settings/services/{service['id']}", headers=outsider).status_code
        == 404
    )
    assert (
        client.put(
            f"/api/settings/insurance-companies/{company['id']}",
            headers=outsider,
            json={"name": "Hijacked"},
        ).status_code
        == 404
    )
    assert (
        client.delete(
            f"/api/settings/insurance-companies/{company['id']}", headers=outsider
        ).status_code
        == 404
    )


def test_cross_clinic_claim_status_change_is_rejected(client, auth):
    outsider = login(client, "other@example.test")
    settings, patient_id = seeded_ids(client, auth)
    company_id = settings["insurance_companies"][0]["id"]
    invoice = create_invoice(client, auth, patient_id)
    claim = create_claim(client, auth, invoice, company_id)

    cross = client.patch(
        f"/api/insurance/claims/{claim['id']}/status",
        headers=outsider,
        json={"status": "submitted"},
    )
    assert cross.status_code == 404
