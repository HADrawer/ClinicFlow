from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import joinedload
from ..audit import log
from ..dependencies import Db, permission, roles
from ..models import (
    Appointment,
    AppointmentStatus,
    EncounterAmendment,
    EncounterStatus,
    Patient,
    Role,
    User,
    Visit,
)
from ..schemas import AmendmentCreate, AmendmentOut, VisitCreate, VisitOut, VisitUpdate

router = APIRouter(prefix="/visits", tags=["Visits / EMR"])


@router.get("", response_model=list[VisitOut])
def list_visits(
    db: Db, user=Depends(roles(Role.owner, Role.doctor)), patient_id: int | None = None
):
    q = (
        select(Visit)
        .options(
            joinedload(Visit.doctor).joinedload(User.clinic), joinedload(Visit.patient)
        )
        .where(Visit.clinic_id == user.clinic_id)
    )
    if user.role == Role.doctor:
        q = q.where(Visit.doctor_id == user.id)
    if patient_id:
        q = q.where(Visit.patient_id == patient_id)
    return db.scalars(q.order_by(Visit.created_at.desc())).unique().all()


@router.post("", response_model=VisitOut, status_code=201)
def create(data: VisitCreate, db: Db, user=Depends(roles(Role.owner, Role.doctor))):
    if not db.scalar(
        select(Patient).where(
            Patient.id == data.patient_id, Patient.clinic_id == user.clinic_id
        )
    ):
        raise HTTPException(400, "Invalid patient")
    doctor_id = data.doctor_id or user.id
    if user.role == Role.doctor and doctor_id != user.id:
        raise HTTPException(403, "Doctors may only sign their own notes")
    if not db.scalar(
        select(User).where(
            User.id == doctor_id,
            User.clinic_id == user.clinic_id,
            User.role == Role.doctor,
        )
    ):
        raise HTTPException(400, "Invalid doctor")
    if data.appointment_id and not db.scalar(
        select(Appointment).where(
            Appointment.id == data.appointment_id,
            Appointment.clinic_id == user.clinic_id,
        )
    ):
        raise HTTPException(400, "Invalid appointment")
    item = Visit(
        **data.model_dump(exclude={"doctor_id"}),
        doctor_id=doctor_id,
        clinic_id=user.clinic_id,
    )
    db.add(item)
    db.flush()
    if item.appointment_id:
        appointment = db.get(Appointment, item.appointment_id)
        appointment.status = AppointmentStatus.in_progress
    log(db, user, "visit.created", "visit", item.id)
    db.commit()
    return db.scalar(
        select(Visit)
        .options(
            joinedload(Visit.doctor).joinedload(User.clinic), joinedload(Visit.patient)
        )
        .where(Visit.id == item.id)
    )


def owned_visit(db, user, visit_id: int) -> Visit:
    query = select(Visit).where(Visit.id == visit_id, Visit.clinic_id == user.clinic_id)
    if user.role == Role.doctor:
        query = query.where(Visit.doctor_id == user.id)
    item = db.scalar(query)
    if not item:
        raise HTTPException(404, "Encounter not found")
    return item


@router.get("/{visit_id}", response_model=VisitOut)
def get_visit(
    visit_id: int, db: Db, user=Depends(roles(Role.owner, Role.doctor, Role.nurse))
):
    return owned_visit(db, user, visit_id)


@router.put("/{visit_id}", response_model=VisitOut)
def update_visit(
    visit_id: int,
    data: VisitUpdate,
    db: Db,
    user=Depends(permission("encounters.create")),
):
    item = owned_visit(db, user, visit_id)
    if item.status in {EncounterStatus.finalized, EncounterStatus.amended}:
        raise HTTPException(409, "Finalized encounters cannot be edited")
    for key, value in data.model_dump().items():
        setattr(item, key, value)
    item.updated_at = datetime.now(timezone.utc)
    log(db, user, "encounter.updated", "visit", item.id)
    db.commit()
    db.refresh(item)
    return item


@router.post("/{visit_id}/finalize", response_model=VisitOut)
def finalize_visit(
    visit_id: int,
    db: Db,
    user=Depends(permission("encounters.finalize")),
):
    item = owned_visit(db, user, visit_id)
    if item.status in {EncounterStatus.finalized, EncounterStatus.amended}:
        raise HTTPException(409, "Encounter is already finalized")
    required = [
        item.subjective,
        item.objective,
        item.assessment,
        item.plan,
        item.diagnosis,
    ]
    if any(not value.strip() for value in required):
        raise HTTPException(422, "All SOAP sections and diagnosis are required")
    item.status = EncounterStatus.finalized
    item.finalized_by_id = user.id
    item.finalized_at = datetime.now(timezone.utc)
    if item.appointment_id:
        appointment = db.scalar(
            select(Appointment).where(
                Appointment.id == item.appointment_id,
                Appointment.clinic_id == user.clinic_id,
            )
        )
        if appointment:
            appointment.status = AppointmentStatus.completed
    log(db, user, "encounter.finalized", "visit", item.id)
    db.commit()
    db.refresh(item)
    return item


@router.post("/{visit_id}/amendments", response_model=AmendmentOut, status_code=201)
def amend_visit(
    visit_id: int,
    data: AmendmentCreate,
    db: Db,
    user=Depends(permission("encounters.amend")),
):
    item = owned_visit(db, user, visit_id)
    if item.status not in {EncounterStatus.finalized, EncounterStatus.amended}:
        raise HTTPException(409, "Only finalized encounters can be amended")
    amendment = EncounterAmendment(
        clinic_id=user.clinic_id,
        visit_id=item.id,
        author_id=user.id,
        reason=data.reason,
        content=data.content,
    )
    db.add(amendment)
    item.status = EncounterStatus.amended
    db.flush()
    log(db, user, "encounter.amended", "visit", item.id, {"reason": data.reason})
    db.commit()
    db.refresh(amendment)
    return amendment


@router.get("/{visit_id}/amendments", response_model=list[AmendmentOut])
def amendments(
    visit_id: int,
    db: Db,
    user=Depends(roles(Role.owner, Role.doctor, Role.nurse)),
):
    owned_visit(db, user, visit_id)
    return db.scalars(
        select(EncounterAmendment)
        .where(
            EncounterAmendment.visit_id == visit_id,
            EncounterAmendment.clinic_id == user.clinic_id,
        )
        .order_by(EncounterAmendment.created_at)
    ).all()
