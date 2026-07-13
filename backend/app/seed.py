"""Idempotent, realistic demo data for Seef Family Clinic in Bahrain."""

from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
import random
from sqlalchemy import select
from .database import SessionLocal
from .models import (
    Appointment,
    AppointmentStatus,
    AuditLog,
    Allergy,
    ClaimStatus,
    ClinicalOrder,
    Clinic,
    DoctorProfile,
    EncounterAmendment,
    EncounterStatus,
    InsuranceClaim,
    InsuranceCompany,
    Invoice,
    InvoiceItem,
    Message,
    MessageStatus,
    MessageTemplate,
    Medicine,
    MedicineBatch,
    Patient,
    PaymentStatus,
    Prescription,
    PrescriptionItem,
    PurchaseOrder,
    PurchaseOrderItem,
    PurchaseOrderStatus,
    QueueEntry,
    Role,
    Service,
    StockMovement,
    Supplier,
    User,
    Visit,
)
from .security import hash_password

random.seed(26)
NAMES = [
    "Ahmed Al Khalifa",
    "Fatima Al Zayani",
    "Mohammed Al Doseri",
    "Noor Al Mahmood",
    "Yusuf Al Ansari",
    "Mariam Al Sayed",
    "Ali Hassan",
    "Zainab Jassim",
    "Omar Al Arrayed",
    "Sara Kanoo",
    "Hamad Al Mannai",
    "Lulwa Fakhro",
    "Abdulla Al Nooh",
    "Aisha Al Balooshi",
    "Khalid Al Shaikh",
    "Dana Al Wazzan",
    "Salman Al Qassab",
    "Reem Al Kooheji",
    "Nasser Al Musallam",
    "Hessa Al Thawadi",
]
NATIONALITIES = [
    "Bahraini",
    "Bahraini",
    "Bahraini",
    "Saudi",
    "Kuwaiti",
    "Omani",
    "Indian",
    "British",
]


