from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import or_, select
from sqlalchemy.exc import IntegrityError
from ..audit import log
from ..dependencies import Db, permission
from ..models import (
    Appointment,
    ClinicalOrder,
    Consent,
    DispenseOrder,
    Document,
    InsuranceClaim,
    Invoice,
    Message,
    Patient,
    Prescription,
    Referral,
    Role,
    Visit,
)
from ..schemas import PatientCreate, PatientOut, PatientUpdate

router = APIRouter(prefix="/patients", tags=["Patients"])
patient_read = permission("patients.read")


@router.get("", response_model=list[PatientOut])
def list_patients(
    db: Db, user=Depends(patient_read), search: str = Query("", max_length=100)
):
    q = select(Patient).where(Patient.clinic_id == user.clinic_id)
    if search:
        q = q.where(
            or_(
                Patient.full_name.ilike(f"%{search}%"),
                Patient.phone.ilike(f"%{search}%"),
                Patient.cpr_number.ilike(f"%{search}%"),
            )
        )
    return db.scalars(q.order_by(Patient.full_name)).all()


@router.post("", response_model=PatientOut, status_code=201)
def create_patient(
    data: PatientCreate, db: Db, user=Depends(permission("patients.create"))
):
    item = Patient(**data.model_dump(), clinic_id=user.clinic_id)
    db.add(item)
    db.flush()
    item.patient_number = f"CF-{user.clinic_id:03d}-{item.id:06d}"
    log(db, user, "patient.created", "patient", item.id)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "A patient with this CPR already exists")
    db.refresh(item)
    return item


@router.get("/duplicates/check", response_model=list[PatientOut])
def duplicate_check(
    db: Db,
    user=Depends(patient_read),
    name: str = Query("", max_length=160),
    phone: str = Query("", max_length=30),
    cpr: str = Query("", max_length=20),
    date_of_birth: str = Query("", max_length=10),
):
    conditions = []
    if name.strip():
        conditions.append(Patient.full_name.ilike(f"%{name.strip()}%"))
    if phone.strip():
        conditions.append(Patient.phone == phone.strip())
    if cpr.strip():
        conditions.append(Patient.cpr_number == cpr.strip())
    if date_of_birth:
        conditions.append(Patient.date_of_birth == date_of_birth)
    if not conditions:
        return []
    return db.scalars(
        select(Patient)
        .where(Patient.clinic_id == user.clinic_id, or_(*conditions))
        .order_by(Patient.full_name)
        .limit(10)
    ).all()


def get_owned(db, user, patient_id):
    q = select(Patient).where(
        Patient.id == patient_id, Patient.clinic_id == user.clinic_id
    )
    if user.role == Role.doctor:
        q = q.where(
            Patient.id.in_(
                select(Appointment.patient_id).where(
                    Appointment.clinic_id == user.clinic_id,
                    Appointment.doctor_id == user.id,
                )
            )
        )
    item = db.scalar(q)
    if not item:
        raise HTTPException(404, "Patient not found")
    return item


@router.get("/{patient_id}", response_model=dict)
def patient_detail(patient_id: int, db: Db, user=Depends(patient_read)):
    p = get_owned(db, user, patient_id)
    log(db, user, "patient.viewed", "patient", p.id)
    db.commit()

    def rows(model):
        return db.scalars(
            select(model)
            .where(model.clinic_id == user.clinic_id, model.patient_id == patient_id)
            .order_by(model.id.desc())
        ).all()

    return {
        "patient": PatientOut.model_validate(p).model_dump(mode="json"),
        "appointments": [
            serialize_appointment(x)
            for x in rows(Appointment)
            if user.role != Role.doctor or x.doctor_id == user.id
        ],
        "visits": [
            serialize_visit(x)
            for x in rows(Visit)
            if user.role != Role.doctor or x.doctor_id == user.id
        ],
        "prescriptions": [serialize_prescription(x) for x in rows(Prescription)],
        "invoices": [serialize_invoice(x) for x in rows(Invoice)]
        if user.role in {Role.owner, Role.receptionist}
        else [],
        "claims": [
            serialize_claim(x)
            for x in db.scalars(
                select(InsuranceClaim)
                .join(Invoice)
                .where(
                    InsuranceClaim.clinic_id == user.clinic_id,
                    Invoice.patient_id == patient_id,
                )
            ).all()
        ]
        if user.role == Role.owner
        else [],
        "messages": [serialize_message(x) for x in rows(Message)],
        "orders": [serialize_order(x) for x in rows(ClinicalOrder)],
        "referrals": [serialize_referral(x) for x in rows(Referral)],
        "consents": [serialize_consent(x) for x in rows(Consent)],
        "documents": [serialize_document(x) for x in rows(Document)],
        "dispensing": [serialize_dispense(x) for x in rows(DispenseOrder)],
    }


