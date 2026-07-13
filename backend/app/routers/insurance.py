from datetime import date
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import joinedload
from ..audit import log
from ..dependencies import Db, roles
from ..models import ClaimStatus, InsuranceClaim, InsuranceCompany, Invoice, Role
from ..schemas import ClaimCreate, ClaimOut, ClaimStatusUpdate, CompanyOut

router = APIRouter(prefix="/insurance", tags=["Insurance"])
allowed = roles(Role.owner, Role.accountant)


def q(user):
    return (
        select(InsuranceClaim)
        .options(
            joinedload(InsuranceClaim.company),
            joinedload(InsuranceClaim.invoice).joinedload(Invoice.patient),
            joinedload(InsuranceClaim.invoice).selectinload(Invoice.items),
        )
        .where(InsuranceClaim.clinic_id == user.clinic_id)
    )


@router.get("/companies", response_model=list[CompanyOut])
def companies(db: Db, user=Depends(allowed)):
    return db.scalars(
        select(InsuranceCompany).where(
            InsuranceCompany.clinic_id == user.clinic_id, InsuranceCompany.active
        )
    ).all()


@router.get("/claims", response_model=list[ClaimOut])
def claims(db: Db, user=Depends(allowed)):
    return db.scalars(q(user).order_by(InsuranceClaim.created_at.desc())).unique().all()


@router.post("/claims", response_model=ClaimOut, status_code=201)
def create(data: ClaimCreate, db: Db, user=Depends(allowed)):
    invoice = db.scalar(
        select(Invoice).where(
            Invoice.id == data.invoice_id, Invoice.clinic_id == user.clinic_id
        )
    )
    company = db.scalar(
        select(InsuranceCompany).where(
            InsuranceCompany.id == data.insurance_company_id,
            InsuranceCompany.clinic_id == user.clinic_id,
        )
    )
    if not invoice or not company:
        raise HTTPException(400, "Invalid invoice or insurer")
    if data.claim_amount > invoice.balance_due:
        raise HTTPException(422, "Claim amount cannot exceed invoice balance")
    item = InsuranceClaim(**data.model_dump(), clinic_id=user.clinic_id)
    db.add(item)
    db.commit()
    return db.scalar(q(user).where(InsuranceClaim.id == item.id))


@router.get("/claims/{item_id}", response_model=ClaimOut)
def get(item_id: int, db: Db, user=Depends(allowed)):
    item = db.scalar(q(user).where(InsuranceClaim.id == item_id))
    if not item:
        raise HTTPException(404, "Claim not found")
    return item


@router.patch("/claims/{item_id}/status", response_model=ClaimOut)
def update(item_id: int, data: ClaimStatusUpdate, db: Db, user=Depends(allowed)):
    item = db.scalar(
        select(InsuranceClaim).where(
            InsuranceClaim.id == item_id, InsuranceClaim.clinic_id == user.clinic_id
        )
    )
    if not item:
        raise HTTPException(404, "Claim not found")
    old = item.status.value
    item.status = data.status
    item.rejection_reason = data.rejection_reason
    if data.status == ClaimStatus.submitted:
        item.submitted_date = date.today()
    if data.status == ClaimStatus.paid:
        item.paid_date = date.today()
    log(
        db,
        user,
        "claim.status_changed",
        "insurance_claim",
        item.id,
        {"from": old, "to": data.status.value},
    )
    db.commit()
    return db.scalar(q(user).where(InsuranceClaim.id == item.id))
