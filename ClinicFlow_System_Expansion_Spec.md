# ClinicFlow System Expansion Specification

**Purpose:** Complete product, workflow, design, security, and testing requirements for the next ClinicFlow phase.  
**Target:** Small and medium outpatient clinics in Bahrain and the GCC.  
**Stack:** Next.js App Router + TypeScript, FastAPI + Python, PostgreSQL, SQLAlchemy, Alembic, Docker Compose.  
**Status:** Source of truth for the next implementation phase.

> This document guides engineering. It is not a legal certification. Before production use with real patient data, current NHRA, Bahrain data-protection, insurer, and pharmacy requirements must be reviewed by qualified professionals.

---

## 1. Product definition

ClinicFlow is a responsive browser-based SaaS for clinic operations. It must work on reception desktops, doctor laptops, clinic tablets, owner mobile browsers, and pharmacy desktops. It is not a desktop installer.

Primary clinic types:

- General and specialist private clinics
- Dental clinics
- Dermatology and cosmetic clinics
- Physiotherapy and rehabilitation clinics
- Ophthalmology clinics
- Medical centers with several doctors
- Clinics operating a licensed internal pharmacy or dispensary

Not first-version scope:

- Inpatient wards
- Full hospital information system
- Full laboratory information system
- PACS image storage
- Autonomous diagnosis or treatment
- Unverified direct insurer or government integrations

---

## 2. How a clinic actually works

ClinicFlow must model one connected patient journey rather than isolated pages.

### 2.1 Patient first contact

A patient may arrive through phone, WhatsApp, walk-in, website booking, referral, doctor follow-up, or a recurring treatment plan.

Before creating a patient, authorized staff must search by:

- Name
- Phone
- CPR or other identifier
- Date of birth
- Internal patient number

Show likely duplicates before allowing creation.

### 2.2 Patient registration

Required fields and capabilities:

- Auto-generated unique patient number
- Full legal name
- Arabic name, optional
- Preferred name
- CPR or identifier, optional but unique within a clinic when present
- Date of birth
- Sex or gender field according to clinic policy
- Nationality
- Phone, secondary phone, email
- Address
- Preferred language
- Emergency contact
- Guardian details for minors or dependents
- Insurance policy details
- Communication consent
- General treatment consent state
- Referral or acquisition source
- Notes

Normal users must not permanently delete a patient record. Authorized admins may archive it, mark it entered in error, or merge duplicates while preserving history and audit logs.

### 2.3 Appointment scheduling

Appointment fields:

- Patient
- Doctor
- Service
- Date, start time, end time, duration
- Location, room, chair, or resource
- Visit type
- Reason
- Internal notes
- Patient-facing notes
- Booking source
- Reminder preferences
- Optional insurance preauthorization state
- Optional recurrence

Statuses:

- requested
- scheduled
- confirmed
- checked_in
- waiting
- in_progress
- completed
- cancelled
- no_show
- rescheduled
- waitlisted
- entered_in_error

Every status change must create a history entry with user, timestamp, and optional reason.

The system must detect conflicts involving doctor, room, chair, or resource. An authorized override requires a reason.

### 2.4 Doctor controls appointments like reception

A doctor must be able to:

- View own day, week, and month calendar
- Create an appointment for an existing or new patient
- Create follow-up directly from an encounter
- Edit time, duration, service, reason, and notes
- Confirm, check in, start, complete, reschedule, cancel, or mark no-show
- Block personal time
- Add leave or unavailable time
- View available slots
- Manage own waitlist entries
- Convert waitlist entry to appointment
- See conflict warnings
- View relevant patient summary while scheduling

Default permission scope:

- Doctor manages own schedule and assigned patients.
- Owner may grant a doctor permission to manage all schedules.
- Receptionist may manage all permitted clinic schedules.
- Every change is audited.

### 2.5 Availability and resources

Support:

- Recurring weekly availability
- Availability by service
- Breaks
- Time off and leave
- Clinic holidays
- Buffer time
- Service-specific duration
- Temporary schedule exceptions
- Rooms, chairs, and devices as bookable resources
- Controlled overbooking
- Waitlist priority