def run():
    db = SessionLocal()
    try:
        existing = db.scalar(select(Clinic).where(Clinic.name == "Seef Family Clinic"))
        if existing:
            seed_expansion(db, existing)
            db.commit()
            print("Demo data already present; expansion seed verified.")
            return
        clinic = Clinic(
            name="Seef Family Clinic",
            address="Road 2819, Seef District, Manama, Bahrain",
            phone="+973 1700 4422",
            logo_url=None,
            working_hours={
                "sunday": "08:00–20:00",
                "monday": "08:00–20:00",
                "tuesday": "08:00–20:00",
                "wednesday": "08:00–20:00",
                "thursday": "08:00–18:00",
                "friday": "Closed",
                "saturday": "09:00–14:00",
            },
        )
        db.add(clinic)
        db.flush()
        users = [
            ("owner@clinicflow.test", "Mariam Al Fardan", Role.owner, None),
            (
                "doctor@clinicflow.test",
                "Dr. Layla Al Khalifa",
                Role.doctor,
                "Family Medicine",
            ),
            (
                "dr.yusuf@clinicflow.test",
                "Dr. Yusuf Al Ansari",
                Role.doctor,
                "Internal Medicine",
            ),
            (
                "dr.sara@clinicflow.test",
                "Dr. Sara Al Mahmood",
                Role.doctor,
                "Paediatrics",
            ),
            ("reception@clinicflow.test", "Noor Jassim", Role.receptionist, None),
            ("reception2@clinicflow.test", "Hessa Ali", Role.receptionist, None),
            ("accountant@clinicflow.test", "Ahmed Fakhro", Role.accountant, None),
        ]
        staff = []
        for email, name, role, specialty in users:
            u = User(
                clinic_id=clinic.id,
                email=email,
                full_name=name,
                password_hash=hash_password("password123"),
                role=role,
                specialty=specialty,
            )
            db.add(u)
            staff.append(u)
        db.flush()
        doctors = [u for u in staff if u.role == Role.doctor]
        service_data = [
            ("General consultation", "25.000", 30),
            ("Follow-up consultation", "15.000", 20),
            ("Paediatric consultation", "28.000", 30),
            ("Annual health screening", "55.000", 45),
            ("ECG", "18.000", 20),
            ("Blood test panel", "35.000", 15),
        ]
        services = []
        for name, price, duration in service_data:
            s = Service(
                clinic_id=clinic.id,
                name=name,
                price=Decimal(price),
                duration_minutes=duration,
            )
            db.add(s)
            services.append(s)
        companies = []
        for name in ["Takaful International", "AXA", "MedNet", "Bupa", "GIG Gulf"]:
            c = InsuranceCompany(clinic_id=clinic.id, name=name)
            db.add(c)
            companies.append(c)
        templates = [
            (
                "Appointment reminder",
                "appointment_reminder",
                "en",
                "Reminder: You have an appointment at {clinic_name} on {date} at {time}. Please reply YES to confirm.",
            ),
            (
                "تذكير بالموعد",
                "appointment_reminder",
                "ar",
                "تذكير: لديك موعد في {clinic_name} بتاريخ {date} الساعة {time}. للتاكيد يرجى الرد بنعم.",
            ),
            (
                "No-show follow-up",
                "no_show",
                "en",
                "You missed your appointment today at {clinic_name}. Contact us to rebook.",
            ),
            (
                "متابعة عدم الحضور",
                "no_show",
                "ar",
                "لم تحضر موعدك اليوم في {clinic_name}. يمكنك إعادة الحجز من خلال التواصل معنا.",
            ),
            (
                "Prescription ready",
                "prescription",
                "en",
                "Your prescription is ready. Please follow your doctor's instructions.",
            ),
            (
                "الوصفة جاهزة",
                "prescription",
                "ar",
                "وصفتك الطبية جاهزة. يرجى اتباع تعليمات الطبيب.",
            ),
        ]
        for name, kind, lang, body in templates:
            db.add(
                MessageTemplate(
                    clinic_id=clinic.id, name=name, kind=kind, language=lang, body=body
                )
            )
        patients = []
        today = date.today()
        for idx, name in enumerate(NAMES):
            p = Patient(
                clinic_id=clinic.id,
                full_name=name,
                phone=f"+973 3{(3100000 + idx * 173):07d}",
                cpr_number=f"{80 + idx % 20:02d}{1 + idx % 12:02d}{100 + idx:03d}{idx % 9}"[
                    :9
                ],
                date_of_birth=date(1968 + idx % 35, 1 + idx % 12, 1 + idx % 25),
                gender="female" if idx % 2 else "male",
                nationality=NATIONALITIES[idx % len(NATIONALITIES)],
                allergies="Penicillin"
                if idx in [2, 9]
                else "Shellfish"
                if idx == 14
                else None,
                chronic_conditions="Type 2 diabetes"
                if idx in [4, 12]
                else "Asthma"
                if idx in [7, 16]
                else None,
                current_medications="Metformin 500 mg" if idx in [4, 12] else None,
                emergency_contact_name=NAMES[(idx + 5) % 20],
                emergency_contact_phone=f"+973 36{220000 + idx:06d}",
                notes="Prefers Arabic communication" if idx % 4 == 0 else None,
                created_at=datetime.now(timezone.utc) - timedelta(days=idx * 6 + 2),
            )
            db.add(p)
            patients.append(p)
        db.flush()
        appointments = []
        now = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)
        status_cycle = (
            [AppointmentStatus.completed] * 19
            + [AppointmentStatus.no_show] * 4
            + [AppointmentStatus.cancelled] * 3
            + [AppointmentStatus.confirmed] * 7
            + [AppointmentStatus.scheduled] * 7
        )
        for idx in range(40):
            day_offset = idx - 25
            start = (now + timedelta(days=day_offset, hours=(idx % 8) - 2)).replace(
                hour=8 + (idx * 2) % 10
            )
            service = services[idx % len(services)]
            a = Appointment(
                clinic_id=clinic.id,
                patient_id=patients[idx % 20].id,
                doctor_id=doctors[idx % 3].id,
                service_id=service.id,
                start_time=start,
                end_time=start + timedelta(minutes=service.duration_minutes),
                status=status_cycle[idx],
                reason=[
                    "Routine review",
                    "Persistent cough",
                    "Blood pressure follow-up",
                    "Child wellness visit",
                    "Annual screening",
                ][idx % 5],
                notes="Bring previous lab results" if idx % 7 == 0 else None,
            )
            db.add(a)
            appointments.append(a)
        db.flush()
        visits = []
        completed = [a for a in appointments if a.status == AppointmentStatus.completed]
        for idx, a in enumerate(completed[:15]):
            v = Visit(
                clinic_id=clinic.id,
                appointment_id=a.id,
                patient_id=a.patient_id,
                doctor_id=a.doctor_id,
                subjective=[
                    "Mild fatigue for two weeks.",
                    "Dry cough, no fever.",
                    "Feeling well; medication review.",
                ][idx % 3],
                objective=[
                    "Vitals stable. BP 122/78.",
                    "Chest clear, SpO2 99%.",
                    "Normal general examination.",
                ][idx % 3],
                assessment=[
                    "Likely viral upper respiratory infection.",
                    "Blood pressure controlled.",
                    "Routine health maintenance.",
                ][idx % 3],
                plan=[
                    "Hydration, rest, return if worsening.",
                    "Continue current treatment.",
                    "Arrange fasting blood tests.",
                ][idx % 3],
                diagnosis=[
                    "Viral upper respiratory infection",
                    "Essential hypertension",
                    "Routine adult health examination",
                ][idx % 3],
                follow_up_date=today + timedelta(days=14 + idx),
                doctor_signature_name=next(
                    d.full_name for d in doctors if d.id == a.doctor_id
                ),
                created_at=a.start_time + timedelta(minutes=35),
            )
            db.add(v)
            visits.append(v)
        db.flush()
        prescriptions = []
        meds = [
            ("Paracetamol", "500 mg", "Every 8 hours", "3 days", "Take after food"),
            (
                "Amoxicillin",
                "500 mg",
                "Three times daily",
                "5 days",
                "Complete the full course",
            ),
            ("Cetirizine", "10 mg", "Once daily", "7 days", "Take in the evening"),
            (
                "Salbutamol inhaler",
                "2 puffs",
                "When needed",
                "14 days",
                "Maximum four times daily",
            ),
        ]
        for idx, v in enumerate(visits[:10]):
            m = meds[idx % len(meds)]
            pr = Prescription(
                clinic_id=clinic.id,
                visit_id=v.id,
                patient_id=v.patient_id,
                created_at=v.created_at + timedelta(minutes=5),
                items=[
                    PrescriptionItem(
                        medicine_name=m[0],
                        dosage=m[1],
                        frequency=m[2],
                        duration=m[3],
                        instructions=m[4],
                    )
                ],
            )
            db.add(pr)
            prescriptions.append(pr)
        db.flush()
        invoices = []
        methods = ["cash", "card", "benefitpay", "bank_transfer", "insurance"]
        for idx, a in enumerate(appointments[:20]):
            price = services[idx % len(services)].price
            discount = Decimal("2.000") if idx % 6 == 0 else Decimal("0")
            vat = Decimal("0")
            total = price - discount
            paid = total / 2 if idx < 8 or idx % 4 == 0 else total
            method = "insurance" if idx < 8 else methods[idx % 5]
            inv = Invoice(
                clinic_id=clinic.id,
                patient_id=a.patient_id,
                appointment_id=a.id,
                visit_id=visits[idx].id if idx < len(visits) else None,
                invoice_number=f"INV-{idx + 1:05d}",
                discount=discount,
                vat=vat,
                total_amount=total,
                paid_amount=paid,
                payment_status=PaymentStatus.paid
                if paid == total
                else PaymentStatus.partial,
                payment_method=method,
                created_at=a.start_time + timedelta(hours=1),
                items=[
                    InvoiceItem(
                        description=services[idx % len(services)].name,
                        quantity=1,
                        unit_price=price,
                    )
                ],
            )
            db.add(inv)
            invoices.append(inv)
        db.flush()
        claim_statuses = [
            ClaimStatus.submitted,
            ClaimStatus.approved,
            ClaimStatus.paid,
            ClaimStatus.rejected,
            ClaimStatus.draft,
            ClaimStatus.submitted,
            ClaimStatus.approved,
            ClaimStatus.paid,
        ]
        for idx, inv in enumerate(invoices[:8]):
            balance = inv.balance_due or Decimal("5.000")
            amount = min(balance, Decimal("12.500"))
            status = claim_statuses[idx]
            db.add(
                InsuranceClaim(
                    clinic_id=clinic.id,
                    invoice_id=inv.id,
                    insurance_company_id=companies[idx % 5].id,
                    policy_number=f"BH-POL-{24510 + idx}",
                    claim_amount=amount,
                    status=status,
                    rejection_reason="Benefit not covered under policy"
                    if status == ClaimStatus.rejected
                    else None,
                    submitted_date=today - timedelta(days=10 - idx)
                    if status != ClaimStatus.draft
                    else None,
                    paid_date=today - timedelta(days=idx)
                    if status == ClaimStatus.paid
                    else None,
                )
            )
        for idx in range(15):
            p = patients[idx % 20]
            kind = ["appointment_reminder", "prescription", "no_show"][idx % 3]
            body = {
                "appointment_reminder": f"تذكير: لديك موعد في Seef Family Clinic بتاريخ {(today + timedelta(days=idx + 1)).isoformat()} الساعة 10:00. للتاكيد يرجى الرد بنعم.",
                "prescription": "وصفتك الطبية جاهزة. يرجى اتباع تعليمات الطبيب.",
                "no_show": "لم تحضر موعدك اليوم في Seef Family Clinic. يمكنك إعادة الحجز من خلال التواصل معنا.",
            }[kind]
            db.add(
                Message(
                    clinic_id=clinic.id,
                    patient_id=p.id,
                    appointment_id=appointments[idx].id
                    if kind != "prescription"
                    else None,
                    prescription_id=prescriptions[idx % 10].id
                    if kind == "prescription"
                    else None,
                    kind=kind,
                    recipient_phone=p.phone,
                    body=body,
                    status=[
                        MessageStatus.sent,
                        MessageStatus.sent,
                        MessageStatus.queued,
                    ][idx % 3],
                    created_at=now - timedelta(hours=idx * 5),
                )
            )
        actions = [
            ("patient.viewed", "patient"),
            ("patient.created", "patient"),
            ("appointment.status_changed", "appointment"),
            ("visit.created", "visit"),
            ("invoice.created", "invoice"),
            ("claim.status_changed", "insurance_claim"),
        ]
        for idx in range(20):
            action, entity = actions[idx % len(actions)]
            db.add(
                AuditLog(
                    user_id=staff[idx % len(staff)].id,
                    clinic_id=clinic.id,
                    action=action,
                    entity_type=entity,
                    entity_id=1 + idx % 15,
                    created_at=now - timedelta(hours=idx * 3),
                    details={"source": "demo seed"},
                )
            )
        seed_expansion(db, clinic)
        db.commit()
        print(
            "Seeded ClinicFlow demo: 2 clinics, 10 users, 25 patients, pharmacy batches, and linked clinical/financial records."
        )
    finally:
        db.close()


