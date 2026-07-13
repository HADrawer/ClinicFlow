from datetime import datetime, timedelta, timezone


def test_login_works(client):
    response = client.post(
        "/api/auth/login",
        json={"email": "owner@example.test", "password": "password123"},
    )
    assert response.status_code == 200
    assert response.json()["token_type"] == "bearer"


def test_user_cannot_access_another_clinic_patient(client, auth):
    other = client.get(
        "/api/patients",
        headers={
            "Authorization": "Bearer "
            + client.post(
                "/api/auth/login",
                json={"email": "other@example.test", "password": "password123"},
            ).json()["access_token"]
        },
    ).json()[0]
    response = client.get(f"/api/patients/{other['id']}", headers=auth)
    assert response.status_code == 404


def test_create_patient(client, auth):
    response = client.post(
        "/api/patients",
        headers=auth,
        json={
            "full_name": "Fatima Test",
            "phone": "+973 36001234",
            "cpr_number": "920202003",
        },
    )
    assert response.status_code == 201
    assert response.json()["full_name"] == "Fatima Test"


def create_appointment(client, auth):
    patients = client.get("/api/patients", headers=auth).json()
    doctors = client.get("/api/doctors", headers=auth).json()
    services = client.get("/api/settings", headers=auth).json()["services"]
    existing = client.get("/api/appointments", headers=auth).json()
    start = datetime.now(timezone.utc) + timedelta(days=1 + len(existing))
    return client.post(
        "/api/appointments",
        headers=auth,
        json={
            "patient_id": patients[0]["id"],
            "doctor_id": doctors[0]["id"],
            "service_id": services[0]["id"],
            "start_time": start.isoformat(),
            "end_time": (start + timedelta(minutes=30)).isoformat(),
            "reason": "Follow-up",
        },
    )


def test_create_appointment(client, auth):
    response = create_appointment(client, auth)
    assert response.status_code == 201
    assert response.json()["status"] == "scheduled"


def test_mark_appointment_no_show(client, auth):
    appointment = create_appointment(client, auth).json()
    response = client.patch(
        f"/api/appointments/{appointment['id']}/status",
        headers=auth,
        json={"status": "no_show"},
    )
    assert response.status_code == 200
    assert response.json()["status"] == "no_show"


def create_invoice(client, auth):
    patient = client.get("/api/patients", headers=auth).json()[0]
    return client.post(
        "/api/billing/invoices",
        headers=auth,
        json={
            "patient_id": patient["id"],
            "discount": 0,
            "vat": 0,
            "paid_amount": 5,
            "payment_method": "benefitpay",
            "items": [{"description": "Consultation", "quantity": 1, "unit_price": 25}],
        },
    )


def test_create_invoice(client, auth):
    response = create_invoice(client, auth)
    assert response.status_code == 201
    assert response.json()["payment_status"] == "partial"
    assert float(response.json()["balance_due"]) == 20


def test_create_insurance_claim(client, auth):
    invoice = create_invoice(client, auth).json()
    company = client.get("/api/insurance/companies", headers=auth).json()[0]
    response = client.post(
        "/api/insurance/claims",
        headers=auth,
        json={
            "invoice_id": invoice["id"],
            "insurance_company_id": company["id"],
            "policy_number": "TEST-POL-1",
            "claim_amount": 10,
        },
    )
    assert response.status_code == 201
    assert response.json()["status"] == "draft"