### 2.6 Check-in and queue

Workflow:

1. Reception marks patient checked in.
2. Arrival time is stored.
3. Patient enters doctor or service queue.
4. Room may be assigned.
5. Waiting time is calculated.
6. Doctor calls next patient.
7. Status changes to in progress.
8. Visit ends as completed or awaiting checkout.

Walk-ins may enter the queue directly and optionally receive an appointment record.

Queue page must show patient, doctor, service, arrival time, waiting duration, priority, room, and status without exposing unnecessary clinical details.

### 2.7 Nursing triage, optional feature

A nurse may record:

- Chief complaint
- Temperature
- Pulse
- Blood pressure
- Respiratory rate
- Oxygen saturation
- Height, weight, and calculated BMI
- Pain score
- Triage notes
- Infection-control warning
- Special-assistance flag
- Allergies confirmed
- Current medications confirmed

Every measurement stores unit, timestamp, and recorder. The system may show clinic-configured warnings, but it must not make autonomous clinical decisions.

### 2.8 Clinical encounter

Workflow:

1. Doctor opens checked-in patient.
2. System shows identity, allergies, warnings, active medications, chronic conditions, last visits, and recent results.
3. Doctor starts encounter.
4. Doctor documents assessment and plan.
5. Doctor adds diagnosis, procedure, prescription, order, referral, consent, attachment, and follow-up.
6. Doctor finalizes the note.
7. Finalized note becomes immutable.
8. Later correction becomes an amendment with reason.

Encounter fields:

- Patient
- Appointment, optional for walk-in
- Doctor
- Start and end timestamps
- Visit type
- Chief complaint
- SOAP sections
- Structured diagnoses
- Procedures
- Measurements
- Treatment plan
- Patient education
- Follow-up date or interval
- Referral plan
- Attachments
- Status: draft, in_progress, finalized, amended, entered_in_error
- Finalized by and finalized at

### 2.9 Medical-record integrity

Required rules:

- Each entry records author, role, date, and time.
- Finalized entries cannot be directly edited or deleted.
- Correction creates a separate amendment and reason.
- Original content remains retrievable.
- Late entries are clearly labeled.
- Mandatory fields are enforced before finalization.
- Allergy warnings stay visible across clinical pages.
- Patient views, exports, and sensitive changes are audited.
- Records use unique patient identifiers.
- Archived records remain available to authorized users.
- Backups and restore procedures are documented and tested.

### 2.10 Problems, diagnoses, and allergies

Separate:

- Active problems
- Historical problems
- Encounter diagnoses
- Chronic conditions
- Allergies
- Adverse reactions
- Family and social history, optional

Allergy fields:

- Substance
- Reaction
- Severity
- Status
- Verification status
- Recorder and timestamp
- Notes

Show allergy warnings in patient header, encounter, prescription, and pharmacy dispensing screens.

### 2.11 Prescriptions

Prescription fields:

- Prescriber
- Patient
- Encounter
- Issue date
- Status
- Medication items
- Medicine name
- Form, strength, dose, route, frequency, duration, quantity, instructions
- Repeat information when applicable
- Patient instructions
- Internal notes
- Amendment and cancellation history

Capabilities:

- Print bilingual prescription
- Export PDF
- Create mock communication record
- Route to clinic pharmacy when enabled
- Mark partially or fully dispensed

The system records licensed-user decisions. It does not generate treatment autonomously.

### 2.12 Lab and imaging orders

ClinicFlow is not a full LIS or PACS, but it must track orders and results.

Order capabilities:

- Create lab or imaging order
- Add one or more tests
- Add clinical notes
- Choose internal or external provider
- Print or export request
- Track status: draft, ordered, collected, sent, partial, resulted, reviewed, cancelled
- Upload result PDF or structured values
- Assign reviewer
- Record critical-result acknowledgment
- Record patient notification

Results and orders may never be silently deleted.

### 2.13 Referrals

Referral fields:

- Patient
- Referring doctor
- Destination organization or specialist
- Reason and clinical summary
- Urgency
- Attachments
- Status
- Optional appointment details
- Response received
- Closed-loop follow-up state

