from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from ..dependencies import Db, roles
from ..models import Prescription, PrescriptionItem, Role, Visit
from ..schemas import PrescriptionCreate, PrescriptionOut

router = APIRouter(prefix="/prescriptions", tags=["Prescriptions"])


@router.get("", response_model=list[PrescriptionOut])
def list_items(
    db: Db, user=Depends(roles(Role.owner, Role.doctor)), patient_id: int | None = None
):
    q = (
        select(Prescription)
        .options(selectinload(Prescription.items))
        .where(Prescription.clinic_id == user.clinic_id)
    )
    if user.role == Role.doctor:
        q = q.join(Visit, Visit.id == Prescription.visit_id).where(
            Visit.doctor_id == user.id
        )
    if patient_id:
        q = q.where(Prescription.patient_id == patient_id)
    return db.scalars(q.order_by(Prescription.created_at.desc())).all()


@router.post("", response_model=PrescriptionOut, status_code=201)
def create(
    data: PrescriptionCreate, db: Db, user=Depends(roles(Role.owner, Role.doctor))
):
    visit = db.scalar(
        select(Visit).where(
            Visit.id == data.visit_id,
            Visit.clinic_id == user.clinic_id,
            Visit.patient_id == data.patient_id,
        )
    )
    if not visit:
        raise HTTPException(400, "Visit and patient do not match")
    if user.role == Role.doctor and visit.doctor_id != user.id:
        raise HTTPException(403, "Cannot prescribe for another doctor's visit")
    item = Prescription(
        clinic_id=user.clinic_id,
        visit_id=data.visit_id,
        patient_id=data.patient_id,
        items=[PrescriptionItem(**i.model_dump()) for i in data.items],
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.get("/{item_id}", response_model=PrescriptionOut)
def get(item_id: int, db: Db, user=Depends(roles(Role.owner, Role.doctor))):
    q = (
        select(Prescription)
        .options(selectinload(Prescription.items))
        .where(Prescription.id == item_id, Prescription.clinic_id == user.clinic_id)
    )
    if user.role == Role.doctor:
        q = q.join(Visit, Visit.id == Prescription.visit_id).where(
            Visit.doctor_id == user.id
        )
    item = db.scalar(q)
    if not item:
        raise HTTPException(404, "Prescription not found")
    return item