def seed_expansion(db, clinic: Clinic):
    """Idempotently add the expansion roles, isolation tenant, and pharmacy data."""
    clinic.pharmacy_enabled = True
    clinic.feature_flags = {
        "pharmacy_enabled": True,
        "nursing_triage_enabled": True,
        "insurance_enabled": True,
        "lab_orders_enabled": True,
        "imaging_orders_enabled": True,
        "consent_enabled": True,
        "waitlist_enabled": True,
        "arabic_enabled": True,
        "whatsapp_mock_enabled": True,
    }

    def ensure_user(email, name, role, specialty=None):
        user = db.scalar(select(User).where(User.email == email))
        if not user:
            user = User(
                clinic_id=clinic.id,
                email=email,
                full_name=name,
                password_hash=hash_password("password123"),
                role=role,
                specialty=specialty,
            )
            db.add(user)
            db.flush()
        return user

    nurse = ensure_user("nurse@clinicflow.test", "Aisha Rahman", Role.nurse)
    pharmacist = ensure_user(
        "pharmacist@clinicflow.test", "Hassan Al Sayed", Role.pharmacist
    )
    doctors = db.scalars(
        select(User).where(User.clinic_id == clinic.id, User.role == Role.doctor)
    ).all()
    services = db.scalars(select(Service).where(Service.clinic_id == clinic.id)).all()
    for doctor in doctors:
        if not db.scalar(
            select(DoctorProfile).where(DoctorProfile.user_id == doctor.id)
        ):
            db.add(
                DoctorProfile(
                    clinic_id=clinic.id,
                    user_id=doctor.id,
                    title="Dr.",
                    specialty=doctor.specialty,
                    license_number=f"NHRA-DEMO-{doctor.id:04d}",
                    license_expiry=date.today() + timedelta(days=365 + doctor.id),
                    languages=["English", "Arabic"],
                    service_ids=[service.id for service in services[:3]],
                    schedule={
                        "sunday": [{"start": "08:00", "end": "16:00"}],
                        "monday": [{"start": "08:00", "end": "16:00"}],
                        "tuesday": [{"start": "10:00", "end": "18:00"}],
                        "wednesday": [{"start": "08:00", "end": "16:00"}],
                        "thursday": [{"start": "08:00", "end": "14:00"}],
                    },
                )
            )

    patients = db.scalars(select(Patient).where(Patient.clinic_id == clinic.id)).all()
    for patient in patients:
        if not patient.patient_number:
            patient.patient_number = f"CF-{clinic.id:03d}-{patient.id:06d}"
        if patient.allergies and not db.scalar(
            select(Allergy).where(
                Allergy.clinic_id == clinic.id, Allergy.patient_id == patient.id
            )
        ):
            db.add(
                Allergy(
                    clinic_id=clinic.id,
                    patient_id=patient.id,
                    substance=patient.allergies,
                    reaction="Recorded in legacy patient summary",
                    severity="unknown",
                    verification_status="unverified",
                    recorded_by_id=nurse.id,
                )
            )

    visits = db.scalars(select(Visit).where(Visit.clinic_id == clinic.id)).all()
    for visit in visits:
        if visit.status == EncounterStatus.draft:
            visit.status = EncounterStatus.finalized
            visit.finalized_by_id = visit.doctor_id
            visit.finalized_at = visit.created_at
    if visits and not db.scalar(
        select(EncounterAmendment).where(EncounterAmendment.visit_id == visits[0].id)
    ):
        visits[0].status = EncounterStatus.amended
        db.add(
            EncounterAmendment(
                clinic_id=clinic.id,
                visit_id=visits[0].id,
                author_id=visits[0].doctor_id,
                reason="Demo clarification added after finalization",
                content={
                    "plan": "Patient contacted and follow-up instructions confirmed."
                },
            )
        )

    appointments = db.scalars(
        select(Appointment).where(Appointment.clinic_id == clinic.id)
    ).all()
    for appointment in appointments:
        appointment.created_by_id = appointment.created_by_id or nurse.id
    queue_appointment = next(
        (
            item
            for item in appointments
            if item.status in {AppointmentStatus.confirmed, AppointmentStatus.scheduled}
        ),
        None,
    )
    if queue_appointment and not db.scalar(
        select(QueueEntry).where(QueueEntry.appointment_id == queue_appointment.id)
    ):
        queue_appointment.status = AppointmentStatus.checked_in
        queue_appointment.arrival_at = datetime.now(timezone.utc) - timedelta(
            minutes=18
        )
        db.add(
            QueueEntry(
                clinic_id=clinic.id,
                appointment_id=queue_appointment.id,
                patient_id=queue_appointment.patient_id,
                doctor_id=queue_appointment.doctor_id,
                arrived_at=queue_appointment.arrival_at,
                priority=1,
                room="Consult 2",
            )
        )

    if patients and not db.scalar(
        select(ClinicalOrder).where(ClinicalOrder.clinic_id == clinic.id)
    ):
        db.add_all(
            [
                ClinicalOrder(
                    clinic_id=clinic.id,
                    patient_id=patients[0].id,
                    visit_id=visits[0].id if visits else None,
                    ordered_by_id=doctors[0].id,
                    kind="lab",
                    items=["Complete blood count", "HbA1c"],
                    provider="Bahrain Specialist Laboratory (demo)",
                    status="resulted",
                    result_summary="Demo result uploaded and reviewed.",
                ),
                ClinicalOrder(
                    clinic_id=clinic.id,
                    patient_id=patients[1].id,
                    visit_id=visits[1].id if len(visits) > 1 else None,
                    ordered_by_id=doctors[0].id,
                    kind="imaging",
                    items=["Chest X-ray"],
                    provider="External imaging provider (demo)",
                    status="ordered",
                ),
            ]
        )

    supplier = db.scalar(
        select(Supplier).where(
            Supplier.clinic_id == clinic.id, Supplier.name == "Gulf Medical Supplies"
        )
    )
    if not supplier:
        supplier = Supplier(
            clinic_id=clinic.id,
            name="Gulf Medical Supplies",
            phone="+973 1700 8800",
            email="orders@gulfmedical.test",
        )
        db.add(supplier)
        db.flush()

    medicine_specs = [
        (
            "MED-PARA-500",
            "Paracetamol",
            "Panadol",
            "tablet",
            "500 mg",
            10,
            "0.850",
            "0.300",
        ),
        (
            "MED-AMOX-500",
            "Amoxicillin",
            "Amoxil",
            "capsule",
            "500 mg",
            6,
            "2.750",
            "1.200",
        ),
        ("MED-CET-10", "Cetirizine", "Zyrtec", "tablet", "10 mg", 8, "1.900", "0.800"),
        (
            "MED-SALB",
            "Salbutamol",
            "Ventolin",
            "inhaler",
            "100 mcg",
            3,
            "4.500",
            "2.300",
        ),
    ]
    medicines = []
    for code, generic, brand, form, strength, reorder, sale, cost in medicine_specs:
        medicine = db.scalar(
            select(Medicine).where(
                Medicine.clinic_id == clinic.id, Medicine.code == code
            )
        )
        if not medicine:
            medicine = Medicine(
                clinic_id=clinic.id,
                code=code,
                generic_name=generic,
                brand_name=brand,
                form=form,
                strength=strength,
                pack_size="Demo pack",
                reorder_level=reorder,
                sale_price=Decimal(sale),
                purchase_cost=Decimal(cost),
            )
            db.add(medicine)
            db.flush()
        medicines.append(medicine)

    po = db.scalar(
        select(PurchaseOrder).where(
            PurchaseOrder.clinic_id == clinic.id,
            PurchaseOrder.order_number == "PO-DEMO-0001",
        )
    )
    if not po:
        po = PurchaseOrder(
            clinic_id=clinic.id,
            supplier_id=supplier.id,
            order_number="PO-DEMO-0001",
            status=PurchaseOrderStatus.received,
            expected_delivery=date.today() - timedelta(days=12),
            supplier_invoice_reference="SUP-DEMO-1842",
            created_by_id=pharmacist.id,
        )
        db.add(po)
        db.flush()
        for medicine in medicines:
            db.add(
                PurchaseOrderItem(
                    purchase_order_id=po.id,
                    medicine_id=medicine.id,
                    quantity_ordered=30,
                    quantity_received=30,
                    unit_cost=medicine.purchase_cost,
                )
            )

    batch_specs = [
        (medicines[0], "PARA-NORMAL", date.today() + timedelta(days=500), 42),
        (medicines[1], "AMOX-LOW", date.today() + timedelta(days=240), 4),
        (medicines[2], "CET-NEAR", date.today() + timedelta(days=45), 12),
        (medicines[3], "SALB-EXPIRED", date.today() - timedelta(days=10), 5),
    ]
    for medicine, number, expiry, quantity in batch_specs:
        if db.scalar(
            select(MedicineBatch).where(
                MedicineBatch.clinic_id == clinic.id,
                MedicineBatch.medicine_id == medicine.id,
                MedicineBatch.batch_number == number,
            )
        ):
            continue
        batch = MedicineBatch(
            clinic_id=clinic.id,
            medicine_id=medicine.id,
            supplier_id=supplier.id,
            purchase_order_id=po.id,
            batch_number=number,
            expiry_date=expiry,
            quantity_received=quantity,
            quantity_available=quantity,
            purchase_cost=medicine.purchase_cost,
            received_date=date.today() - timedelta(days=15),
            storage_location="Main dispensary",
            status="expired" if expiry <= date.today() else "available",
        )
        db.add(batch)
        db.flush()
        db.add(
            StockMovement(
                clinic_id=clinic.id,
                medicine_id=medicine.id,
                batch_id=batch.id,
                actor_id=pharmacist.id,
                movement_type="opening_balance",
                quantity=quantity,
                before_quantity=0,
                after_quantity=quantity,
                reason="Expansion demo opening stock",
            )
        )

    second = db.scalar(select(Clinic).where(Clinic.name == "Riffa Wellness Clinic"))
    if not second:
        second = Clinic(
            name="Riffa Wellness Clinic",
            address="Riffa, Bahrain",
            phone="+973 1700 5511",
            working_hours=clinic.working_hours,
            pharmacy_enabled=False,
            feature_flags={"pharmacy_enabled": False, "insurance_enabled": True},
        )
        db.add(second)
        db.flush()
    second_owner = db.scalar(
        select(User).where(User.email == "owner.riffa@clinicflow.test")
    )
    if not second_owner:
        second_owner = User(
            clinic_id=second.id,
            email="owner.riffa@clinicflow.test",
            full_name="Riffa Demo Owner",
            password_hash=hash_password("password123"),
            role=Role.owner,
        )
        db.add(second_owner)
        db.flush()
    if not db.scalar(select(Patient).where(Patient.clinic_id == second.id)):
        for index in range(5):
            patient = Patient(
                clinic_id=second.id,
                full_name=f"Riffa Demo Patient {index + 1}",
                phone=f"+973 3900 00{index + 1:02d}",
                cpr_number=f"9901010{index + 1:02d}",
                preferred_language="ar" if index % 2 else "en",
            )
            db.add(patient)
            db.flush()
            patient.patient_number = f"CF-{second.id:03d}-{patient.id:06d}"


if __name__ == "__main__":
    run()
