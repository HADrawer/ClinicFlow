from datetime import date, datetime, timedelta, timezone

import pytest
from sqlalchemy import select

from app.models import (
    EncounterStatus,
    MedicineBatch,
    Patient,
    StaffInvitation,
)
from conftest import TestingSession


def login(client, email, password="password123"):
    response = client.post(
        "/api/auth/login", json={"email": email, "password": password}
    )
    assert response.status_code == 200, response.text
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


@pytest.mark.parametrize(
    "email",
    [
        "owner@example.test",
        "doctor@example.test",
        "reception@example.test",
        "accountant@example.test",
        "nurse@example.test",
        "pharmacist@example.test",
    ],
)
def test_every_seeded_role_can_log_in(client, email):
    assert login(client, email)["Authorization"].startswith("Bearer ")


def test_invitation_is_single_use_and_creates_doctor_profile(client, auth):
    service_id = client.get("/api/settings", headers=auth).json()["services"][0]["id"]
    created = client.post(
        "/api/invitations",
        headers=auth,
        json={
            "email": "invited.doctor@example.test",
            "full_name": "Dr Invited",
            "role": "doctor",
            "profile_data": {
                "specialty": "Dermatology",
                "license_number": "TEST-123",
                "service_ids": [service_id],
                "permissions": [],
            },
        },
    )
    assert created.status_code == 201, created.text
    token = created.json()["demo_token"]
    accepted = client.post(
        "/api/invitations/accept",
        json={
            "token": token,
            "password": "newpassword123",
            "terms_accepted": True,
            "privacy_acknowledged": True,
        },
    )
    assert accepted.status_code == 200, accepted.text
    assert accepted.json()["role"] == "doctor"
    assert (
        client.post(
            "/api/invitations/accept",
            json={
                "token": token,
                "password": "newpassword123",
                "terms_accepted": True,
                "privacy_acknowledged": True,
            },
        ).status_code
        == 400
    )
    assert login(client, "invited.doctor@example.test", "newpassword123")


def test_revoked_and_expired_invitations_fail(client, auth):
    revoked = client.post(
        "/api/invitations",
        headers=auth,
        json={
            "email": "revoked@example.test",
            "full_name": "Revoked User",
            "role": "receptionist",
        },
    ).json()
    response = client.post(f"/api/invitations/{revoked['id']}/revoke", headers=auth)
    assert response.status_code == 200
    assert (
        client.get(f"/api/invitations/validate/{revoked['demo_token']}").status_code
        == 400
    )

    expired = client.post(
        "/api/invitations",
        headers=auth,
        json={
            "email": "expired@example.test",
            "full_name": "Expired User",
            "role": "nurse",
            "expires_in_hours": 1,
        },
    ).json()
    with TestingSession() as db:
        invitation = db.get(StaffInvitation, expired["id"])
        invitation.expires_at = datetime.now(timezone.utc) - timedelta(seconds=1)
        db.commit()
    assert (
        client.get(f"/api/invitations/validate/{expired['demo_token']}").status_code
        == 400
    )


def test_disable_reactivate_and_session_revocation(client, auth):
    staff = client.get("/api/staff", headers=auth).json()
    doctor = next(item for item in staff if item["email"] == "doctor.two@example.test")
    doctor_auth = login(client, doctor["email"])
    disabled = client.patch(
        f"/api/staff/{doctor['id']}/status",
        headers=auth,
        json={"active": False},
    )
    assert disabled.status_code == 200
    assert client.get("/api/auth/me", headers=doctor_auth).status_code == 401
    assert (
        client.post(
            "/api/auth/login",
            json={"email": doctor["email"], "password": "password123"},
        ).status_code
        == 401
    )
    assert (
        client.patch(
            f"/api/staff/{doctor['id']}/status",
            headers=auth,
            json={"active": True},
        ).status_code
        == 200
    )
    refreshed = login(client, doctor["email"])
    assert (
        client.post(
            f"/api/staff/{doctor['id']}/revoke-sessions", headers=auth
        ).status_code
        == 204
    )
    assert client.get("/api/auth/me", headers=refreshed).status_code == 401


def appointment_payload(client, auth_header, doctor_id, offset=10):
    patient_id = client.get("/api/patients", headers=auth_header).json()[0]["id"]
    service_id = client.get("/api/settings", headers=auth_header).json()["services"][0][
        "id"
    ]
    start = datetime.now(timezone.utc) + timedelta(days=offset)
    return {
        "patient_id": patient_id,
        "doctor_id": doctor_id,
        "service_id": service_id,
        "start_time": start.isoformat(),
        "end_time": (start + timedelta(minutes=30)).isoformat(),
        "reason": "Expansion workflow test",
    }


