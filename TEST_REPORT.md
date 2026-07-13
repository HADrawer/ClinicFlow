# ClinicFlow test report

Date: 2026-07-13 (Asia/Bahrain)

## Verified results

| Area | Command | Result |
|---|---|---|
| Backend lint | `cd backend && ../.venv/bin/ruff check app tests` | Passed; no findings |
| Backend format | `cd backend && ../.venv/bin/ruff format --check app tests` | Passed; 33 files formatted |
| Backend tests | `cd backend && PYTHONPATH=. ../.venv/bin/pytest -q` | Passed; 22 tests |
| Frontend lint | `cd frontend && npm run lint` | Passed |
| Frontend types | `cd frontend && npm run typecheck` | Passed |
| Component tests | `cd frontend && npm test -- --run` | Passed; 2 files, 3 tests |
| Production build | `cd frontend && npm run build` | Passed; 32 routes generated/validated |
| Dependency audit | `cd frontend && npm audit --audit-level=low` | Passed; 0 vulnerabilities |
| Clean migration/seed | SQLite database in `/tmp`, `alembic upgrade head`, `python -m app.seed`, `alembic current` | Passed; head `0003_documents_quality`, 2 clinics/10 users/25 patients seeded |
| Browser E2E | `cd frontend && PLAYWRIGHT_CHROMIUM_PATH=… npm run test:e2e` | Passed; 4 journeys |
| Accessibility | Axe WCAG 2 A/AA, 2.1 AA, and 2.2 AA tags on owner dashboard | Passed; 0 serious or critical violations |
| Responsive overflow | Automated `documentElement.scrollWidth <= viewport` assertion | Passed at all four required widths |
| Docker | `docker compose config --quiet`, image build, `docker compose up -d` | Passed; PostgreSQL healthy, migrations/seed started, API/web healthy, owner login returned bearer token, logs contained no errors |

FastAPI/Python emitted 211 upstream `asyncio.iscoroutinefunction` deprecation warnings during pytest; they did not fail tests. The test browser emitted Node/module deprecation notices only.

The first complete Compose build passed. A later final-image Compose rebuild twice hit an external npm registry idle timeout; the same final Dockerfile then built successfully with `docker build --network=host -t clinicflow-frontend:latest frontend`, after which Compose startup, health, login, and log checks passed. The Dockerfile now uses deterministic `npm ci` with a BuildKit npm cache and retry/timeouts.

## Browser journeys

1. Owner invited Doctor B with profile/service/license data; Doctor B accepted the single-use link, set a password, logged in, managed status/queue steps, finalized an immutable encounter, and booked a follow-up. Owner disable blocked login and reactivation restored the account.
2. Receptionist registered a patient with allergy/consent data, booked and checked in an appointment, moved the patient through the queue, and reached invoice creation.
3. Pharmacist created a purchase order, received a dated batch, verified stock, dispensed an open prescription, and reached the immutable label preview.
4. Direct cross-clinic patient access returned 404; the second clinic hid pharmacy navigation and its pharmacy API returned 404.

Backend tests additionally verify every seeded role login, invitation expiry/revocation/single use, session revocation, scheduling conflicts and history, immutable encounter amendments, partial/full/idempotent dispensing, failed-transaction stock rollback, expired stock blocking, secure document consent/download/tenant isolation, quality records, and audit events.

## Inspected screenshots

- `frontend/test-results/screenshots/desktop-1440-dashboard.png` — 1440 × 900 viewport
- `frontend/test-results/screenshots/desktop-1280-dashboard.png` — 1280 × 800 viewport
- `frontend/test-results/screenshots/tablet-768-dashboard.png` — 768 × 1024 viewport
- `frontend/test-results/screenshots/mobile-390-dashboard.png` — 390 × 844 viewport
- `frontend/test-results/screenshots/desktop-appointments.png` — loaded week calendar
- `frontend/test-results/screenshots/desktop-staff.png` — loaded staff lifecycle table

The captures were visually inspected. Contrast was increased after the first Axe run, loading-state-only captures were replaced, table containment was corrected, and the 390 px dashboard now has no page-level horizontal overflow. Wide operational tables retain compact desktop density and use wrapped/hidden secondary columns on narrow screens.

## Remaining limitations

- Email/SMS/WhatsApp delivery is mocked; development returns invitation and reset links directly.
- Private documents use local filesystem storage. Production still needs encrypted object storage, malware scanning, retention/backup policy, and managed keys.
- Axe covered the core owner dashboard and browser journeys exercised core controls, but this is not a claim of complete WCAG or legal/regulatory certification.
- The environment’s Playwright-managed Chromium 140 installer stalled after download, so browser verification used the already-installed Chromium 149 binary through `PLAYWRIGHT_CHROMIUM_PATH`.
- Arabic-compatible fonts and initial RTL scaffolding exist; full translation and clinical RTL QA are not complete.
- Pharmacy features do not replace statutory registers or professional/jurisdictional controls.
