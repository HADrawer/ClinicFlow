from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import joinedload
from ..dependencies import Db, roles
from ..message_variables import render_template
from ..models import (
    Appointment,
    Message,
    MessageStatus,
    MessageTemplate,
    Patient,
    Prescription,
    Role,
)
from ..schemas import MessageCreate, MessageOut, TemplateOut

router = APIRouter(prefix="/messages", tags=["WhatsApp mock"])
allowed = roles(Role.owner, Role.doctor, Role.receptionist)


@router.get("", response_model=list[MessageOut])
def messages(db: Db, user=Depends(allowed)):
    return db.scalars(
        select(Message)
        .options(joinedload(Message.patient))
        .where(Message.clinic_id == user.clinic_id)
        .order_by(Message.created_at.desc())
    ).all()


@router.get("/templates", response_model=list[TemplateOut])
def templates(db: Db, user=Depends(allowed)):
    return db.scalars(
        select(MessageTemplate)
        .where(MessageTemplate.clinic_id == user.clinic_id)
        .order_by(MessageTemplate.kind, MessageTemplate.language)
    ).all()


@router.post("", response_model=MessageOut, status_code=201)
def send(data: MessageCreate, db: Db, user=Depends(allowed)):
    patient = db.scalar(
        select(Patient).where(
            Patient.id == data.patient_id, Patient.clinic_id == user.clinic_id
        )
    )
    if not patient:
        raise HTTPException(400, "Invalid patient")
    if data.appointment_id and not db.scalar(
        select(Appointment).where(
            Appointment.id == data.appointment_id,
            Appointment.clinic_id == user.clinic_id,
        )
    ):
        raise HTTPException(400, "Invalid appointment")
    if data.prescription_id and not db.scalar(
        select(Prescription).where(
            Prescription.id == data.prescription_id,
            Prescription.clinic_id == user.clinic_id,
        )
    ):
        raise HTTPException(400, "Invalid prescription")
    body = data.body
    if not body:
        template = db.scalar(
            select(MessageTemplate)
            .where(
                MessageTemplate.clinic_id == user.clinic_id,
                MessageTemplate.kind == data.kind,
            )
            .order_by(MessageTemplate.language.desc())
        )
        if template:
            appointment = (
                db.get(Appointment, data.appointment_id)
                if data.appointment_id
                else None
            )
            values = {
                "patient_name": patient.full_name,
                "clinic_name": user.clinic.name,
                "doctor_name": appointment.doctor.full_name if appointment else "",
                "appointment_date": appointment.start_time.date().isoformat()
                if appointment
                else "",
                "appointment_time": appointment.start_time.strftime("%H:%M")
                if appointment
                else "",
                "service_name": appointment.service.name if appointment else "",
                "invoice_number": "",
                "amount": "",
            }
            body = render_template(template.body, values)
        else:
            body = "You have a new message from your clinic."
    item = Message(
        **data.model_dump(exclude={"body"}),
        body=body,
        clinic_id=user.clinic_id,
        recipient_phone=patient.phone,
        status=MessageStatus.sent,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item
