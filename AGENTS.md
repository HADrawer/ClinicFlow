# AGENTS.md

## Source of truth

Before changing code, read:

1. `ClinicFlow_System_Expansion_Spec.md`
2. Existing README and architecture files
3. Existing database models and Alembic migrations
4. Existing tests
5. `.agents/skills/clinicflow-ui-design/SKILL.md`
6. `.agents/skills/clinicflow-webapp-validation/SKILL.md`

The expansion specification defines this phase.

## Core rules

- Inspect the entire repository before editing.
- Preserve working features and data.
- Frontend: Next.js App Router and TypeScript.
- Backend: FastAPI, SQLAlchemy, Pydantic, Alembic, PostgreSQL.
- Keep the system multi-tenant.
- Enforce permissions and tenant isolation in backend code.
- Never trust `clinic_id` from the browser.
- Use migrations for schema changes.
- Do not leave required actions as fake buttons.
- Do not claim success without actual tests.
- Do not claim legal or regulatory certification.
- The product records clinical decisions. It does not diagnose.

## Required focus

- Owner can add doctors and staff.
- Invitation, password setup, login, disable, reactivate, and session revocation.
- Doctor can manage own appointments like reception within permission scope.
- Optional pharmacy per clinic.
- Batch stock, expiry, purchase, receipt, dispensing, and stock audit.
- Distinctive role-based UI.
- Complete automated and browser tests.
- Truthful `TEST_REPORT.md`.

## Design

Use `$clinicflow-ui-design`.

Direction: **Clinical Current**.

- Calm and precise
- Mineral navy and gulf teal
- Compact professional typography
- Strong patient-safety hierarchy
- Strong tables and calendar
- No generic AI dashboard
- No purple gradients, glassmorphism, giant cards, or excessive pills
- Restyle component-library defaults

Inspect screenshots at desktop, tablet, and mobile sizes and iterate.

## Validation

Use `$clinicflow-webapp-validation`.

Run actual commands for:

- Frontend typecheck, lint, tests, build
- Backend checks, tests, migrations, and seed
- Docker build and startup
- Playwright E2E
- Accessibility checks when available

Test every seeded role by logging in. Never invent passing results.

## Code quality

- Prefer focused modules and reusable services.
- Centralize permission checks, audit logging, and tenant scoping.
- Use transactions for payments, stock, and dispensing.
- Use typed schemas and stable API errors.
- Add clear loading, empty, and error states.
- Avoid broad rewrites when safe migrations are possible.
- Do not log patient data.

## Final response

Return a simple summary of four lines maximum:

1. Main features added
2. Design work completed
3. Test results
4. Remaining limitations
