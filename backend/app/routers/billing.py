from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import joinedload, selectinload
from ..audit import log
from ..dependencies import Db, roles
from ..models import (
    Appointment,
    Invoice,
    InvoiceItem,
    Patient,
    PaymentStatus,
    Role,
    Visit,
)
from ..schemas import InvoiceCreate, InvoiceOut

router = APIRouter(prefix="/billing", tags=["Billing"])
allowed = roles(Role.owner, Role.receptionist, Role.accountant)


def query(user):
    return (
        select(Invoice)
        .options(joinedload(Invoice.patient), selectinload(Invoice.items))
        .where(Invoice.clinic_id == user.clinic_id)
    )


@router.get("/invoices", response_model=list[InvoiceOut])
def list_invoices(db: Db, user=Depends(allowed)):
    return db.scalars(query(user).order_by(Invoice.created_at.desc())).unique().all()


@router.post("/invoices", response_model=InvoiceOut, status_code=201)
def create(data: InvoiceCreate, db: Db, user=Depends(allowed)):
    if not db.scalar(
        select(Patient).where(
            Patient.id == data.patient_id, Patient.clinic_id == user.clinic_id
        )
    ):
        raise HTTPException(400, "Invalid patient")
    if data.appointment_id and not db.scalar(
        select(Appointment).where(
            Appointment.id == data.appointment_id,
            Appointment.clinic_id == user.clinic_id,
        )
    ):
        raise HTTPException(400, "Invalid appointment")
    if data.visit_id and not db.scalar(
        select(Visit).where(
            Visit.id == data.visit_id, Visit.clinic_id == user.clinic_id
        )
    ):
        raise HTTPException(400, "Invalid visit")
    subtotal = sum((i.unit_price * i.quantity for i in data.items), Decimal("0"))
    total = subtotal - data.discount + data.vat
    if total < 0 or data.paid_amount > total:
        raise HTTPException(422, "Invoice totals are invalid")
    status = (
        PaymentStatus.paid
        if data.paid_amount == total
        else PaymentStatus.partial
        if data.paid_amount > 0
        else PaymentStatus.unpaid
    )
    count = (
        db.scalar(
            select(Invoice.id)
            .where(Invoice.clinic_id == user.clinic_id)
            .order_by(Invoice.id.desc())
            .limit(1)
        )
        or 0
    )
    item = Invoice(
        clinic_id=user.clinic_id,
        patient_id=data.patient_id,
        appointment_id=data.appointment_id,
        visit_id=data.visit_id,
        discount=data.discount,
        vat=data.vat,
        total_amount=total,
        paid_amount=data.paid_amount,
        payment_status=status,
        payment_method=data.payment_method,
        invoice_number=f"INV-{count + 1:05d}",
        items=[InvoiceItem(**i.model_dump()) for i in data.items],
    )
    db.add(item)
    db.flush()
    log(db, user, "invoice.created", "invoice", item.id, {"total": str(total)})
    db.commit()
    return db.scalar(query(user).where(Invoice.id == item.id))


@router.get("/invoices/{item_id}", response_model=InvoiceOut)
def get(item_id: int, db: Db, user=Depends(allowed)):
    item = db.scalar(query(user).where(Invoice.id == item_id))
    if not item:
        raise HTTPException(404, "Invoice not found")
    return item
