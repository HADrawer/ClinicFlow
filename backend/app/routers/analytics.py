from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from fastapi import APIRouter, Depends
from sqlalchemy import select
from ..dependencies import Db, roles
from ..models import (
    Appointment,
    AppointmentStatus,
    AuditLog,
    ClaimStatus,
    InsuranceClaim,
    Invoice,
    Patient,
    PaymentStatus,
    Role,
    User,
)
from ..schemas import Dashboard

router = APIRouter(prefix="/analytics", tags=["Analytics"])


@router.get("/dashboard", response_model=Dashboard)
def dashboard(
    db: Db,
    user=Depends(
        roles(Role.owner, Role.doctor, Role.receptionist, Role.accountant, Role.nurse)
    ),
):
    now = datetime.now(timezone.utc)
    today = now.date()
    week_end = today + timedelta(days=7)
    month_start = today.replace(day=1)
    appointments = list(
        db.scalars(
            select(Appointment).where(Appointment.clinic_id == user.clinic_id)
        ).all()
    )
    if user.role == Role.doctor:
        appointments = [item for item in appointments if item.doctor_id == user.id]
    invoices = list(
        db.scalars(select(Invoice).where(Invoice.clinic_id == user.clinic_id)).all()
    )
    if user.role not in {Role.owner, Role.accountant}:
        invoices = []
    claims = list(
        db.scalars(
            select(InsuranceClaim).where(InsuranceClaim.clinic_id == user.clinic_id)
        ).all()
    )
    if user.role not in {Role.owner, Role.accountant}:
        claims = []
    patients = list(
        db.scalars(select(Patient).where(Patient.clinic_id == user.clinic_id)).all()
    )
    if user.role == Role.doctor:
        assigned = {item.patient_id for item in appointments}
        patients = [patient for patient in patients if patient.id in assigned]
    statuses = Counter(a.status.value for a in appointments)
    total_finished = statuses["completed"] + statuses["no_show"]
    month_revenue = sum(
        (i.paid_amount for i in invoices if i.created_at.date() >= month_start),
        Decimal("0"),
    )
    pending = sum(
        (
            c.claim_amount
            for c in claims
            if c.status
            in [ClaimStatus.draft, ClaimStatus.submitted, ClaimStatus.approved]
        ),
        Decimal("0"),
    )
    doctor_counts = Counter(a.doctor.full_name for a in appointments)
    upcoming = sorted(
        [
            a
            for a in appointments
            if aware(a.start_time) >= now
            and a.status
            not in [AppointmentStatus.cancelled, AppointmentStatus.completed]
        ],
        key=lambda a: a.start_time,
    )[:8]
    logs = (
        db.scalars(
            select(AuditLog)
            .where(AuditLog.clinic_id == user.clinic_id)
            .order_by(AuditLog.created_at.desc())
            .limit(8)
        ).all()
        if user.role == Role.owner
        else []
    )
    monthly = defaultdict(Decimal)
    methods = defaultdict(Decimal)
    for i in invoices:
        monthly[i.created_at.strftime("%Y-%m")] += i.paid_amount
        methods[i.payment_method or "unassigned"] += i.paid_amount
    doctors = db.scalars(
        select(User).where(User.clinic_id == user.clinic_id, User.role == Role.doctor)
    ).all()
    utilization = []
    for d in doctors:
        count = sum(
            1
            for a in appointments
            if a.doctor_id == d.id
            and a.status in [AppointmentStatus.completed, AppointmentStatus.confirmed]
        )
        utilization.append(
            {
                "doctor": d.full_name,
                "booked_slots": count,
                "utilization": min(round(count / 40 * 100), 100),
            }
        )
    returning_ids = {
        a.patient_id
        for a in appointments
        if aware(a.start_time) < now - timedelta(days=30)
    }
    return Dashboard(
        today_appointments=sum(1 for a in appointments if a.start_time.date() == today),
        week_appointments=sum(
            1 for a in appointments if today <= a.start_time.date() < week_end
        ),
        no_show_rate=round(statuses["no_show"] / total_finished * 100, 1)
        if total_finished
        else 0,
        monthly_revenue=month_revenue,
        pending_insurance=pending,
        new_patients=sum(1 for p in patients if p.created_at.date() >= month_start),
        status_breakdown=dict(statuses),
        top_doctors=[
            {"doctor": n, "appointments": c} for n, c in doctor_counts.most_common(5)
        ],
        recent_activity=[
            {
                "action": x.action,
                "entity_type": x.entity_type,
                "created_at": x.created_at.isoformat(),
                "details": x.details,
            }
            for x in logs
        ],
        upcoming_appointments=[
            {
                "id": a.id,
                "time": a.start_time.isoformat(),
                "patient": a.patient.full_name,
                "doctor": a.doctor.full_name,
                "service": a.service.name,
                "status": a.status.value,
            }
            for a in upcoming
        ],
        revenue_by_month=[
            {"month": k, "amount": float(v)} for k, v in sorted(monthly.items())[-6:]
        ],
        payment_methods=[{"method": k, "amount": float(v)} for k, v in methods.items()],
        outstanding_balances=sum(
            (
                i.balance_due
                for i in invoices
                if i.payment_status not in [PaymentStatus.paid, PaymentStatus.void]
            ),
            Decimal("0"),
        ),
        new_vs_returning={
            "new": len(patients) - len(returning_ids),
            "returning": len(returning_ids),
        },
        doctor_utilization=utilization,
    )


def aware(value):
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value
