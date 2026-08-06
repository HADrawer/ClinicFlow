# ClinicFlow UI redesign report

Date: 2026-08-04 (Asia/Bahrain)

## Scope and audit

This iteration is frontend-only. The system expansion specification, frontend README,
route tree, shared layout, UI primitives, API client, authentication/session flow,
localization layer, frontend tests, and the existing backend routes/models/schemas were
audited before implementation. Backend files were read only; no API contract, database
model, migration, seed, permission rule, infrastructure file, or backend test was changed.

The frontend page inventory covered authentication, role dashboards, appointments,
queue, waitlist, patients, encounters, prescriptions, orders, messages, staff, settings,
reports, quality, insurance, billing, and all pharmacy routes. The broad redesign work
was limited to the shared application shell and the patient/appointment workflows where
the existing API can support real popup-first behavior.

## Pages and workflows redesigned

- Reworked the application shell with a permission-aware global Quick Create menu,
  persistent Clinical Current navigation, and space-aware desktop/mobile patient context.
- Rebuilt the appointment index as an operational day/week/month/list schedule with
  provider, room, status, and patient/CPR search filters; localized Today/period controls;
  empty-slot creation; status styling; quick details; in-place edit/reschedule; and
  check-in actions.
- Refactored appointment creation and editing onto one reusable form used by both full
  pages and dialogs. It uses server-backed patient search, provider search, a nested Add
  Patient dialog, custom calendar and time controls, 15/30/45-minute duration choices,
  calculated API end time, conflict display, dirty-close protection, and double-submit
  protection.
- Refactored patient registration onto one reusable full-page/dialog form with normalized
  CPR, required CPR/DOB/gender/phone/name for new records, strict past-DOB validation,
  duplicate checks and acknowledgment, backend field-error mapping, dirty-close
  protection, and compact quick-create mode.
- Updated the patient list to use popup creation, debounced server search, file-number and
  CPR columns, clinical warnings, specific empty/search-empty states, and an explicit
  “Keep in workspace” action.
- Added a selected-patient context scoped to clinic and signed-in user. Only the patient
  ID is stored in session storage; the current API response is revalidated after reload.
  Desktop uses an RTL-aware rail; mobile uses a compact chip and expandable sheet.
- Connected staff Quick Create to the existing secure invitation dialog via
  `/staff?invite=1`, without duplicating the invitation form or service logic.

## Shared components and design system

- Upgraded the shared modal into reusable dialog/sheet infrastructure with focus trap,
  focus restoration, nested-dialog awareness, Escape/backdrop handling, accessible title
  and description wiring, body scroll lock, dirty-form confirmation, and mobile
  full-screen behavior.
- Added a reusable debounced search combobox, application-controlled date picker,
  application-controlled working-hours time picker, duration selector, patient/provider
  result rows, and patient-context primitives.
- Extended the Clinical Current token layer with restrained dialog/popover elevation,
  dense schedule grids, status-specific appointment treatments, RTL logical properties,
  patient-safety treatments, responsive patient rail behavior, and focused mobile sheets.
- Added normalized UTC parsing for naïve timestamps returned by the existing API so
  stored UTC appointments render in the correct local schedule hour.
- Updated the API error type to surface Pydantic field errors inside reusable forms.
- Kept UI permission checks as affordances only; every mutation still goes through the
  existing backend authorization.

## English, Arabic, RTL, and responsive status

- All newly visible workflow labels, validation messages, accessible names, empty/error
  text, dialog copy, schedule controls, and patient-context actions use structured English
  and Arabic translation keys.
- Runtime language persistence and document `lang`/`dir` switching remain intact.
- RTL inspection covered the right-side navigation, mirrored directional controls,
  appointment list, Arabic mobile appointment sheet, custom controls, patient form,
  mixed English patient/provider values, numbers, CPRs, and phone values.
- Visual inspection covered 1440×900, 1280×800, 768×1024, and 390×844. The selected
  patient rail deliberately narrows the desktop workspace; its filters reflow at 1280,
  while the calendar retains keyboard-accessible horizontal scrolling instead of hiding
  clinical data.
- Mobile appointment dialogs become full-screen scroll containers with a persistent
  action bar. Mobile patient context is separate from the desktop rail, with no duplicate
  chip at desktop widths.

## Role-based review

- Owner: Quick Create for patients, appointments, and staff invitations; full operational
  navigation; schedule controls; staff/setup recovery when no doctor exists.
- Doctor: own provider is preselected and locked unless existing manage-all permission is
  present; patient, encounter, and follow-up journeys remain intact.
- Reception: schedule-slot booking, nested patient registration, check-in, queue, selected
  patient context, and invoice handoff were exercised end to end.
