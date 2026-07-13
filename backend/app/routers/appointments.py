from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import or_, select
from sqlalchemy.orm import joinedload
from ..audit import log
from ..dependencies import Db, has_permission, permission
from ..models import (
    Appointment,
    AppointmentStatus,
    AppointmentStatusHistory,
    Patient,
    QueueEntry,
    Role,
    ScheduleBlock,
    Service,
    User,
)
from ..schemas import (
    AppointmentCreate,
    AppointmentOut,
    AppointmentStatusUpdate,
    AppointmentHistoryOut,
    AppointmentUpdate,
    QueueOut,
    ScheduleBlockIn,
    ScheduleBlockOut,
)

router = APIRouter(prefix="/appointments", tags=["Appointments"])
managers = permission("appointments.manage_own", "appointments.manage_all")
viewers = permission(
    "appointments.read_own",
    "appointments.read_all",
    "appointments.manage_own",
    "appointments.manage_all",
)


def base(user):
    q = (
        select(Appointment)
        .options(
            joinedload(Appointment.patient),
            joinedload(Appointment.doctor).joinedload(User.clinic),
            joinedload(Appointment.service),
        )
        .where(Appointment.clinic_id == user.clinic_id)
    )
    return (
        q.where(Appointment.doctor_id == user.id)
        if user.role == Role.doctor
        and not has_permission(user, "appointments.manage_all")
        else q
    )


def owned(db, user, item_id):
    item = db.scalar(base(user).where(Appointment.id == item_id))
    if not item:
        raise HTTPException(404, "Appointment not found")
    return item


def validate_refs(db, clinic_id, data):
    if not db.scalar(
        select(Patient).where(
            Patient.id == data.patient_id, Patient.clinic_id == clinic_id
        )
    ):
        raise HTTPException(400, "Invalid patient")
    if not db.scalar(
        select(User).where(
            User.id == data.doctor_id,
            User.clinic_id == clinic_id,
            User.role == Role.doctor,
            User.is_active,
        )
    ):
        raise HTTPException(400, "Invalid doctor")
    if not db.scalar(
        select(Service).where(
            Service.id == data.service_id, Service.clinic_id == clinic_id
        )
    ):
        raise HTTPException(400, "Invalid service")


def authorize_doctor(user, doctor_id: int):
    if not has_permission(user, "appointments.manage_all") and doctor_id != user.id:
        raise HTTPException(403, "You may only manage your own schedule")


def conflicts(db, clinic_id: int, data, exclude_id: int | None = None):
    active = [
        status
        for status in AppointmentStatus
        if status
        not in {
            AppointmentStatus.cancelled,
            AppointmentStatus.no_show,
            AppointmentStatus.rescheduled,
            AppointmentStatus.entered_in_error,
        }
    ]
    query = select(Appointment).where(
        Appointment.clinic_id == clinic_id,
        Appointment.status.in_(active),
        Appointment.start_time < data.end_time,
        Appointment.end_time > data.start_time,
        or_(
            Appointment.doctor_id == data.doctor_id,
            Appointment.room == data.room if data.room else False,
        ),
    )
    if exclude_id:
        query = query.where(Appointment.id != exclude_id)
    block = db.scalar(
        select(ScheduleBlock).where(
            ScheduleBlock.clinic_id == clinic_id,
            ScheduleBlock.doctor_id == data.doctor_id,
            ScheduleBlock.start_time < data.end_time,
            ScheduleBlock.end_time > data.start_time,
        )
    )
    return db.scalar(query), block


def ensure_no_conflict(db, user, data, exclude_id: int | None = None):
    appointment, block = conflicts(db, user.clinic_id, data, exclude_id)
    if not appointment and not block:
        return
    if not data.conflict_override_reason:
        kind = "appointment" if appointment else "blocked time"
        raise HTTPException(409, f"Schedule conflicts with an existing {kind}")
    if len(data.conflict_override_reason.strip()) < 3:
        raise HTTPException(422, "Conflict override reason is required")


def add_history(db, user, item, from_status, to_status, reason=None):
    db.add(
        AppointmentStatusHistory(
            clinic_id=user.clinic_id,
            appointment_id=item.id,
            from_status=from_status,
            to_status=to_status,
            changed_by_id=user.id,
            reason=reason,
        )
    )


@router.get("", response_model=list[AppointmentOut])
def list_appointments(
    db: Db,
    user=Depends(viewers),
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    status: AppointmentStatus | None = None,
):
    q = base(user)
    if date_from:
        q = q.where(Appointment.start_time >= date_from)
    if date_to:
        q = q.where(Appointment.start_time < date_to)
    if status:
        q = q.where(Appointment.status == status)
    return db.scalars(q.order_by(Appointment.start_time)).unique().all()


@router.post("", response_model=AppointmentOut, status_code=201)
def create(data: AppointmentCreate, db: Db, user=Depends(managers)):
    authorize_doctor(user, data.doctor_id)
    validate_refs(db, user.clinic_id, data)
    ensure_no_conflict(db, user, data)
    item = Appointment(
        **data.model_dump(), clinic_id=user.clinic_id, created_by_id=user.id
    )
    db.add(item)
    db.flush()
    add_history(db, user, item, None, data.status.value)
    log(db, user, "appointment.created", "appointment", item.id)
    db.commit()
    return owned(db, user, item.id)


