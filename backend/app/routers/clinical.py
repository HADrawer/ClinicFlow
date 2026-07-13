from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select

from ..audit import log
from ..dependencies import Db, permission
from ..models import (
    Allergy,
    Appointment,
    ClinicalOrder,
    Consent,
    Patient,
    Referral,
    Role,
    User,
    Visit,
    WaitlistEntry,
)
from ..schemas import (
    AllergyIn,
    AllergyOut,
    ClinicalOrderIn,
    ClinicalOrderOut,
    ConsentIn,
    ConsentOut,
    ReferralIn,
    ReferralOut,
    WaitlistIn,
    WaitlistOut,
)

router = APIRouter(tags=["Patient journey"])


def patient_owned(db, user, patient_id: int):
    query = select(Patient).where(
        Patient.id == patient_id, Patient.clinic_id == user.clinic_id
    )
    if user.role == Role.doctor:
        query = query.where(
            Patient.id.in_(
                select(Appointment.patient_id).where(
                    Appointment.clinic_id == user.clinic_id,
                    Appointment.doctor_id == user.id,
                )
            )
        )
    patient = db.scalar(query)
    if not patient:
        raise HTTPException(404, "Patient not found")
    return patient


@router.get("/patients/{patient_id}/allergies", response_model=list[AllergyOut])
def allergies(patient_id: int, db: Db, user=Depends(permission("patients.read"))):
    patient_owned(db, user, patient_id)
    return db.scalars(
        select(Allergy)
        .where(Allergy.clinic_id == user.clinic_id, Allergy.patient_id == patient_id)
        .order_by(Allergy.created_at.desc())
    ).all()


@router.post(
    "/patients/{patient_id}/allergies", response_model=AllergyOut, status_code=201
)
def add_allergy(
    patient_id: int,
    data: AllergyIn,
    db: Db,
    user=Depends(permission("patients.update")),
):
    patient = patient_owned(db, user, patient_id)
    item = Allergy(
        clinic_id=user.clinic_id,
        patient_id=patient.id,
        recorded_by_id=user.id,
        **data.model_dump(),
    )
    db.add(item)
    db.flush()
    active = db.scalars(
        select(Allergy.substance).where(
            Allergy.clinic_id == user.clinic_id,
            Allergy.patient_id == patient.id,
            Allergy.status == "active",
        )
    ).all()
    patient.allergies = ", ".join(sorted(set(active)))
    log(db, user, "allergy.recorded", "allergy", item.id)
    db.commit()
    db.refresh(item)
    return item


@router.get("/orders", response_model=list[ClinicalOrderOut])
def orders(
    db: Db, user=Depends(permission("orders.manage")), patient_id: int | None = None
):
    query = select(ClinicalOrder).where(ClinicalOrder.clinic_id == user.clinic_id)
    if user.role == Role.doctor:
        query = query.where(ClinicalOrder.ordered_by_id == user.id)
    if patient_id:
        query = query.where(ClinicalOrder.patient_id == patient_id)
    return db.scalars(query.order_by(ClinicalOrder.created_at.desc())).all()


@router.post("/orders", response_model=ClinicalOrderOut, status_code=201)
def create_order(
    data: ClinicalOrderIn, db: Db, user=Depends(permission("orders.manage"))
):
    patient_owned(db, user, data.patient_id)
    if data.kind not in {"lab", "imaging"}:
        raise HTTPException(422, "Order kind must be lab or imaging")
    if data.visit_id and not db.scalar(
        select(Visit).where(
            Visit.id == data.visit_id,
            Visit.clinic_id == user.clinic_id,
            Visit.patient_id == data.patient_id,
        )
    ):
        raise HTTPException(400, "Invalid encounter")
    item = ClinicalOrder(
        clinic_id=user.clinic_id, ordered_by_id=user.id, **data.model_dump()
    )
    db.add(item)
    db.flush()
    log(db, user, "order.created", "clinical_order", item.id, {"kind": data.kind})
    db.commit()
    db.refresh(item)
    return item


