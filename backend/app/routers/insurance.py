from datetime import date
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import joinedload
from ..audit import log
from ..dependencies import Db, permission
from ..models import ClaimStatus, InsuranceClaim, InsuranceCompany, Invoice, Patient
from ..schemas import ClaimCreate, ClaimOut, ClaimStatusUpdate, CompanyOut

router = APIRouter(prefix="/insurance", tags=["Insurance"])
allowed = permission("claims.manage")

# Every currently-supported claim lifecycle move. Anything not listed here
# (including a status "changing" to itself) is rejected by the backend
# regardless of what the frontend renders, so hidden/disabled buttons are
# never the only thing preventing an invalid transition.
VALID_CLAIM_TRANSITIONS: dict[ClaimStatus, set[ClaimStatus]] = {
    ClaimStatus.draft: {ClaimStatus.submitted},
    ClaimStatus.submitted: {ClaimStatus.approved, ClaimStatus.rejected},
    ClaimStatus.approved: {ClaimStatus.paid},
    ClaimStatus.rejected: {ClaimStatus.submitted},
    ClaimStatus.paid: set(),
}


class ClaimListOut(BaseModel):
    items: list[ClaimOut]
    total: int


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


@router.get("/claims", response_model=ClaimListOut)
def claims(
    db: Db,
    user=Depends(allowed),
    patient: str | None = None,
    company_id: int | None = None,
    status: ClaimStatus | None = None,
    claim_number: str | None = None,
    limit: int = 25,
    offset: int = 0,
):
    query = q(user)
    if patient:
        query = (
            query.join(Invoice, InsuranceClaim.invoice_id == Invoice.id)
            .join(Patient, Invoice.patient_id == Patient.id)
            .where(Patient.full_name.ilike(f"%{patient.strip()}%"))
        )
    if company_id:
        query = query.where(InsuranceClaim.insurance_company_id == company_id)
    if status:
        query = query.where(InsuranceClaim.status == status)
    if claim_number:
        digits = "".join(ch for ch in claim_number if ch.isdigit())
        query = query.where(InsuranceClaim.id == int(digits)) if digits else query.where(False)

    total = db.scalar(
        select(func.count()).select_from(query.with_only_columns(InsuranceClaim.id).subquery())
    )
    rows = (
        db.scalars(
            query.order_by(InsuranceClaim.created_at.desc())
            .limit(max(1, min(limit, 100)))
            .offset(max(0, offset))
        )
        .unique()
        .all()
    )
    return {"items": rows, "total": total or 0}


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
    old = item.status
    if data.status == old:
        raise HTTPException(409, f"Claim is already {old.value}")
    if data.status not in VALID_CLAIM_TRANSITIONS.get(old, set()):
        raise HTTPException(
            409, f"A {old.value} claim cannot move to {data.status.value}"
        )
    item.status = data.status
    if data.status == ClaimStatus.rejected:
        item.rejection_reason = data.rejection_reason or "Requires insurer review"
    elif data.status == ClaimStatus.submitted:
        item.rejection_reason = None
        item.submitted_date = date.today()
    if data.status == ClaimStatus.paid:
        item.paid_date = date.today()
    log(
        db,
        user,
        "claim.status_changed",
        "insurance_claim",
        item.id,
        {"from": old.value, "to": data.status.value},
    )
    db.commit()
    return db.scalar(q(user).where(InsuranceClaim.id == item.id))