@router.get("/{item_id}", response_model=AppointmentOut)
def get(item_id: int, db: Db, user=Depends(viewers)):
    return owned(db, user, item_id)


@router.put("/{item_id}", response_model=AppointmentOut)
def update(item_id: int, data: AppointmentUpdate, db: Db, user=Depends(managers)):
    item = owned(db, user, item_id)
    authorize_doctor(user, data.doctor_id)
    validate_refs(db, user.clinic_id, data)
    ensure_no_conflict(db, user, data, item.id)
    old_status = item.status.value
    for k, v in data.model_dump().items():
        setattr(item, k, v)
    if old_status != data.status.value:
        add_history(db, user, item, old_status, data.status.value)
    log(db, user, "appointment.updated", "appointment", item.id)
    db.commit()
    return owned(db, user, item.id)


@router.patch("/{item_id}/status", response_model=AppointmentOut)
def status_update(
    item_id: int,
    data: AppointmentStatusUpdate,
    db: Db,
    user=Depends(
        permission("appointments.manage_own", "appointments.manage_all", "queue.manage")
    ),
):
    item = owned(db, user, item_id)
    old = item.status.value
    item.status = data.status
    if data.status == AppointmentStatus.checked_in:
        item.arrival_at = datetime.now(timezone.utc)
        queue = db.scalar(
            select(QueueEntry).where(QueueEntry.appointment_id == item.id)
        )
        if not queue:
            db.add(
                QueueEntry(
                    clinic_id=user.clinic_id,
                    appointment_id=item.id,
                    patient_id=item.patient_id,
                    doctor_id=item.doctor_id,
                    arrived_at=item.arrival_at,
                    room=item.room,
                )
            )
    queue = db.scalar(select(QueueEntry).where(QueueEntry.appointment_id == item.id))
    if queue and data.status in {
        AppointmentStatus.in_progress,
        AppointmentStatus.completed,
    }:
        queue.status = data.status.value
    add_history(db, user, item, old, data.status.value, data.reason)
    log(
        db,
        user,
        "appointment.status_changed",
        "appointment",
        item.id,
        {"from": old, "to": data.status.value, "reason": data.reason},
    )
    db.commit()
    return owned(db, user, item.id)


@router.get("/{item_id}/history", response_model=list[AppointmentHistoryOut])
def history(item_id: int, db: Db, user=Depends(viewers)):
    owned(db, user, item_id)
    return db.scalars(
        select(AppointmentStatusHistory)
        .where(
            AppointmentStatusHistory.appointment_id == item_id,
            AppointmentStatusHistory.clinic_id == user.clinic_id,
        )
        .order_by(AppointmentStatusHistory.created_at)
    ).all()


@router.get("/workflow/queue", response_model=list[QueueOut])
def queue(
    db: Db,
    user=Depends(
        permission("queue.manage", "appointments.manage_own", "appointments.manage_all")
    ),
):
    query = select(QueueEntry).where(QueueEntry.clinic_id == user.clinic_id)
    if user.role == Role.doctor and not has_permission(user, "appointments.manage_all"):
        query = query.where(QueueEntry.doctor_id == user.id)
    return db.scalars(
        query.order_by(QueueEntry.priority.desc(), QueueEntry.arrived_at)
    ).all()


@router.post(
    "/workflow/schedule-blocks", response_model=ScheduleBlockOut, status_code=201
)
def create_block(data: ScheduleBlockIn, db: Db, user=Depends(managers)):
    doctor_id = data.doctor_id or user.id
    authorize_doctor(user, doctor_id)
    if not db.scalar(
        select(User).where(
            User.id == doctor_id,
            User.clinic_id == user.clinic_id,
            User.role == Role.doctor,
        )
    ):
        raise HTTPException(400, "Invalid doctor")
    overlap = db.scalar(
        select(Appointment).where(
            Appointment.clinic_id == user.clinic_id,
            Appointment.doctor_id == doctor_id,
            Appointment.start_time < data.end_time,
            Appointment.end_time > data.start_time,
            Appointment.status.not_in(
                [
                    AppointmentStatus.cancelled,
                    AppointmentStatus.no_show,
                    AppointmentStatus.rescheduled,
                ]
            ),
        )
    )
    if overlap:
        raise HTTPException(409, "Block conflicts with an appointment")
    block = ScheduleBlock(
        clinic_id=user.clinic_id,
        doctor_id=doctor_id,
        start_time=data.start_time,
        end_time=data.end_time,
        kind=data.kind,
        reason=data.reason,
        created_by_id=user.id,
    )
    db.add(block)
    db.flush()
    log(
        db,
        user,
        "schedule.block_created",
        "schedule_block",
        block.id,
        {"kind": data.kind},
    )
    db.commit()
    db.refresh(block)
    return block


@router.get("/workflow/schedule-blocks", response_model=list[ScheduleBlockOut])
def list_blocks(db: Db, user=Depends(viewers), doctor_id: int | None = None):
    query = select(ScheduleBlock).where(ScheduleBlock.clinic_id == user.clinic_id)
    if user.role == Role.doctor and not has_permission(user, "appointments.manage_all"):
        query = query.where(ScheduleBlock.doctor_id == user.id)
    elif doctor_id:
        query = query.where(ScheduleBlock.doctor_id == doctor_id)
    return db.scalars(query.order_by(ScheduleBlock.start_time)).all()