### 2.14 Consent and procedures

Support:

- General treatment consent
- Procedure-specific templates
- Arabic and English versions
- Patient or guardian signer
- Relationship to patient
- Witness
- Doctor
- Procedure name and site
- Date and time
- Uploaded signed form or electronic signature
- Template version
- Refusal, revocation, and amendment history

Do not assume one consent covers every procedure.

### 2.15 Attachments and clinical media

Support lab PDFs, reports, referral letters, consent forms, before-and-after photos, dental images, scanned records, and insurance documents.

Security requirements:

- File type and size validation
- Safe upload handling
- Private storage
- Time-limited download URLs
- Access audit
- Category and description
- Capture date
- Uploader
- Clinical-photo consent marker
- No public file URLs

### 2.16 Billing and checkout

Workflow:

1. Services and products are added from encounter.
2. Prices come from service catalog.
3. Authorized discount may be added.
4. Patient and insurer portions are recorded.
5. Invoice is issued.
6. One or more payments are recorded.
7. Receipt is printed or exported.
8. Balance stays visible.
9. Refund, void, or adjustment requires permission and reason.

Invoice fields:

- Unique invoice number
- Patient
- Encounter or appointment
- Items, quantities, prices, discounts, optional tax
- Total
- Patient responsibility
- Insurer responsibility
- Amount paid and balance
- Status
- Creator
- Payment and adjustment history

Posted invoices must not be silently edited. Use void, credit, or adjustment flows.

### 2.17 Insurance claims

Support:

- Insurer and plan
- Policy details
- Manual eligibility or preauthorization state
- Claim built from invoice and encounter
- Attachments
- Submitted state
- Approved, rejected, partially approved, paid, appealed
- Rejection reason
- Payment reconciliation
- Aging and outstanding amount
- Full status history

Do not claim direct integration unless implemented and verified.

### 2.18 Follow-up and communication

Support appointment confirmation, reminders, reschedule notices, no-show follow-up, follow-up-due reminders, results-ready notices, prescription-ready notices, balance reminders, and approved announcements.

Every communication stores:

- Language
- Channel
- Recipient
- Consent state
- Template
- Related patient and appointment
- Created by or automation source
- Delivery state
- Failure reason
- Timestamp

Mock WhatsApp messages must be visibly labeled as mock in development.

### 2.19 Complaints, incidents, and quality

Complaint record:

- Complainant and optional patient
- Channel and category
- Description
- Assigned owner
- Status and resolution
- Dates
- Attachments
- Follow-up and satisfaction outcome

Incident record:

- Type
- Date and location
- People involved
- Optional patient
- Description
- Immediate action
- Severity
- Investigation
- Root-cause notes
- Corrective action
- Owner and due date
- Status
- Near-miss marker

### 2.20 Generated documents

Authorized users may generate visit confirmation, referral letter, treatment plan, prescription, invoice, receipt, and configured medical-document placeholders.

Every document shows clinic details, patient identity, author, role, date, unique number, status, and revision history.

The system must not imply that every user can issue regulated certificates.

---

## 3. Optional pharmacy module

Pharmacy is enabled per clinic with `pharmacy_enabled`. When disabled, pages disappear and APIs reject access.

### 3.1 Pharmacy roles

- Pharmacy manager
- Pharmacist
- Pharmacy technician
- Inventory clerk
- Accountant
- Owner

Only authorized pharmacy users may finalize dispensing.

### 3.2 Pharmacy dashboard

Show:

- Prescriptions awaiting dispensing
- Low-stock items
- Near-expiry and expired items
- Out-of-stock items
- Today's dispensing count
- Today's pharmacy sales
- Pending purchase orders
- Stock adjustments requiring review
- Recent discrepancies

### 3.3 Medicine catalog

Fields:

- Internal code
- Generic and brand name
- Form and strength
- Pack size
- Optional barcode
- Manufacturer and category
- Prescription-required flag
- Controlled-item flag for permission and reporting only
- Active status
- Sale price and purchase cost
- Reorder level
- Storage notes
- Optional tax field

Do not hardcode unverified clinical classifications.

### 3.4 Suppliers and purchasing

