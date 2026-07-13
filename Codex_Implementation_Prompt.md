# Codex Implementation Prompt

Continue development of the current ClinicFlow repository.

Before writing code, inspect the full repository and read:

- `AGENTS.md`
- `ClinicFlow_System_Expansion_Spec.md`
- Existing `README.md`
- Existing models, migrations, routers, frontend routes, components, and tests
- `.agents/skills/clinicflow-ui-design/SKILL.md`
- `.agents/skills/clinicflow-webapp-validation/SKILL.md`

Explicitly use:

- `$clinicflow-ui-design`
- `$clinicflow-webapp-validation`
- `$playwright-interactive` if available

## Goal

Complete the next full ClinicFlow phase without needlessly rebuilding working functionality. Extend the application with safe migrations, real backend behavior, polished UI, and actual automated/browser verification.

Keep the stack:

- Next.js App Router + TypeScript
- FastAPI + Python
- PostgreSQL
- SQLAlchemy
- Alembic
- Docker Compose
- Multi-tenant responsive web SaaS

## Mandatory work

### 1. Staff and doctor accounts

Implement the full staff lifecycle:

- Owner can add doctors and other staff.
- Doctor profile includes specialty, services, license number, license expiry, schedule, status, and permissions.
- Secure single-use invitation with expiry.
- Invitation acceptance and password setup.
- New doctor can log in.
- Pending, accepted, expired, revoked states.
- Resend and revoke invitation.
- Disable, reactivate, reset password, and revoke sessions.
- Historical notes keep original author after account is disabled.
- Actually test login for every seeded role.

### 2. Doctor appointment control

Doctors must manage appointments, not only view them.

Implement:

- Own day, week, and month calendar
- Create appointment for existing or new patient
- Create follow-up from encounter
- Edit, confirm, check in, start, complete, reschedule, cancel, and no-show
- Block time and add leave
- Conflict detection
- Status history
- Own-schedule permission by default
- Optional permission to manage all doctors
- Backend authorization and audit logs

Receptionists must keep their permitted scheduling capabilities.

### 3. Patient journey

Implement or complete:

- Duplicate-patient warning
- Check-in
- Queue
- Waitlist
- Encounter finalization
- Immutable finalized notes
- Amendments with reason and original preservation
- Allergy banner
- Follow-up appointment
- Lab and imaging order tracking
- Referral tracking
- Consent records
- Secure documents and attachments
- Complaints and incidents where P1 scope fits safely

### 4. Optional pharmacy

Add `pharmacy_enabled` per clinic.

When disabled:

- Hide pharmacy navigation.
- Reject pharmacy APIs.

When enabled, implement:

- Pharmacy dashboard
- Pharmacist role and permissions
- Medicine catalog
- Suppliers
- Purchase orders
- Goods receipt
- Batch and expiry inventory
- Stock movements
- Low-stock and expiry alerts
- Stock count and adjustments
- Prescription queue
- Partial and full dispensing
- Pharmacist verification
- Clarification note to prescriber
- Batch selection
- FEFO suggestion
- Expired-stock block
- Insufficient-stock block
- Label preview or print
- Pharmacy invoice connection
- Patient timeline connection
- Immutable dispensing and stock audit
- Reports listed in the system specification

Use database transactions so failed dispensing never partially changes stock.

Do not claim the system replaces statutory registers.

### 5. Permissions and tenant isolation

Implement granular backend permissions.

Requirements:

- Never trust frontend clinic ID.
- Seed two clinics.
- Test cross-clinic API and direct URL access.
- Secure files.
- Create audit logs.
- Block disabled users.
- Hidden UI alone is never security.

### 6. Distinctive redesign

The current design is too general. Redesign it using **Clinical Current** and `$clinicflow-ui-design`.

Requirements:

- Distinct ClinicFlow design system
- Mineral navy, gulf teal, and sand neutrals
- Strong calendar and tables
- Compact professional density
- Role-specific dashboards
- Persistent patient safety header
- Clear allergies and warnings
- Arabic-compatible typography and initial RTL support
- No generic AI dashboard style
- No purple gradients
- No glassmorphism
- No giant metric cards
- No excessive pills or rounded boxes
- Restyle component-library defaults
- Responsive desktop, tablet, and mobile
- WCAG 2.2 AA direction

Create centralized tokens and reusable components. Do not use one-off CSS for every page.

### 7. Tests and browser verification

Use `$clinicflow-webapp-validation`.

Add and run:

- Backend pytest
- Frontend component tests
- Playwright E2E
- Auth and invitation tests
- Permission and tenant-isolation tests
- Doctor scheduling tests
- Pharmacy transaction tests
- Migration and seed tests
- Axe accessibility checks where possible
- Responsive screenshots

Run all required E2E journeys from the specification:

- Owner adds Doctor B
- Doctor B accepts invite and logs in
- Doctor manages appointment and follow-up
- Receptionist completes patient journey
- Owner disables and reactivates doctor
- Pharmacist receives and dispenses stock
- Cross-clinic access fails

Capture and inspect:

- 1440 x 900
- 1280 x 800
- 768 x 1024
- 390 x 844

Iterate until there is no clipping, overlap, broken navigation, console error, failed request, or inaccessible core control.

### 8. Documentation

Update README with:

- Setup
- Environment variables
- Demo accounts
- Migrations
- Seed
- Feature flags
- Mock integrations
- Security limits
- Pharmacy limits

Create `TEST_REPORT.md` containing truthful commands, results, counts, E2E status, screenshots, accessibility findings, and limitations.

## Working method

1. Audit current repo against the specification.
2. Create an internal checklist.
3. Add tests around risky existing behavior.
4. Implement P0 in coherent slices.
5. Run tests after each slice.
6. Implement safe P1 items.
7. Redesign and visually inspect core pages.
8. Run the complete final suite.
9. Fix regressions.
10. Report verified results only.

Do not stop at scaffolding.
Do not leave core flows as TODOs.
Do not use fake buttons for required actions.
Do not invent test results.
Do not claim legal compliance.
Do not expose real patient data in logs or seeds.
Do not ask me to manually test before you run the available automated tests.

At the end, return a simple summary of four lines maximum:

1. Features added
2. Design changes
3. Tests and results
4. Remaining limitations