def test_doctor_manages_own_schedule_conflicts_and_history(client, auth):
    doctor_auth = login(client, "doctor@example.test")
    doctor = client.get("/api/auth/me", headers=doctor_auth).json()
    payload = appointment_payload(client, auth, doctor["id"], 30)
    created = client.post("/api/appointments", headers=doctor_auth, json=payload)
    assert created.status_code == 201, created.text
    assert (
        client.post("/api/appointments", headers=doctor_auth, json=payload).status_code
        == 409
    )
    other = next(
        item
        for item in client.get("/api/doctors", headers=auth).json()
        if item["id"] != doctor["id"]
    )
    wrong = {
        **payload,
        "doctor_id": other["id"],
        "start_time": (datetime.now(timezone.utc) + timedelta(days=31)).isoformat(),
        "end_time": (
            datetime.now(timezone.utc) + timedelta(days=31, minutes=30)
        ).isoformat(),
    }
    assert (
        client.post("/api/appointments", headers=doctor_auth, json=wrong).status_code
        == 403
    )
    item_id = created.json()["id"]
    checked_in = client.patch(
        f"/api/appointments/{item_id}/status",
        headers=doctor_auth,
        json={"status": "checked_in", "reason": "Patient arrived"},
    )
    assert checked_in.status_code == 200
    history = client.get(
        f"/api/appointments/{item_id}/history", headers=doctor_auth
    ).json()
    assert [entry["to_status"] for entry in history] == ["scheduled", "checked_in"]
    queue = client.get("/api/appointments/workflow/queue", headers=doctor_auth)
    assert queue.status_code == 200
    assert any(entry["appointment_id"] == item_id for entry in queue.json())


def test_finalized_encounter_is_immutable_and_amendment_preserves_original(
    client, auth
):
    doctor_auth = login(client, "doctor@example.test")
    doctor = client.get("/api/auth/me", headers=doctor_auth).json()
    patient_id = client.get("/api/patients", headers=auth).json()[0]["id"]
    visit = client.post(
        "/api/visits",
        headers=doctor_auth,
        json={
            "patient_id": patient_id,
            "doctor_id": doctor["id"],
            "subjective": "Patient reports improving symptoms.",
            "objective": "Observations stable.",
            "assessment": "Recovery progressing.",
            "plan": "Continue current plan.",
            "diagnosis": "Follow-up review",
            "doctor_signature_name": doctor["full_name"],
        },
    )
    assert visit.status_code == 201, visit.text
    visit_id = visit.json()["id"]
    finalized = client.post(f"/api/visits/{visit_id}/finalize", headers=doctor_auth)
    assert finalized.status_code == 200
    assert finalized.json()["status"] == "finalized"
    update = client.put(
        f"/api/visits/{visit_id}",
        headers=doctor_auth,
        json={
            "subjective": "Changed",
            "objective": "Changed",
            "assessment": "Changed",
            "plan": "Changed",
            "diagnosis": "Changed",
            "doctor_signature_name": doctor["full_name"],
        },
    )
    assert update.status_code == 409
    amendment = client.post(
        f"/api/visits/{visit_id}/amendments",
        headers=doctor_auth,
        json={
            "reason": "Clarify follow-up advice",
            "content": {"plan": "Return in two weeks."},
        },
    )
    assert amendment.status_code == 201
    with TestingSession() as db:
        original = db.get(__import__("app.models", fromlist=["Visit"]).Visit, visit_id)
        assert original.plan == "Continue current plan."
        assert original.status == EncounterStatus.amended


