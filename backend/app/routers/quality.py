from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select

from ..audit import log
from ..dependencies import Db, permission
from ..models import Complaint, Incident, Patient, User

router = APIRouter(prefix="/quality", tags=["Quality"])


class ComplaintIn(BaseModel):
    patient_id: int | None = None
    complainant: str
    channel: str
    category: str
    description: str = Field(min_length=3)
    assigned_to_id: int | None = None


class IncidentIn(BaseModel):
    patient_id: int | None = None
    incident_type: str
    occurred_at: datetime
    location: str
    description: str = Field(min_length=3)
    immediate_action: str = Field(min_length=3)
    severity: str
    near_miss: bool = False
    owner_id: int | None = None
    due_date: date | None = None


def validate_refs(db, user, patient_id=None, staff_id=None):
    if patient_id and not db.scalar(
        select(Patient).where(
            Patient.id == patient_id, Patient.clinic_id == user.clinic_id
        )
    ):
        raise HTTPException(400, "Invalid patient")
    if staff_id and not db.scalar(
        select(User).where(User.id == staff_id, User.clinic_id == user.clinic_id)
    ):
        raise HTTPException(400, "Invalid staff member")


def as_utc(value: datetime) -> datetime:
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value


def row(item):
    return {
        column.name: getattr(item, column.name) for column in item.__table__.columns
    }


@router.get("/complaints", response_model=list[dict])
def complaints(db: Db, user=Depends(permission("quality.manage"))):
    return [
        row(item)
        for item in db.scalars(
            select(Complaint)
            .where(Complaint.clinic_id == user.clinic_id)
            .order_by(Complaint.created_at.desc())
        ).all()
    ]


@router.post("/complaints", response_model=dict, status_code=201)
def create_complaint(
    data: ComplaintIn, db: Db, user=Depends(permission("quality.manage"))
):
    validate_refs(db, user, data.patient_id, data.assigned_to_id)
    item = Complaint(
        clinic_id=user.clinic_id, created_by_id=user.id, **data.model_dump()
    )
    db.add(item)
    db.flush()
    log(db, user, "complaint.created", "complaint", item.id)
    db.commit()
    db.refresh(item)
    return row(item)


@router.get("/incidents", response_model=list[dict])
def incidents(db: Db, user=Depends(permission("quality.manage"))):
    return [
        row(item)
        for item in db.scalars(
            select(Incident)
            .where(Incident.clinic_id == user.clinic_id)
            .order_by(Incident.created_at.desc())
        ).all()
    ]


@router.post("/incidents", response_model=dict, status_code=201)
def create_incident(
    data: IncidentIn, db: Db, user=Depends(permission("quality.manage"))
):
    validate_refs(db, user, data.patient_id, data.owner_id)
    if as_utc(data.occurred_at) > datetime.now(timezone.utc) + timedelta(minutes=5):
        raise HTTPException(422, "Incident time cannot be in the future")
    item = Incident(
        clinic_id=user.clinic_id, created_by_id=user.id, **data.model_dump()
    )
    db.add(item)
    db.flush()
    log(db, user, "incident.created", "incident", item.id, {"severity": data.severity})
    db.commit()
    db.refresh(item)
    return row(item)
