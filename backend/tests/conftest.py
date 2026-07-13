import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from app.database import Base, get_db
from app.main import app
from app.models import Clinic, InsuranceCompany, Patient, Role, Service, User
from app.security import hash_password

engine = create_engine(
    "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
)
TestingSession = sessionmaker(bind=engine, expire_on_commit=False)


@pytest.fixture(scope="session")
def client():
    Base.metadata.create_all(engine)
    db = TestingSession()
    clinic = Clinic(
        name="Test Clinic",
        address="Manama",
        phone="+973 17000000",
        working_hours={},
        pharmacy_enabled=True,
    )
    other = Clinic(
        name="Other Clinic", address="Riffa", phone="+973 17111111", working_hours={}
    )
    db.add_all([clinic, other])
    db.flush()
    owner = User(
        clinic_id=clinic.id,
        email="owner@example.test",
        full_name="Test Owner",
        password_hash=hash_password("password123"),
        role=Role.owner,
    )
    doctor = User(
        clinic_id=clinic.id,
        email="doctor@example.test",
        full_name="Dr Test",
        password_hash=hash_password("password123"),
        role=Role.doctor,
        specialty="Family Medicine",
    )
    doctor_two = User(
        clinic_id=clinic.id,
        email="doctor.two@example.test",
        full_name="Dr Two",
        password_hash=hash_password("password123"),
        role=Role.doctor,
        specialty="Internal Medicine",
    )
    receptionist = User(
        clinic_id=clinic.id,
        email="reception@example.test",
        full_name="Test Receptionist",
        password_hash=hash_password("password123"),
        role=Role.receptionist,
    )
    pharmacist = User(
        clinic_id=clinic.id,
        email="pharmacist@example.test",
        full_name="Test Pharmacist",
        password_hash=hash_password("password123"),
        role=Role.pharmacist,
    )
    nurse = User(
        clinic_id=clinic.id,
        email="nurse@example.test",
        full_name="Test Nurse",
        password_hash=hash_password("password123"),
        role=Role.nurse,
    )
    accountant = User(
        clinic_id=clinic.id,
        email="accountant@example.test",
        full_name="Test Accountant",
        password_hash=hash_password("password123"),
        role=Role.accountant,
    )
    outsider = User(
        clinic_id=other.id,
        email="other@example.test",
        full_name="Other Owner",
        password_hash=hash_password("password123"),
        role=Role.owner,
    )
    patient = Patient(
        clinic_id=clinic.id,
        full_name="Existing Patient",
        phone="+973 33112233",
        cpr_number="900101001",
    )
    private = Patient(
        clinic_id=other.id,
        full_name="Private Patient",
        phone="+973 33999999",
        cpr_number="900101002",
    )
    service = Service(
        clinic_id=clinic.id, name="Consultation", price=25, duration_minutes=30
    )
    insurer = InsuranceCompany(clinic_id=clinic.id, name="Takaful International")
    db.add_all(
        [
            owner,
            doctor,
            doctor_two,
            receptionist,
            pharmacist,
            nurse,
            accountant,
            outsider,
            patient,
            private,
            service,
            insurer,
        ]
    )
    db.commit()
    db.close()

    def override():
        session = TestingSession()
        try:
            yield session
        finally:
            session.close()

    app.dependency_overrides[get_db] = override
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()
    Base.metadata.drop_all(engine)


@pytest.fixture(scope="session")
def auth(client):
    response = client.post(
        "/api/auth/login",
        json={"email": "owner@example.test", "password": "password123"},
    )
    assert response.status_code == 200
    return {"Authorization": f"Bearer {response.json()['access_token']}"}