def create_pharmacy_stock(client, auth):
    pharmacist_auth = login(client, "pharmacist@example.test")
    supplier = client.post(
        "/api/pharmacy/suppliers",
        headers=pharmacist_auth,
        json={"name": "Test Supplier", "phone": "+973 17000001"},
    )
    assert supplier.status_code == 201, supplier.text
    medicine = client.post(
        "/api/pharmacy/medicines",
        headers=pharmacist_auth,
        json={
            "code": "TEST-MED-1",
            "generic_name": "Test medicine",
            "form": "tablet",
            "strength": "10 mg",
            "sale_price": 1.5,
            "purchase_cost": 0.5,
            "reorder_level": 2,
        },
    )
    assert medicine.status_code == 201, medicine.text
    purchase = client.post(
        "/api/pharmacy/purchase-orders",
        headers=pharmacist_auth,
        json={
            "supplier_id": supplier.json()["id"],
            "items": [
                {
                    "medicine_id": medicine.json()["id"],
                    "quantity_ordered": 10,
                    "unit_cost": 0.5,
                }
            ],
        },
    )
    assert purchase.status_code == 201, purchase.text
    item_id = purchase.json()["items"][0]["id"]
    receipt = client.post(
        f"/api/pharmacy/purchase-orders/{purchase.json()['id']}/receive",
        headers=pharmacist_auth,
        json={
            "supplier_invoice_reference": "INV-TEST",
            "items": [
                {
                    "purchase_order_item_id": item_id,
                    "batch_number": "BATCH-TEST-1",
                    "expiry_date": (date.today() + timedelta(days=365)).isoformat(),
                    "quantity": 10,
                }
            ],
        },
    )
    assert receipt.status_code == 200, receipt.text
    return pharmacist_auth, medicine.json(), receipt.json()[0]


def test_pharmacy_receipt_dispensing_and_rollback(client, auth):
    pharmacist_auth, medicine, batch = create_pharmacy_stock(client, auth)
    doctor_auth = login(client, "doctor@example.test")
    doctor = client.get("/api/auth/me", headers=doctor_auth).json()
    patient_id = client.get("/api/patients", headers=auth).json()[0]["id"]
    visit = client.post(
        "/api/visits",
        headers=doctor_auth,
        json={
            "patient_id": patient_id,
            "doctor_id": doctor["id"],
            "subjective": "Symptoms",
            "objective": "Findings",
            "assessment": "Assessment",
            "plan": "Plan",
            "diagnosis": "Diagnosis",
            "doctor_signature_name": doctor["full_name"],
        },
    ).json()
    prescription = client.post(
        "/api/prescriptions",
        headers=doctor_auth,
        json={
            "visit_id": visit["id"],
            "patient_id": patient_id,
            "items": [
                {
                    "medicine_name": medicine["generic_name"],
                    "dosage": medicine["strength"],
                    "frequency": "once daily",
                    "duration": "five days",
                    "quantity": 2,
                }
            ],
        },
    )
    assert prescription.status_code == 201, prescription.text
    too_much = client.post(
        "/api/pharmacy/dispensing",
        headers=pharmacist_auth,
        json={
            "prescription_id": prescription.json()["id"],
            "items": [
                {
                    "medicine_id": medicine["id"],
                    "batch_id": batch["id"],
                    "quantity": 11,
                }
            ],
        },
    )
    assert too_much.status_code == 409
    unchanged = next(
        item
        for item in client.get("/api/pharmacy/stock", headers=pharmacist_auth).json()
        if item["id"] == batch["id"]
    )
    assert unchanged["quantity_available"] == 10
    dispensed = client.post(
        "/api/pharmacy/dispensing",
        headers=pharmacist_auth,
        json={
            "prescription_id": prescription.json()["id"],
            "idempotency_key": "dispense-test-1",
            "verification_note": "Patient and prescription verified",
            "items": [
                {
                    "medicine_id": medicine["id"],
                    "batch_id": batch["id"],
                    "quantity": 1,
                }
            ],
        },
    )
    assert dispensed.status_code == 201, dispensed.text
    assert (
        client.get(
            f"/api/prescriptions/{prescription.json()['id']}", headers=doctor_auth
        ).json()["status"]
        == "partially_dispensed"
    )
    repeated = client.post(
        "/api/pharmacy/dispensing",
        headers=pharmacist_auth,
        json={
            "prescription_id": prescription.json()["id"],
            "idempotency_key": "dispense-test-1",
            "items": [
                {
                    "medicine_id": medicine["id"],
                    "batch_id": batch["id"],
                    "quantity": 1,
                }
            ],
        },
    )
    assert repeated.status_code == 201
    completed = client.post(
        "/api/pharmacy/dispensing",
        headers=pharmacist_auth,
        json={
            "prescription_id": prescription.json()["id"],
            "idempotency_key": "dispense-test-2",
            "verification_note": "Second partial quantity verified",
            "items": [
                {
                    "medicine_id": medicine["id"],
                    "batch_id": batch["id"],
                    "quantity": 1,
                }
            ],
        },
    )
    assert completed.status_code == 201, completed.text
    assert (
        client.get(
            f"/api/prescriptions/{prescription.json()['id']}", headers=doctor_auth
        ).json()["status"]
        == "fully_dispensed"
    )
    final_batch = next(
        item
        for item in client.get("/api/pharmacy/stock", headers=pharmacist_auth).json()
        if item["id"] == batch["id"]
    )
    assert final_batch["quantity_available"] == 8