Support suppliers, purchase orders, partial receipts, supplier invoice reference, expected delivery, goods receipt, batch, expiry, quantity, cost, cancellation, notes, and attachments.

### 3.5 Batch inventory

Each stock batch stores:

- Medicine
- Batch or lot number
- Expiry date
- Quantity received and available
- Purchase cost
- Supplier
- Received date
- Storage location
- Status
- Quarantine marker

Movement types:

- purchase_receipt
- dispensing
- sale
- return_to_supplier
- adjustment_in
- adjustment_out
- damaged
- expired
- transfer
- opening_balance

Every movement stores actor, timestamp, reason, source document, and before/after quantities.

Use FEFO as default batch suggestion. Override requires reason.

### 3.6 Dispensing workflow

1. Pharmacist opens valid prescription.
2. Patient and prescriber are verified.
3. Allergy and warning banner appears.
4. Pharmacist reviews prescription.
5. Clarification request can be recorded.
6. Available batch is selected.
7. Quantity is entered.
8. Optional second check occurs.
9. Dispensing is finalized.
10. Stock decreases in one transaction.
11. Label and receipt can be printed.
12. Counseling record is stored at a high level.
13. Prescription becomes partially or fully dispensed.

Finalized dispensing cannot be directly deleted.

### 3.7 Label support

Label supports dispensing date, patient name, pharmacy name and address, medicine, directions, configured precautions, keep-out-of-reach notice, external-use notice when applicable, and reference number. Support bilingual layout.

### 3.8 Inventory controls

Required:

- Low-stock alert
- 30, 60, 90, and 180-day expiry views
- Block expired stock
- Block negative stock by default
- Stock count and variance
- Approval for sensitive adjustments
- Inventory valuation
- Movement history
- Batch recall search
- Supplier return
- Export

### 3.9 Reports

- Daily dispensing
- Sales by product
- Stock on hand
- Near expiry and expired
- Low stock
- Purchases
- Gross-margin estimate
- Adjustments
- Prescription retrieval
- Pharmacist activity

Do not claim an electronic register replaces any statutory register without formal approval.

---

## 4. Users, doctors, invitations, and login

### 4.1 Staff lifecycle

Owner or authorized admin can:

- Add doctor, receptionist, nurse, accountant, or pharmacy staff
- Edit profile
- Assign role and permissions
- Set clinic/location access
- Disable and reactivate account
- Trigger password reset
- Revoke active sessions
- View last login
- View invitation state
- Set employment dates
- Store license and specialty details
- Upload credentials
- Configure schedule
- Remove access without deleting historical authorship

### 4.2 Doctor profile

Fields:

- Full name and optional Arabic name
- Email and phone
- Specialty and title
- NHRA license number and expiry
- Employment type
- Biography
- Languages
- Services
- Consultation duration
- Locations
- Optional secure signature image
- Active state
- Booking enabled
- Linked user ID

Doctor profile and login account are related but separate. Historical doctor records remain after login is disabled.

### 4.3 Invitation flow

1. Admin enters staff and email.
2. System creates pending invitation with single-use secure token.
3. Token expires.
4. User opens invite page.
5. User sets password.
6. User accepts terms and privacy acknowledgment.
7. Account becomes active.
8. User logs in.
9. Admin may resend or revoke invitation.
10. Audit log records actions.

Development mode may expose invitation link instead of sending email. Production requires an email provider.

### 4.4 Authentication

Required:

- Login and logout
- Forgot and reset password
- Change password
- Password hashing
- Secure session or access/refresh strategy
- Session revocation
- Disabled-user protection
- Rate limiting
- Generic login errors
- Clinic selection for multi-clinic user
- Last login
- Future MFA-ready design

Every seeded role must be tested by real login.

### 4.5 Granular permissions

Examples:

- patients.read, create, update, merge
- appointments.read_own, manage_own, manage_all
- encounters.create, finalize, amend
- prescriptions.create
- pharmacy.dispense, inventory_manage
- billing.create, adjust
- claims.manage
- staff.manage
- reports.view
- audit.view
- settings.manage

Backend checks are mandatory. Hiding a button is not authorization.

---