@router.put("/{patient_id}", response_model=PatientOut)
def update_patient(
    patient_id: int,
    data: PatientUpdate,
    db: Db,
    user=Depends(permission("patients.update")),
):
    item = get_owned(db, user, patient_id)
    for k, v in data.model_dump().items():
        setattr(item, k, v)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "A patient with this CPR already exists")
    db.refresh(item)
    return item


def serialize_appointment(x):
    return {
        "id": x.id,
        "start_time": x.start_time.isoformat(),
        "end_time": x.end_time.isoformat(),
        "status": x.status.value,
        "reason": x.reason,
        "doctor_name": x.doctor.full_name,
        "service_name": x.service.name,
    }


def serialize_visit(x):
    return {
        "id": x.id,
        "patient_id": x.patient_id,
        "created_at": x.created_at.isoformat(),
        "diagnosis": x.diagnosis,
        "subjective": x.subjective,
        "objective": x.objective,
        "assessment": x.assessment,
        "plan": x.plan,
        "doctor_name": x.doctor.full_name,
        "follow_up_date": x.follow_up_date.isoformat() if x.follow_up_date else None,
        "status": x.status.value,
        "finalized_at": x.finalized_at.isoformat() if x.finalized_at else None,
    }


def serialize_prescription(x):
    return {
        "id": x.id,
        "created_at": x.created_at.isoformat(),
        "visit_id": x.visit_id,
        "items": [
            {
                "medicine_name": i.medicine_name,
                "dosage": i.dosage,
                "frequency": i.frequency,
                "duration": i.duration,
                "instructions": i.instructions,
            }
            for i in x.items
        ],
    }


def serialize_invoice(x):
    return {
        "id": x.id,
        "invoice_number": x.invoice_number,
        "created_at": x.created_at.isoformat(),
        "total_amount": float(x.total_amount),
        "paid_amount": float(x.paid_amount),
        "balance_due": float(x.balance_due),
        "payment_status": x.payment_status.value,
    }


def serialize_claim(x):
    return {
        "id": x.id,
        "claim_amount": float(x.claim_amount),
        "status": x.status.value,
        "policy_number": x.policy_number,
        "company": x.company.name,
    }


def serialize_message(x):
    return {
        "id": x.id,
        "created_at": x.created_at.isoformat(),
        "kind": x.kind,
        "body": x.body,
        "status": x.status.value,
    }


def serialize_order(x):
    return {
        "id": x.id,
        "kind": x.kind,
        "items": x.items,
        "provider": x.provider,
        "status": x.status,
        "result_summary": x.result_summary,
        "created_at": x.created_at.isoformat(),
    }


def serialize_referral(x):
    return {
        "id": x.id,
        "destination": x.destination,
        "reason": x.reason,
        "urgency": x.urgency,
        "status": x.status,
        "response_received": x.response_received,
        "created_at": x.created_at.isoformat(),
    }


def serialize_consent(x):
    return {
        "id": x.id,
        "kind": x.kind,
        "template_version": x.template_version,
        "language": x.language,
        "signer_name": x.signer_name,
        "status": x.status,
        "created_at": x.created_at.isoformat(),
    }


def serialize_document(x):
    return {
        "id": x.id,
        "category": x.category,
        "description": x.description,
        "original_name": x.original_name,
        "content_type": x.content_type,
        "size_bytes": x.size_bytes,
        "created_at": x.created_at.isoformat(),
    }


def serialize_dispense(x):
    return {
        "id": x.id,
        "prescription_id": x.prescription_id,
        "status": x.status.value,
        "pharmacist_id": x.pharmacist_id,
        "finalized_at": x.finalized_at.isoformat() if x.finalized_at else None,
    }