@router.patch("/orders/{item_id}", response_model=ClinicalOrderOut)
def update_order(
    item_id: int, data: dict, db: Db, user=Depends(permission("orders.manage"))
):
    item = db.scalar(
        select(ClinicalOrder).where(
            ClinicalOrder.id == item_id,
            ClinicalOrder.clinic_id == user.clinic_id,
        )
    )
    if not item:
        raise HTTPException(404, "Order not found")
    allowed = {"status", "result_summary"}
    for key, value in data.items():
        if key in allowed:
            setattr(item, key, value)
    log(db, user, "order.updated", "clinical_order", item.id, {"status": item.status})
    db.commit()
    db.refresh(item)
    return item


@router.get("/referrals", response_model=list[ReferralOut])
def referrals(
    db: Db, user=Depends(permission("referrals.manage")), patient_id: int | None = None
):
    query = select(Referral).where(Referral.clinic_id == user.clinic_id)
    if user.role == Role.doctor:
        query = query.where(Referral.referring_doctor_id == user.id)
    if patient_id:
        query = query.where(Referral.patient_id == patient_id)
    return db.scalars(query.order_by(Referral.created_at.desc())).all()


@router.post("/referrals", response_model=ReferralOut, status_code=201)
def create_referral(
    data: ReferralIn, db: Db, user=Depends(permission("referrals.manage"))
):
    patient_owned(db, user, data.patient_id)
    doctor_id = user.id
    if user.role != Role.doctor:
        raise HTTPException(403, "A doctor must create the referral")
    item = Referral(
        clinic_id=user.clinic_id,
        referring_doctor_id=doctor_id,
        **data.model_dump(),
    )
    db.add(item)
    db.flush()
    log(db, user, "referral.created", "referral", item.id)
    db.commit()
    db.refresh(item)
    return item


@router.get("/consents", response_model=list[ConsentOut])
def consents(
    db: Db, user=Depends(permission("consents.manage")), patient_id: int | None = None
):
    query = select(Consent).where(Consent.clinic_id == user.clinic_id)
    if patient_id:
        query = query.where(Consent.patient_id == patient_id)
    return db.scalars(query.order_by(Consent.created_at.desc())).all()


@router.post("/consents", response_model=ConsentOut, status_code=201)
def create_consent(
    data: ConsentIn, db: Db, user=Depends(permission("consents.manage"))
):
    patient_owned(db, user, data.patient_id)
    item = Consent(
        clinic_id=user.clinic_id, recorded_by_id=user.id, **data.model_dump()
    )
    db.add(item)
    db.flush()
    log(db, user, "consent.recorded", "consent", item.id, {"status": data.status})
    db.commit()
    db.refresh(item)
    return item


@router.get("/waitlist", response_model=list[WaitlistOut])
def waitlist(
    db: Db, user=Depends(permission("waitlist.manage", "appointments.manage_own"))
):
    query = select(WaitlistEntry).where(WaitlistEntry.clinic_id == user.clinic_id)
    if user.role == Role.doctor:
        query = query.where(WaitlistEntry.doctor_id == user.id)
    return db.scalars(
        query.order_by(WaitlistEntry.priority.desc(), WaitlistEntry.created_at)
    ).all()


@router.post("/waitlist", response_model=WaitlistOut, status_code=201)
def add_waitlist(
    data: WaitlistIn,
    db: Db,
    user=Depends(permission("waitlist.manage", "appointments.manage_own")),
):
    patient_owned(db, user, data.patient_id)
    if user.role == Role.doctor and data.doctor_id not in {None, user.id}:
        raise HTTPException(403, "You may only manage your own waitlist")
    doctor_id = user.id if user.role == Role.doctor else data.doctor_id
    if doctor_id and not db.scalar(
        select(User).where(
            User.id == doctor_id,
            User.clinic_id == user.clinic_id,
            User.role == Role.doctor,
        )
    ):
        raise HTTPException(400, "Invalid doctor")
    item = WaitlistEntry(
        clinic_id=user.clinic_id,
        doctor_id=doctor_id,
        **data.model_dump(exclude={"doctor_id"}),
    )
    db.add(item)
    db.flush()
    log(db, user, "waitlist.created", "waitlist_entry", item.id)
    db.commit()
    db.refresh(item)
    return item