## 5. Multi-tenancy and feature flags

### 5.1 Tenant isolation

- Every tenant-owned record has clinic context.
- Never trust clinic ID from frontend.
- Derive clinic access from authenticated membership.
- Block cross-clinic reads, writes, exports, searches, analytics, and files.
- Test isolation for every sensitive module.
- Background jobs preserve tenant context.

### 5.2 Feature flags

- pharmacy_enabled
- nursing_triage_enabled
- insurance_enabled
- lab_orders_enabled
- imaging_orders_enabled
- consent_enabled
- online_booking_enabled
- waitlist_enabled
- multi_location_enabled
- arabic_enabled
- whatsapp_mock_enabled

Disabled modules disappear from navigation and reject API access.

---

## 6. Recommended data model additions

Inspect existing schema first. Add Alembic migrations and preserve data.

Recommended entities:

- clinics, clinic_locations, clinic_settings
- users, roles, permissions, role_permissions, clinic_memberships
- staff_invitations, doctor_profiles, staff_profiles, professional_credentials
- doctor_services, schedules, schedule_exceptions, time_off
- rooms, resources, services
- patients, patient_identifiers, guardians, insurance_policies, patient_merge_events
- appointments, appointment_status_history, waitlist_entries, queue_entries
- encounters, encounter_amendments, vitals, diagnoses, patient_problems, allergies, adverse_reactions, procedures
- prescriptions, prescription_items, prescription_status_history
- lab_orders, lab_order_items, lab_results, imaging_orders, referrals
- consents, consent_templates, documents, clinical_photos
- invoices, invoice_items, payments, refunds, adjustments
- insurance_companies, insurance_claims, claim_status_history
- message_templates, communications, notification_jobs
- complaints, incidents, audit_logs
- pharmacy_settings, medicines, medicine_batches, suppliers
- purchase_orders, purchase_order_items, goods_receipts
- stock_movements, stock_counts, dispense_orders, dispense_items, pharmacy_clarifications

Use reference tables rather than rigid enums where clinic customization is likely.

---

## 7. API requirements

Suggested groups:

- `/api/auth`, `/api/me`, `/api/clinics`, `/api/memberships`
- `/api/staff`, `/api/invitations`, `/api/doctors`, `/api/schedules`
- `/api/services`, `/api/patients`, `/api/appointments`, `/api/waitlist`, `/api/queue`
- `/api/encounters`, `/api/vitals`, `/api/diagnoses`, `/api/allergies`
- `/api/prescriptions`, `/api/orders/lab`, `/api/orders/imaging`, `/api/referrals`, `/api/consents`, `/api/documents`
- `/api/invoices`, `/api/payments`, `/api/claims`, `/api/messages`
- `/api/complaints`, `/api/incidents`, `/api/analytics`, `/api/audit-logs`
- `/api/pharmacy/catalog`, `/api/pharmacy/suppliers`, `/api/pharmacy/purchase-orders`, `/api/pharmacy/stock`, `/api/pharmacy/dispensing`, `/api/pharmacy/reports`

Requirements:

- Pagination, filtering, sorting, and search
- Typed schemas
- Stable error shape
- Validation
- Permission and tenant checks
- Transaction safety
- Idempotency for payments and dispensing where needed
- Concurrency/version checks on critical records
- Centralized audit service
- OpenAPI docs
- No patient data in logs

---

## 8. Required pages

Authentication:

- `/login`
- `/forgot-password`
- `/reset-password`
- `/invite/[token]`

Core app:

- `/dashboard`
- `/appointments`, `/appointments/new`, `/appointments/[id]`
- `/queue`, `/waitlist`
- `/patients`, `/patients/new`, `/patients/[id]`
- `/patients/[id]/encounters/new`, `/encounters/[id]`
- `/prescriptions/[id]`
- `/orders`, `/referrals`
- `/billing`, `/billing/invoices/[id]`
- `/insurance`, `/messages`
- `/quality/complaints`, `/quality/incidents`
- `/reports`, `/staff`, `/staff/doctors/new`, `/staff/[id]`, `/settings`

Pharmacy when enabled:

- `/pharmacy`
- `/pharmacy/prescriptions`
- `/pharmacy/dispensing/[id]`
- `/pharmacy/medicines`, `/pharmacy/medicines/[id]`
- `/pharmacy/stock`
- `/pharmacy/purchases`, `/pharmacy/purchases/[id]`
- `/pharmacy/suppliers`, `/pharmacy/counts`, `/pharmacy/reports`

Role landing pages:

- Owner: business, staff, claims, quality, and pharmacy overview
- Doctor: schedule, waiting patients, follow-ups, unreviewed results, drafts, quick booking
- Receptionist: calendar, check-in, queue, patient search, unconfirmed appointments, checkout
- Accountant: payments, outstanding invoices, claims, aging
- Pharmacist: dispensing queue, stock, expiry, receipts, activity

---

## 9. Distinctive design direction

### 9.1 Concept: Clinical Current

A calm, precise clinical command center with subtle Bahrain coastal character.

Use:

- Dense professional layouts
- Quiet surfaces and clear hierarchy
- Strong tables and calendar
- Visible patient-safety warnings
- Restrained motion
- Practical forms

Avoid:

- Generic AI dashboard look
- Purple gradients
- Glassmorphism
- Floating blobs
- Giant metric cards
- Excessive pills and rounded boxes
- Huge empty whitespace
- Identical icon cards everywhere
- Default shadcn look without restyling

### 9.2 Suggested tokens

- ink-950 `#10212B`
- ink-700 `#314854`
- ink-500 `#667A84`
- canvas `#F5F7F6`
- surface `#FFFFFF`
- line `#DDE5E3`
- clinical-navy `#163C52`
- gulf-teal `#167D78`
- teal-soft `#DDEEEB`
- sand `#EFE8DD`
- coral `#C8634E`
- warning `#B7791F`
- danger `#B74242`
- success `#267A52`

Never use color alone for status.

### 9.3 Typography

Preferred:

- English: IBM Plex Sans or Source Sans 3
- Arabic: IBM Plex Sans Arabic or Noto Sans Arabic
- Tabular numerals for schedules, money, and quantities
- Compact operational type scale

Avoid unmodified Inter-template appearance.

### 9.4 Layout and interaction

- Collapsible left navigation
- Context header
- Full-width tables and calendars
- Right detail drawer for quick work
- Sticky action bar on long forms
- Unsaved-change warning
- Distinct Save Draft and Finalize actions
- Useful empty, loading, and error states
- Keyboard-friendly appointment creation
- Patient command search
- No fake controls

### 9.5 Patient header

Always show name, patient number, age/date of birth, phone, insurance, allergies, warnings, last visit, and quick actions.

### 9.6 Calendar

- Prioritize day and week views
- Show working hours and current time
- Show doctor, service, duration, status, and conflict
- Fast create by selecting slot
- Accessible list alternative
- Compact filters
- Do not rely only on drag-and-drop

### 9.7 Pharmacy UI

Prioritize search, batch, expiry, quantity, prescription match, verification, stock warning, and finalization. It should look operational, not like an online store.

### 9.8 Accessibility

Target WCAG 2.2 AA where practical:

- Keyboard navigation
- Visible focus
- Semantic labels
- Associated form errors
- Adequate contrast
- No color-only states
- Dialog focus management
- Skip link
- Accessible tables
- Screen-reader names
- Reduced motion
- Logical order
- Arabic RTL support

### 9.9 Required visual review

Capture and inspect:

- 1440 x 900
- 1280 x 800
- 768 x 1024
- 390 x 844

Review login, owner dashboard, doctor dashboard, appointments, patient profile, encounter editor, staff, pharmacy dashboard, and dispensing page. Iterate after viewing screenshots.

---

## 10. Security and privacy baseline

Use OWASP ASVS as practical verification guidance.

Required:

- Strong password hashing
- Secure sessions/tokens
- Authentication rate limits
- Backend authorization
- Tenant isolation
- CSRF protection for cookie auth
- Environment-specific CORS
- Input validation and output encoding
- Safe file uploads
- Secrets only in environment variables
- TLS in production
- Time-limited file access
- Audit logs
- Sensitive-log redaction
- Backup and restore process
- Dependency review
- Security headers
- Mass-assignment protection
- Generic auth errors
- Session revocation

