from datetime import date, datetime
from decimal import Decimal
from typing import Annotated
from pydantic import (
    AfterValidator,
    BaseModel,
    ConfigDict,
    Field,
    field_validator,
    model_validator,
)
from .config import settings
from .models import (
    AppointmentStatus,
    ClaimStatus,
    DeliveryStatus,
    DispenseStatus,
    EncounterStatus,
    InvitationStatus,
    MessageStatus,
    PaymentStatus,
    PurchaseOrderStatus,
    Role,
)


def valid_email(value: str) -> str:
    value = value.strip().lower()
    if "@" not in value or "." not in value.split("@", 1)[1]:
        raise ValueError("Enter a valid email address")
    return value


Email = Annotated[str, AfterValidator(valid_email)]


class ORM(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class Login(BaseModel):
    email: Email
    password: str


class Register(BaseModel):
    clinic_name: str = Field(min_length=2)
    full_name: str = Field(min_length=2)
    email: Email
    password: str = Field(min_length=8)
    phone: str


class ClinicOut(ORM):
    id: int
    name: str
    address: str
    phone: str
    contact_email: str | None
    timezone: str
    logo_url: str | None
    working_hours: dict
    pharmacy_enabled: bool
    feature_flags: dict
    onboarding_completed: bool
    quick_create_actions: list[str]


class UserOut(ORM):
    id: int
    clinic_id: int
    email: Email
    full_name: str
    role: Role
    specialty: str | None
    is_active: bool
    permissions: list[str]
    last_login_at: datetime | None
    clinic: ClinicOut | None = None


class UserCreate(BaseModel):
    email: Email
    full_name: str
    password: str = Field(min_length=8)
    role: Role
    specialty: str | None = None
    permissions: list[str] = []


class PasswordChange(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8)


class PasswordResetRequest(BaseModel):
    email: Email


class PasswordResetConfirm(BaseModel):
    token: str = Field(min_length=32)
    password: str = Field(min_length=8)


class ServiceOut(ORM):
    id: int
    name: str
    price: Decimal
    duration_minutes: int
    active: bool


class ServiceCreate(BaseModel):
    name: str
    price: Decimal = Field(ge=0)
    duration_minutes: int = Field(gt=0, le=480)
    active: bool = True


class PatientBase(BaseModel):
    full_name: str = Field(min_length=2)
    arabic_name: str | None = None
    preferred_name: str | None = None
    phone: str
    cpr_number: str | None = None
    date_of_birth: date | None = None
    gender: str | None = None
    nationality: str | None = None
    allergies: str | None = None
    chronic_conditions: str | None = None
    current_medications: str | None = None
    emergency_contact_name: str | None = None
    emergency_contact_phone: str | None = None
    notes: str | None = None
    preferred_language: str = "en"
    communication_consent: bool = False
    treatment_consent_state: str = "not_recorded"

    @field_validator("phone", "emergency_contact_phone")
    @classmethod
    def valid_phone(cls, value):
        if value and (
            len(value.replace(" ", "")) < 8
            or not value.replace("+", "").replace(" ", "").isdigit()
        ):
            raise ValueError("Enter a valid phone number")
        return value


class PatientCreate(PatientBase):
    pass


class PatientUpdate(PatientBase):
    pass


class PatientOut(PatientBase, ORM):
    id: int
    clinic_id: int
    created_at: datetime
    patient_number: str | None


class AppointmentCreate(BaseModel):
    patient_id: int
    doctor_id: int
    service_id: int
    start_time: datetime
    end_time: datetime
    status: AppointmentStatus = AppointmentStatus.scheduled
    reason: str = ""
    notes: str | None = None
    room: str | None = None
    booking_source: str = "staff"
    conflict_override_reason: str | None = None

    @model_validator(mode="after")
    def times(self):
        if self.end_time <= self.start_time:
            raise ValueError("Appointment must end after it starts")
        return self


class AppointmentUpdate(AppointmentCreate):
    pass


class AppointmentStatusUpdate(BaseModel):
    status: AppointmentStatus
    reason: str | None = None


class AppointmentOut(AppointmentCreate, ORM):
    id: int
    clinic_id: int
    patient: PatientOut
    doctor: UserOut
    service: ServiceOut


class VisitCreate(BaseModel):
    appointment_id: int | None = None
    patient_id: int
    doctor_id: int | None = None
    subjective: str = ""
    objective: str = ""
    assessment: str = ""
    plan: str = ""
    diagnosis: str
    follow_up_date: date | None = None
    doctor_signature_name: str
    status: EncounterStatus = EncounterStatus.draft


class VisitOut(VisitCreate, ORM):
    id: int
    clinic_id: int
    doctor: UserOut
    patient: PatientOut
    created_at: datetime
    finalized_by_id: int | None
    finalized_at: datetime | None


class VisitUpdate(BaseModel):
    subjective: str = ""
    objective: str = ""
    assessment: str = ""
    plan: str = ""
    diagnosis: str
    follow_up_date: date | None = None
    doctor_signature_name: str


class AmendmentCreate(BaseModel):
    reason: str = Field(min_length=3)
    content: dict


class AmendmentOut(AmendmentCreate, ORM):
    id: int
    visit_id: int
    author_id: int
    created_at: datetime


class PrescriptionItemIn(BaseModel):
    medicine_name: str
    dosage: str
    frequency: str
    duration: str
    instructions: str = ""
    quantity: int = Field(default=1, gt=0)


class PrescriptionItemOut(PrescriptionItemIn, ORM):
    id: int


class PrescriptionCreate(BaseModel):
    visit_id: int
    patient_id: int
    items: list[PrescriptionItemIn] = Field(min_length=1)


class PrescriptionOut(ORM):
    id: int
    visit_id: int
    patient_id: int
    status: str
    items: list[PrescriptionItemOut]
    created_at: datetime


class InvoiceItemIn(BaseModel):
    description: str
    quantity: int = Field(gt=0)
    unit_price: Decimal = Field(ge=0)


class InvoiceItemOut(InvoiceItemIn, ORM):
    id: int


class InvoiceCreate(BaseModel):
    patient_id: int
    appointment_id: int | None = None
    visit_id: int | None = None
    discount: Decimal = Field(default=Decimal("0"), ge=0)
    vat: Decimal = Field(default=Decimal("0"), ge=0)
    paid_amount: Decimal = Field(default=Decimal("0"), ge=0)
    payment_method: str | None = None
    items: list[InvoiceItemIn] = Field(min_length=1)


class InvoiceOut(ORM):
    id: int
    patient_id: int
    appointment_id: int | None
    visit_id: int | None
    invoice_number: str
    discount: Decimal
    vat: Decimal
    total_amount: Decimal
    paid_amount: Decimal
    balance_due: Decimal
    payment_status: PaymentStatus
    payment_method: str | None
    created_at: datetime
    patient: PatientOut
    items: list[InvoiceItemOut]


class CompanyOut(ORM):
    id: int
    name: str
    active: bool


class ClaimCreate(BaseModel):
    invoice_id: int
    insurance_company_id: int
    policy_number: str
    claim_amount: Decimal = Field(gt=0)


class ClaimStatusUpdate(BaseModel):
    status: ClaimStatus
    rejection_reason: str | None = None


class ClaimOut(ORM):
    id: int
    invoice_id: int
    policy_number: str
    claim_amount: Decimal
    status: ClaimStatus
    rejection_reason: str | None
    submitted_date: date | None
    paid_date: date | None
    created_at: datetime
    company: CompanyOut
    invoice: InvoiceOut


class MessageCreate(BaseModel):
    patient_id: int
    appointment_id: int | None = None
    prescription_id: int | None = None
    kind: str
    body: str | None = None


class MessageOut(ORM):
    id: int
    patient_id: int
    appointment_id: int | None
    prescription_id: int | None
    kind: str
    recipient_phone: str
    body: str
    status: MessageStatus
    created_at: datetime
    patient: PatientOut


class TemplateOut(ORM):
    id: int
    name: str
    kind: str
    language: str
    body: str


class AuditOut(ORM):
    id: int
    action: str
    entity_type: str
    entity_id: int | None
    created_at: datetime
    details: dict
    user: UserOut


class Dashboard(BaseModel):
    today_appointments: int
    week_appointments: int
    no_show_rate: float
    monthly_revenue: Decimal
    pending_insurance: Decimal
    new_patients: int
    status_breakdown: dict[str, int]
    top_doctors: list[dict]
    recent_activity: list[dict]
    upcoming_appointments: list[dict]
    revenue_by_month: list[dict]
    payment_methods: list[dict]
    outstanding_balances: Decimal
    new_vs_returning: dict
    doctor_utilization: list[dict]


class InvitationCreate(BaseModel):
    email: Email
    full_name: str = Field(min_length=2)
    role: Role
    expires_in_hours: int = Field(
        default_factory=lambda: settings.invitation_expiry_hours, ge=1, le=168
    )
    profile_data: dict = {}
    permissions: list[str] = []


class InvitationAccept(BaseModel):
    token: str = Field(min_length=32)
    password: str = Field(min_length=8)
    terms_accepted: bool
    privacy_acknowledged: bool


class InvitationOut(ORM):
    id: int
    email: Email
    full_name: str
    role: Role
    status: InvitationStatus
    expires_at: datetime
    accepted_at: datetime | None
    revoked_at: datetime | None
    profile_data: dict
    permissions: list[str]
    created_at: datetime
    delivery_status: DeliveryStatus
    sent_at: datetime | None
    last_delivery_error: str | None
    delivery_attempts: int
    demo_token: str | None = None


class StaffStatusUpdate(BaseModel):
    active: bool


class StaffPermissionsUpdate(BaseModel):
    permissions: list[str]


class DoctorProfileIn(BaseModel):
    arabic_name: str | None = None
    phone: str | None = None
    title: str | None = None
    specialty: str | None = None
    license_number: str | None = None
    license_expiry: date | None = None
    employment_type: str | None = None
    biography: str | None = None
    languages: list[str] = []
    service_ids: list[int] = []
    consultation_duration: int = Field(default=30, ge=5, le=480)
    schedule: dict = {}
    booking_enabled: bool = True
    status: str = "active"


class DoctorProfileOut(DoctorProfileIn, ORM):
    id: int
    clinic_id: int
    user_id: int


class StaffDetail(UserOut):
    doctor_profile: DoctorProfileOut | None = None
    invitation_status: InvitationStatus | None = None


class ScheduleBlockIn(BaseModel):
    doctor_id: int | None = None
    start_time: datetime
    end_time: datetime
    kind: str = "blocked"
    reason: str = ""

    @model_validator(mode="after")
    def valid_range(self):
        if self.end_time <= self.start_time:
            raise ValueError("Schedule block must end after it starts")
        return self


class ScheduleBlockOut(ScheduleBlockIn, ORM):
    id: int
    clinic_id: int
    created_by_id: int


class AppointmentHistoryOut(ORM):
    id: int
    appointment_id: int
    from_status: str | None
    to_status: str
    changed_by_id: int
    reason: str | None
    created_at: datetime


class QueueOut(ORM):
    id: int
    appointment_id: int
    patient_id: int
    doctor_id: int
    arrived_at: datetime
    priority: int
    room: str | None
    status: str


class WaitlistIn(BaseModel):
    patient_id: int
    doctor_id: int | None = None
    service_id: int | None = None
    preferred_date: date | None = None
    priority: int = Field(default=0, ge=0, le=10)
    notes: str | None = None


class WaitlistOut(WaitlistIn, ORM):
    id: int
    status: str
    created_at: datetime


class AllergyIn(BaseModel):
    substance: str = Field(min_length=1)
    reaction: str | None = None
    severity: str = "unknown"
    status: str = "active"
    verification_status: str = "unverified"


class AllergyOut(AllergyIn, ORM):
    id: int
    patient_id: int
    recorded_by_id: int
    created_at: datetime


class ClinicalOrderIn(BaseModel):
    patient_id: int
    visit_id: int | None = None
    kind: str
    items: list[str] = Field(min_length=1)
    provider: str | None = None
    clinical_notes: str | None = None


class ClinicalOrderOut(ClinicalOrderIn, ORM):
    id: int
    ordered_by_id: int
    status: str
    result_summary: str | None
    created_at: datetime


class ReferralIn(BaseModel):
    patient_id: int
    destination: str
    reason: str
    urgency: str = "routine"


class ReferralOut(ReferralIn, ORM):
    id: int
    referring_doctor_id: int
    status: str
    response_received: bool
    created_at: datetime


class ConsentIn(BaseModel):
    patient_id: int
    kind: str
    template_version: str
    language: str = "en"
    signer_name: str
    signer_relationship: str | None = None
    status: str = "accepted"


class ConsentOut(ConsentIn, ORM):
    id: int
    recorded_by_id: int
    created_at: datetime


class SupplierIn(BaseModel):
    name: str
    phone: str | None = None
    email: Email | None = None
    active: bool = True


class SupplierOut(SupplierIn, ORM):
    id: int


class MedicineIn(BaseModel):
    code: str
    generic_name: str
    brand_name: str | None = None
    form: str
    strength: str
    pack_size: str | None = None
    barcode: str | None = None
    manufacturer: str | None = None
    prescription_required: bool = True
    controlled_item: bool = False
    active: bool = True
    sale_price: Decimal = Field(default=Decimal("0"), ge=0)
    purchase_cost: Decimal = Field(default=Decimal("0"), ge=0)
    reorder_level: int = Field(default=0, ge=0)
    storage_notes: str | None = None


class MedicineOut(MedicineIn, ORM):
    id: int


class PurchaseItemIn(BaseModel):
    medicine_id: int
    quantity_ordered: int = Field(gt=0)
    unit_cost: Decimal = Field(ge=0)


class PurchaseOrderIn(BaseModel):
    supplier_id: int
    expected_delivery: date | None = None
    notes: str | None = None
    items: list[PurchaseItemIn] = Field(min_length=1)


class PurchaseOrderOut(ORM):
    id: int
    supplier_id: int
    order_number: str
    status: PurchaseOrderStatus
    expected_delivery: date | None
    supplier_invoice_reference: str | None
    notes: str | None
    created_at: datetime
    items: list[dict] = []


class ReceiptItemIn(BaseModel):
    purchase_order_item_id: int
    batch_number: str
    expiry_date: date
    quantity: int = Field(gt=0)
    storage_location: str | None = None


class GoodsReceiptIn(BaseModel):
    supplier_invoice_reference: str | None = None
    items: list[ReceiptItemIn] = Field(min_length=1)


class BatchOut(ORM):
    id: int
    medicine_id: int
    supplier_id: int | None
    purchase_order_id: int | None
    batch_number: str
    expiry_date: date
    quantity_received: int
    quantity_available: int
    purchase_cost: Decimal
    received_date: date
    storage_location: str | None
    status: str
    quarantined: bool


class DispenseItemIn(BaseModel):
    medicine_id: int
    batch_id: int
    quantity: int = Field(gt=0)


class DispenseIn(BaseModel):
    prescription_id: int
    items: list[DispenseItemIn] = Field(min_length=1)
    verification_note: str | None = None
    counseling_note: str | None = None
    invoice_id: int | None = None
    idempotency_key: str | None = None


class DispenseOut(ORM):
    id: int
    prescription_id: int
    patient_id: int
    pharmacist_id: int
    status: DispenseStatus
    verification_note: str | None
    counseling_note: str | None
    invoice_id: int | None
    finalized_at: datetime | None
    created_at: datetime


class ClarificationIn(BaseModel):
    prescription_id: int
    note: str = Field(min_length=2)