- Nurse, accountant, and pharmacist: navigation reflects role baselines plus explicit
  backend permission grants. Pharmacist patient access is retained because it is part of
  the existing backend permission template and supports safe dispensing context.
- Disabled pharmacy clinics still hide the pharmacy module and receive the existing API
  denial.

## Visual and anti-AI audit

- The changed interface uses compact operational typography, thin borders, restrained
  radii/shadows, tables and schedule grids for structured data, and workflow-specific
  actions. It does not introduce gradients, glassmorphism, decorative blobs, generic
  startup copy, fake charts, unsupported metrics, giant operational headings, nested card
  grids, or ornamental animation.
- Direct screenshot review fixed a desktop account-menu/patient-rail layer conflict, a
  duplicate desktop patient chip, cramped 1280px filters, UTC schedule placement, and
  cancelled-appointment secondary-text contrast.
- Remaining intentional behavior: week calendars can scroll horizontally on constrained
  widths, and long full-screen mobile forms scroll inside the sheet. The black “N” control
  visible in development screenshots is the Next.js development toolbar and is absent
  from the production build.

## Commands executed and results

| Command | Result |
|---|---|
| `cd frontend && npm run lint` | Passed; no warnings or errors |
| `cd frontend && npm run typecheck` | Passed |
| `cd frontend && npm test -- --run` | Passed; 9 files, 15 tests |
| `cd frontend && NEXT_PRIVATE_BUILD_WORKER=1 npm run build` | Passed; production compilation succeeded and 32/32 static pages were generated |
| `cd frontend && PLAYWRIGHT_CHROMIUM_PATH=/home/hashem/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome npx playwright test --reporter=list` | Passed; 6/6 journeys in 1.6 minutes |
| Axe WCAG 2 A/AA/2.1 AA/2.2 AA scans | Passed; no critical or serious violations in the final core owner/dashboard/appointment-dialog scans |
| Responsive overflow assertions | Passed at 1440, 1280, 768, and 390 px |
| Clean browser migration setup | Passed existing migrations `0001` through `0003` against the isolated E2E SQLite database |

Final failures: none. One preceding build attempt compiled and type-checked, then its
page-data worker received a host `SIGTERM`; the immediate resource-constrained rerun
completed successfully. Iterative browser runs exposed stale selectors, the patient-rail
layer conflict, naïve UTC parsing, and cancelled-status contrast; all were corrected
before the final uninterrupted 6/6 run. Backend tests, backend lint, backend image builds,
and production database migrations were not run because this work is strictly
frontend-only and changed no backend or infrastructure file.

## Backend limitations and intentionally deferred requirements

- The backend does not require CPR or reject DOB today/future. The frontend now enforces
  those rules for its forms, but authoritative server enforcement needs backend schema,
  model, conflict, migration, and test changes outside this task’s permitted scope.
- Patient search supports name, CPR, and phone but not file number; the UI does not claim
  unsupported file-number search. Provider search remains doctor-only and lacks an
  explicit `is_bookable_provider` flag, phone search, and availability response.
- The existing appointment API requires start and end timestamps. The frontend calculates
  end time from 15/30/45 minutes, but the backend does not yet calculate or restrict
  duration and has no clinic-configurable default duration contract.
- Rooms remain the existing free-text, conflict-checked appointment field. Managed rooms,
  provider-room many-to-many assignments, room search, and room administration require
  backend support.
- Patient/staff photographs and secure private object-storage identifiers are absent from
  the API. Default initials are used; no local-only upload or fake storage was added.
- Family relationships, inverse mapping, family tabs/tree, and shared household insights
  have no backend models or endpoints and were not simulated.
- Existing permissions are role baselines plus explicit grants; revocations, inherited
  versus explicit state, audited permission editing, and an effective-permissions endpoint
  are not available, so no misleading permission editor was added.
- Database-persisted clinic onboarding, bookable-provider completion rules, and resumable
  setup APIs do not exist. The frontend cannot truthfully gate the dashboard with local
  completion state.
- Invitations use the existing development token flow. Resend delivery, hashed provider
  abstraction, delivery state, production configuration errors, Arabic email templates,
  and invitation rate limiting require backend work.
- Appointment templates, relational procedures, group participants, pins, recalls,
  packages/plans, reminder preferences, and waiting-time analytics are not supported by
  the existing API and remain omitted rather than faked.
- Patient 360 remains the existing backend aggregation. New timeline event families,
  sensitive-field permission slicing, family data, photos, and financial/clinical
  expansions require backend capabilities.
- Some unchanged legacy routes still rely on the central compatibility translator rather
  than direct semantic keys. The changed popup-first patient and appointment surfaces are
  fully keyed; a repository-wide localization rewrite was intentionally avoided.
