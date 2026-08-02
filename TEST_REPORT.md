# ClinicFlow test report

Current frontend validation: 2026-07-30 (Asia/Bahrain)

## Current frontend results

| Area | Command | Result |
|---|---|---|
| Frontend lint | `cd frontend && npm run lint` | Passed |
| Frontend types | `cd frontend && npm run typecheck` | Passed |
| Component tests | `cd frontend && npm test -- --run` | Passed; 4 files, 7 tests |
| Production build | `cd frontend && npm run build` | Passed; 32 static pages generated and all listed routes compiled |
| Browser E2E | `cd frontend && PLAYWRIGHT_CHROMIUM_PATH=/home/hashem/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome npx playwright test` | Passed; 6 journeys in 1.0 minute |
| Accessibility | Axe scans in light and dark core owner journeys | Passed; no serious or critical findings |
| Responsive overflow | Automated page-width assertion | Passed at 1440, 1280, 768, and 390 px |
| Docker runtime | `docker compose config --quiet`, startup, health and reachability checks | Passed |

The final E2E result is from one uninterrupted run after clearing the generated `.next`
directory. The suite ran its configured clean migration and seed setup before exercising
the application.

## Browser journeys passed

1. Owner invites Doctor B; the doctor accepts the single-use invitation, manages an
   appointment, finalizes an encounter, creates a follow-up, and is disabled/reactivated.
2. Receptionist registers a patient, books and checks in an appointment, moves the
   patient through the queue, and reaches invoice creation.
3. Pharmacist creates a purchase order, receives a dated batch, verifies stock, dispenses
   an open prescription, and reaches the immutable label preview.
4. Cross-tenant patient access is blocked, disabled pharmacy navigation/API behavior is
   respected, all required responsive widths avoid page overflow, and the core owner Axe
   scan has no serious or critical findings.
5. Arabic persists after refresh; RTL navigation, forms, dashboard, appointment list,
   table behavior, and switching back to English work.
6. Every seeded role reaches a distinct, permitted workspace with role-appropriate
   navigation.
7. Light/dark choice persists through refresh; system mode remains available when no
   manual choice exists.

## Visual captures inspected

- `frontend/test-results/screenshots/desktop-1440-dashboard.png`
- `frontend/test-results/screenshots/desktop-1440-dashboard-dark.png`
- `frontend/test-results/screenshots/desktop-1440-dashboard-ar.png`
- `frontend/test-results/screenshots/desktop-1280-dashboard.png`
- `frontend/test-results/screenshots/tablet-768-dashboard.png`
- `frontend/test-results/screenshots/tablet-768-patient-form-ar.png`
- `frontend/test-results/screenshots/mobile-390-dashboard.png`
- `frontend/test-results/screenshots/mobile-390-patient-form-ar.png`
- `frontend/test-results/screenshots/desktop-appointments.png`
- `frontend/test-results/screenshots/desktop-appointments-ar.png`
- `frontend/test-results/screenshots/desktop-staff.png`

The final review verified the Clinical Current visual hierarchy in both themes, Arabic
RTL sidebar placement, readable internal table scrolling at 390 px, mobile dashboard
containment, visible desktop appointment statuses, and database-derived labeled chart
bars. A dedicated dark patient-list hover check confirmed a slate row background
(`rgb(61, 70, 95)`) and readable cyan patient link (`rgb(107, 200, 234)`).

## Historical backend and deployment evidence

The following checks were executed on 2026-07-13 and are retained as historical results.
They were not rerun on 2026-07-15 because the current task changed frontend files only.

| Area | Historical result (2026-07-13) |
|---|---|
| Backend Ruff lint/format | Passed; 33 files formatted and no findings |
| Backend pytest | Passed; 22 tests |
| Frontend dependency audit | Passed; 0 vulnerabilities |
| Clean migration/seed | Passed at head `0003_documents_quality`; 2 clinics, 10 users, 25 patients |
| Docker configuration/build/startup | Passed; PostgreSQL, migrations/seed, API, and web healthy |

## Skipped and limitations

- Backend lint/tests and Docker image builds were skipped in the current frontend-only
  continuation; no backend or infrastructure file was modified. Existing Docker images
  were started and all four services were verified running.
- Axe coverage is targeted and is not a complete WCAG, legal, or clinical compliance
  certification.
- Email/SMS/WhatsApp delivery is mocked, private documents use local filesystem storage,
  and pharmacy features do not replace statutory or jurisdictional controls.
- Patient and appointment forms use direct structured keys. Some secondary legacy
  routes still use the central compatibility translator; the tested Arabic journeys
  displayed translated content with correct document direction.