def test_expired_stock_and_disabled_tenant_are_blocked(client, auth):
    pharmacist_auth = login(client, "pharmacist@example.test")
    stock = client.get("/api/pharmacy/stock", headers=pharmacist_auth).json()
    if stock:
        with TestingSession() as db:
            batch = db.get(MedicineBatch, stock[0]["id"])
            batch.expiry_date = date.today() - timedelta(days=1)
            db.commit()
        doctor_auth = login(client, "doctor@example.test")
        doctor = client.get("/api/auth/me", headers=doctor_auth).json()
        patient_id = client.get("/api/patients", headers=auth).json()[0]["id"]
        visit = client.post(
            "/api/visits",
            headers=doctor_auth,
            json={
                "patient_id": patient_id,
                "doctor_id": doctor["id"],
                "subjective": "Expiry safety test",
                "objective": "Stable",
                "assessment": "Test",
                "plan": "Do not dispense expired stock",
                "diagnosis": "Safety test",
                "doctor_signature_name": doctor["full_name"],
            },
        ).json()
        prescription = client.post(
            "/api/prescriptions",
            headers=doctor_auth,
            json={
                "visit_id": visit["id"],
                "patient_id": patient_id,
                "items": [
                    {
                        "medicine_name": "Expiry test",
                        "dosage": "10 mg",
                        "frequency": "once",
                        "duration": "one day",
                        "quantity": 1,
                    }
                ],
            },
        ).json()
        blocked = client.post(
            "/api/pharmacy/dispensing",
            headers=pharmacist_auth,
            json={
                "prescription_id": prescription["id"],
                "items": [
                    {
                        "medicine_id": stock[0]["medicine_id"],
                        "batch_id": stock[0]["id"],
                        "quantity": 1,
                    }
                ],
            },
        )
        assert blocked.status_code == 409
    other_auth = login(client, "other@example.test")
    response = client.get("/api/pharmacy/dashboard", headers=other_auth)
    assert response.status_code == 404


def test_secure_documents_quality_and_direct_tenant_isolation(client, auth):
    patient_id = client.get("/api/patients", headers=auth).json()[0]["id"]
    no_consent = client.post(
        "/api/documents",
        headers=auth,
        data={"patient_id": patient_id, "category": "clinical_photo"},
        files={"file": ("photo.png", b"png-demo", "image/png")},
    )
    assert no_consent.status_code == 422
    uploaded = client.post(
        "/api/documents",
        headers=auth,
        data={"patient_id": patient_id, "category": "report"},
        files={"file": ("safe-report.pdf", b"%PDF-1.4 demo", "application/pdf")},
    )
    assert uploaded.status_code == 201, uploaded.text
    link = client.post(
        f"/api/documents/{uploaded.json()['id']}/download-link", headers=auth
    )
    assert link.status_code == 200
    download = client.get(link.json()["url"])
    assert download.status_code == 200
    assert download.content == b"%PDF-1.4 demo"

    other_auth = login(client, "other@example.test")
    assert (
        client.post(
            f"/api/documents/{uploaded.json()['id']}/download-link",
            headers=other_auth,
        ).status_code
        == 404
    )
    with TestingSession() as db:
        private_patient_id = db.scalar(select(Patient.id).where(Patient.clinic_id != 1))
    assert (
        client.get(f"/api/patients/{private_patient_id}", headers=auth).status_code
        == 404
    )
    complaint = client.post(
        "/api/quality/complaints",
        headers=auth,
        json={
            "patient_id": patient_id,
            "complainant": "Test patient",
            "channel": "phone",
            "category": "service",
            "description": "Follow-up response test",
        },
    )
    assert complaint.status_code == 201, complaint.text


def test_audit_events_are_created_for_expansion_workflows(client, auth):
    logs = client.get("/api/audit-logs", headers=auth)
    assert logs.status_code == 200
    actions = {item["action"] for item in logs.json()}
    assert "invitation.accepted" in actions
    assert "encounter.finalized" in actions
    assert "pharmacy.dispensed" in actions