Do not claim HIPAA or legal compliance without actual organizational and legal work.

---

## 11. Testing and verification

Codex must not claim success without running tests.

### 11.1 Backend pytest

Test:

- Login success/failure
- Disabled user blocked
- Invite acceptance and expiry
- Password reset
- Role enforcement
- Tenant isolation for patient, appointment, file, invoice, and pharmacy
- Doctor manages own appointment
- Doctor blocked from other doctor unless permitted
- Receptionist schedule permissions
- Add doctor and link account
- Patient creation and duplicate behavior
- Appointment conflict
- Check-in and queue
- Encounter finalization and amendment
- Prescription creation
- Invoice, payment, claim states
- Pharmacy feature flag
- Batch receipt
- Dispensing reduces correct batch
- Expired and insufficient stock blocked
- Dispensing transaction rollback
- Audit events

### 11.2 Frontend tests

Use Vitest and React Testing Library when compatible.

Test permission-aware navigation, appointment validation, duplicate warning, encounter finalization, staff invitation, pharmacy feature flag, stock warnings, labels, loading, empty, and error states.

### 11.3 Playwright E2E journeys

#### Journey A: Owner adds doctor

- Login owner
- Add Doctor B
- Assign specialty, services, schedule, permissions
- Create invitation
- Accept through demo invite link
- Set password
- Login Doctor B
- Verify doctor dashboard and schedule

#### Journey B: Doctor manages appointment

- Login Doctor A
- Create appointment
- Reschedule and confirm
- Check in if permitted
- Start encounter
- Add SOAP note
- Schedule follow-up
- Finalize encounter
- Confirm follow-up appears

#### Journey C: Reception

- Login receptionist
- Search patient
- Create patient when no match
- Book appointment
- Check in
- Move through queue
- Complete invoice and payment

#### Journey D: Account restriction

- Owner disables Doctor B
- Historical authorship remains
- Doctor B login fails
- Owner reactivates
- Login works

#### Journey E: Pharmacy

- Enable pharmacy
- Login pharmacist
- Receive purchase order with batch and expiry
- Open prescription
- Dispense
- Verify stock decreases
- Verify expired stock blocked
- Preview label
- Verify patient timeline and invoice

#### Journey F: Tenant isolation

- Seed Clinic A and Clinic B
- Login Clinic A
- Attempt direct API and URL access to Clinic B records
- Expect 403 or 404
- Verify Clinic B data absent from search and analytics

### 11.4 Quality commands

Run actual repo equivalents for:

Frontend:

- install
- typecheck
- lint
- unit tests
- build
- Playwright

Backend:

- dependency install
- format/lint
- type check if configured
- pytest
- Alembic upgrade on clean DB
- seed on clean DB

Infrastructure:

- `docker compose config`
- build and startup
- health checks
- frontend-to-backend smoke test
- persistence test

### 11.5 TEST_REPORT.md

Create a truthful report with environment, commands, exits, test counts, failures, fixes, limitations, E2E results, screenshots, accessibility findings, and final pass/fail. Never invent results.

---

## 12. Seed data

Seed:

- Two clinics for isolation
- One pharmacy-enabled and one disabled
- Owner
- Two doctors
- Receptionist
- Nurse
- Accountant
- Pharmacist
- At least 20 patients
- Appointments in major states
- Queue entries
- Encounters and amendment
- Prescriptions
- Lab orders/results
- Invoices/payments/claims
- Messages
- Complaints/incidents
- Medicine catalog
- Suppliers
- Normal, low-stock, near-expiry, and expired batches
- Purchase order
- Dispensing records
- Audit logs

Passwords are development-only and documented.

---

## 13. Priority

### P0

- Preserve existing critical flows
- Staff/doctor creation
- Invitation and login
- Role and permission enforcement
- Doctor appointment management
- Availability and status history
- Queue/check-in
- Finalized encounter and amendments
- Pharmacy feature flag
- Catalog, batch stock, purchasing, receiving, dispensing
- Stock audit
- Role dashboards
- Distinctive design system
- Backend and E2E tests
- TEST_REPORT.md

