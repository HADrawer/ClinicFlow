# ClinicFlow

ClinicFlow is a multi-tenant clinic operations application for small private clinics in Bahrain and the GCC. It connects staff access, scheduling, patient records, clinical encounters, billing, quality records, and an optional batch-level pharmacy. ClinicFlow records clinician decisions; it does not diagnose and is not a regulatory or statutory register.

## Stack

- Next.js 16 App Router, React 19, TypeScript, Tailwind CSS
- FastAPI, SQLAlchemy 2, Pydantic 2, Alembic
- PostgreSQL 17 in Docker; SQLite is supported for lightweight local tests
- Pytest, Vitest/Testing Library, Playwright, and Axe

## Docker setup

```bash
cp .env.example .env
docker compose up --build
```

The backend waits for PostgreSQL, applies all migrations, runs the idempotent demo seed, and starts on `http://localhost:8000`. The web app is at `http://localhost:3000`, API docs at `http://localhost:8000/docs`, and Adminer at `http://localhost:8080`.

Stop the containers with `docker compose down`. Add `-v` only when you intentionally want to delete the PostgreSQL demo volume.

## Local setup

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements-dev.txt
cd backend
alembic upgrade head
python -m app.seed
uvicorn app.main:app --reload
```

In another terminal:

```bash
cd frontend
npm install
BACKEND_API_ORIGIN=http://localhost:8000 npm run dev
```

The frontend never talks to the backend directly from the browser. It proxies same-origin requests under `/backend-api/*` (see `next.config.ts`) to `${BACKEND_API_ORIGIN}/api/*` server-side, so the browser only ever needs the frontend's own origin — no LAN IP, Docker hostname, or port 8000. `BACKEND_API_ORIGIN` is server-only (never `NEXT_PUBLIC_*`) and is required at dev/build/start time; Next.js fails fast with a clear error if it is missing.

Important environment variables are `DATABASE_URL`, `JWT_SECRET`, `ACCESS_TOKEN_EXPIRE_MINUTES`, `CORS_ORIGINS`, `PRIVATE_UPLOAD_DIR`, `MAX_UPLOAD_BYTES`, and `BACKEND_API_ORIGIN`. Use a strong secret and deployment-specific origins outside development.

## Staff invitation email (Resend)

Staff invitations are sent by email through [Resend](https://resend.com). Configuration:

| Variable | Purpose |
|---|---|
| `ENVIRONMENT` | `development` (default) or `production`. Only `production` enforces strict Resend configuration and hides invitation tokens from API responses. |
| `RESEND_API_KEY` | Resend API key. Required in production. |
| `RESEND_FROM_EMAIL` | Verified sender address in Resend. Required in production. |
| `APP_BASE_URL` | Frontend origin used to build invitation links (`${APP_BASE_URL}/invite/${token}`). |
| `INVITATION_EXPIRY_HOURS` | Default invitation lifetime (also the default for the `expires_in_hours` field on create). |

Provider selection (`backend/app/email_provider.py`):

- `environment=production` → `ResendEmailProvider`. If `RESEND_API_KEY`/`RESEND_FROM_EMAIL` are missing, the invitation is still created and persisted with `delivery_status=failed` (safe to resend later), and the API returns `502` with a clear configuration error instead of claiming the email was sent.
- `environment!=production` with Resend credentials set → `ResendEmailProvider` (lets a developer opt into real sending locally).
- `environment!=production` without credentials → `LoggingEmailProvider`, which never touches the network and only logs.
- Tests inject `MockEmailProvider` via a FastAPI dependency override (`app.dependency_overrides[get_email_provider]`) to assert on sent content and simulate failures.

Only the invitation's `token_hash` (SHA-256 digest) is ever persisted or logged; raw tokens exist only in memory long enough to build the email link. The `demo_token` field on `InvitationOut` (and the corresponding "copy link" UI) is populated only when `environment != production`, so production responses never expose a raw invitation token.

Delivery is tracked per invitation via `delivery_status` (`pending`/`sent`/`failed`), `sent_at`, `last_delivery_error`, and `delivery_attempts`, visible on `GET /api/invitations`.

## Demo accounts

Every seeded account uses `password123`.

| Role | Email |
|---|---|
| Owner | `owner@clinicflow.test` |
| Doctor | `doctor@clinicflow.test` |
| Receptionist | `reception@clinicflow.test` |
| Nurse | `nurse@clinicflow.test` |
| Accountant | `accountant@clinicflow.test` |
| Pharmacist | `pharmacist@clinicflow.test` |
| Second-clinic owner | `owner.riffa@clinicflow.test` |

The seed creates two clinics, 10 users, 25 synthetic patients, doctor profiles, appointments, encounters, finance records, orders, pharmacy suppliers, medicines, purchase orders, and normal/low/near-expiry/expired batches. Pharmacy is enabled only for Seef Family Clinic.

## Migrations and seed

```bash
cd backend
alembic upgrade head
alembic current
python -m app.seed
```

Schema changes must be made through Alembic. The expansion migrations preserve existing records and add staff lifecycle, scheduling, encounter, pharmacy, secure-document, complaint, and incident tables. The seed is idempotent and never uses real patient information.

## Implemented workflows

- Owner-managed invitations, password setup/reset, staff profiles, granular permissions, disable/reactivate, and session revocation
- Doctor-owned calendars, optional all-doctor permission, conflict detection/override, schedule blocks, leave, queue, waitlist, and audited status history
- Duplicate-patient warning, persistent safety/allergy context, finalized immutable SOAP notes, amendments, follow-up, lab/imaging orders, referrals, consents, private attachments, complaints, and incidents
- Optional pharmacy with backend feature gating, catalog, suppliers, purchase orders, goods receipt, batches, expiry/low-stock alerts, stock counts/adjustments, movements, FEFO suggestions, partial/full dispensing, clarification, label preview, and reports
- Role-specific Clinical Current dashboards and navigation for owner, doctor, receptionist, nurse, accountant, and pharmacist
- Persisted light, dark, and system appearance modes with English/Arabic controls and theme-aware operational charts
- Runtime English/Arabic switching with true LTR/RTL layout, localized clinical forms, tables, dates, states, and accessible labels
- Backend-derived tenant scope on every protected workflow; the browser never supplies an authoritative `clinic_id`

Feature flags are stored per clinic and managed under Settings. `pharmacy_enabled` controls both navigation and API access. Seeded flags also cover nursing triage, insurance, lab/imaging orders, consents, waitlist, Arabic support, and mock WhatsApp.

## Validation commands

```bash
cd backend
PYTHONPATH=. ../.venv/bin/ruff check app tests
PYTHONPATH=. ../.venv/bin/pytest -q

cd ../frontend
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e

cd ..
docker compose config --quiet
docker compose build
docker compose up -d
```

See `TEST_REPORT.md` for the latest verified results and screenshots.

## Security and integration limits

- Invitation, password-reset, and mock message links are returned in development instead of being delivered by a production email/SMS provider.
- WhatsApp/message delivery is intentionally mocked; records are clearly marked and no patient is contacted.
- Documents are private, tenant-scoped, MIME/size checked, stored outside public web paths, and downloaded through five-minute session-bound links. Production deployments still need encrypted object storage, malware scanning, backups, retention policy, and key management.
- JWT session-version revocation is implemented; production deployments should add managed secrets, rate limiting, MFA where appropriate, monitoring, and tested backup/restore.
- Pharmacy stock control is operational software only. It does not replace statutory registers, professional verification, or jurisdiction-specific reporting.
- Arabic and RTL are implemented and browser-tested for the seeded demo workflows. Production deployment still requires clinic-specific terminology review and native-speaker clinical QA.