### P1

- Waitlist
- Nursing vitals
- Lab/imaging orders
- Consent templates
- Complaints/incidents
- Patient duplicate merge
- Credential expiry reminders
- Arabic RTL
- Accessibility audit
- Visual baseline
- Reports/exports

### P2

- Real WhatsApp
- Real email
- Direct insurer integration
- Patient portal
- PWA offline
- National integrations
- Advanced drug database
- Full multi-branch transfers
- Full lab/imaging integration

---

## 14. Definition of done

The phase is complete only when:

- Owner can add doctor and create invitation/account.
- Invited doctor can set password and log in.
- Disabled doctor cannot log in.
- Doctor can manage own appointments.
- Receptionist can manage permitted schedules.
- Backend enforces permissions and tenant isolation.
- Pharmacy is enabled for one clinic and hidden for another.
- Purchase, receipt, batch, dispensing, and stock reduction work.
- Expired and insufficient stock are blocked.
- Patient, appointment, encounter, billing, claim, and pharmacy data connect.
- UI follows Clinical Current and screenshots were reviewed.
- Core buttons perform real actions.
- Migrations and seeds work on clean DB.
- Tests actually ran.
- TEST_REPORT.md is truthful.
- README documents setup, accounts, flags, mocks, and limits.

---

## 15. Research basis

This specification was informed by:

1. Original ClinicFlow product/business specification.
2. Bahrain NHRA Good Documentation Practice Policy.
3. Bahrain NHRA Retention and Disposal of Medical Records Policy.
4. Bahrain NHRA Accreditation Standards for Medical Centers.
5. Bahrain NHRA National Informed Consent Policy.
6. Bahrain NHRA Pharmacy and Pharmaceutical Facilities Standards.
7. Bahrain NHRA Responsibilities of Pharmacists Handling and Dispensing Medicines.
8. Bahrain Personal Data Protection publications.
9. HL7 FHIR Appointment, Slot, Encounter, PractitionerRole, MedicationRequest, and MedicationDispense concepts.
10. OWASP ASVS.
11. W3C WCAG.
12. Official OpenAI Codex guidance for AGENTS.md, skills, Playwright, and responsive UI validation.

Reference links:

- https://www.nhra.bh/Departments/HCP/Policies/MediaHandler/GenericHandler/documents/departments/HCP/Policies/Good%20Documentation%20Practice%20Policy.pdf
- https://www.nhra.bh/Departments/HCP/Policies/MediaHandler/GenericHandler/documents/departments/HCP/Policies/Retention%20and%20Disposal%20of%20Medical%20Records.pdf
- https://www.nhra.bh/Departments/Accreditation/MediaHandler/GenericHandler/documents/departments/Accreditation/Accreditation%20Standards%20for%20Medical%20Centers.pdf
- https://www.nhra.bh/MediaHandler/GenericHandler/documents/departments/HCP/Policies/HCP_Policies_National%20Informed%20Consent_v1.0_2016.pdf
- https://www.nhra.bh/Departments/PPR/MediaHandler/GenericHandler/documents/departments/PPR/Pharmaceutical%20Facilities/PPR_Standards_Licensing%20and%20Regulation%20Standards%20for%20Pharmacy%20and%20Pharmaceutical_Facilities_v1.1_2017.pdf
- https://www.nhra.bh/MediaHandler/GenericHandler/documents/departments/HCP/Policies/HCP_Policies_Responsibilities%20of%20Pharmacists%20Handling%20and%20Dispensing%20Medicines_v1.0_2013.pdf
- https://www.pdp.gov.bh/en/regulations.html
- https://hl7.org/fhir/
- https://owasp.org/www-project-application-security-verification-standard/
- https://www.w3.org/WAI/standards-guidelines/wcag/
- https://developers.openai.com/codex/guides/agents-md
- https://developers.openai.com/codex/build-skills
- https://developers.openai.com/codex/use-cases/frontend-designs

When this document conflicts with an older prototype shortcut, this document wins for the new phase. Preserve working functionality and migrate carefully.
