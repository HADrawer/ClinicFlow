# ClinicFlow UI redesign report

Date: 2026-07-30 (Asia/Bahrain)

## Current redesign iteration

- Rebuilt the light and dark application shell to match the supplied clinical dashboard
  references: white operational chrome and a cool-gray workspace in light mode, unified
  slate navigation and work surfaces in dark mode, compact Mulish-style typography,
  cyan active navigation, thin borders, and restrained radii and shadows.
- Reproduced the reported patient-name hover defect in a real dark-mode browser
  (`#f6faf9` was leaking into the dark table state). Data rows now use semantic hover
  and focus tokens; the verified dark hover remains slate (`rgb(61, 70, 95)`) while the
  patient link remains cyan (`rgb(107, 200, 234)`).
- Migrated the shared buttons, controls, cards, table rows, data links, badges, dialogs,
  alerts, loading indicators, empty states, top bar, and mobile navigation onto the
  Clinical Current token system. Route-level appointment calendar, patient, billing,
  dashboard, pharmacy, and settings controls were aligned with the same system.
- Added a complete light, dark, and system appearance model. The resolved theme is
  applied before hydration, manual choices persist in the browser, system mode follows
  the device preference, and controls are available on authentication screens, the app
  top bar, and Settings.
- Extended the Clinical Current token layer for dark surfaces, raised workspaces,
  borders, text, focus, chart, safety, and status colors. An Axe finding on the original
  dark filled-action cyan was fixed by increasing its contrast against white text.
- Refined the owner dashboard desktop split so the operational appointment table keeps
  its status column visible at 1280 and 1440 px. Database-derived chart bars now include
  visible numeric labels and use theme tokens.
- Migrated patient registration and appointment booking from compatibility-only text
  translation to direct semantic keys for labels, hints, options, validation errors,
  placeholders, and actions.

## Scope and page inventory

The frontend route tree, shared layout, API client and hooks, localization layer,
authentication/session handling, browser tests, and the read-only backend route and
schema contracts were audited before the redesign continued. The audited route groups
were:

- Authentication: login, registration, invitation acceptance, forgot password, and
  password reset.
- Operations: role dashboards, appointments (calendar, list, creation, and detail),
  queue, waitlist, patients (list, registration, and record), encounters,
  prescriptions, orders, and messages.
- Administration: staff, settings, reports, quality, insurance, invoices, and billing.
- Pharmacy: dashboard, medicines, stock and batches, purchases, suppliers,
  prescriptions, dispensing, counts, and reports.

All routes remain connected to their existing API hooks. No backend endpoint, payload,
schema, migration, seed, permission, or database behavior was changed.

## Pages redesigned

- Rebuilt the authenticated application shell around the Clinical Current direction:
  mineral navy navigation, Gulf teal actions, compact operational typography,
  role-specific navigation groups, current-location treatment, accessible mobile
  navigation, and localized session controls.
- Rebuilt the login, registration, and authentication shell with clinic-specific
  assurance content, visible labels, mixed-direction credential handling, clear
  submission states, and restrained clinical styling.
- Refined the role dashboard experiences for Owner, Doctor, Receptionist, Pharmacist,
  Accountant, and other seeded roles. Operational metrics now use a dense metric strip;
  appointment, audit, pharmacy, billing, and action content is role-specific and
  localized.
- Reworked the patient list into an information-dense clinical table with visible
  search labeling, patient-safety allergy warnings, specific empty/search-empty states,
  localized actions, and readable CPR/phone values in both directions.
- Refined appointments, queue, billing, pharmacy dashboard, and pharmacy stock screens
  to share the Clinical Current hierarchy, status language, spacing, and responsive
  behavior. Appointment date/time rendering now follows the active locale.
- On narrow dashboard screens, the desktop appointments table becomes a deliberate
  stacked operational list. Wide clinical data tables retain their columns inside a
  keyboard-focusable horizontal scroll region instead of compressing critical data.

## Shared components and design tokens

- Updated the application shell, page headers, buttons, inputs, cards, badges, tables,
  modals, feedback/loading states, empty states, and the new metric strip.
- Added reusable mineral navy, Gulf teal, clinical neutral, focus, status, border, and
  surface styling in the global token layer. Corners, shadows, and density are varied by
  component purpose rather than applying a generic card treatment everywhere.
- Added a reusable theme provider, compact theme switcher, three-way appearance control,
  pre-hydration theme resolution, persistence tests, and theme-aware chart rendering.
- Added a skip link, visible focus treatment, accessible navigation labels, dialog and
  icon-button names, localized scroll-region labels, and table keyboard access.
- Added locale-aware date, weekday, month, time, currency, and number formatting helpers.
  Directional calendar icons mirror in RTL; universal icons do not.
- The final anti-AI audit found no purple/indigo gradients, glassmorphism, decorative
  blobs, fake charts, oversized operational headings, nested card grids, or decorative
  unsupported metrics in the changed interface. The remaining elevated shadow belongs
  to the floating profile menu.

## English, Arabic, and RTL status

- Runtime switching between English and Arabic is implemented and persisted across
  refreshes. The active language updates the document `lang` and `dir` attributes.
- Light, dark, and system appearance choices work in both languages and directions.
- Navigation, authentication, role dashboards, patients, appointment formatting,
  states, validation, controls, accessible names, audit actions, and workflow labels are
  localized through structured translation keys.
- Legacy workflow screens still use the central compatibility translator while they are
  incrementally migrated to direct `t()` calls. No untranslated visible text was found
  in the tested Arabic journeys.
- Arabic browser validation covered login, navigation, language persistence, the RTL
  sidebar, dashboard, appointment calendar/list, patient form, tables, dialogs, and the
  switch back to English. Mixed phone, email, CPR, and identifier values retain LTR
  readability inside RTL layouts.

## Role-based review

- Owner: clinic oversight, staff lifecycle, invitations, permissions, settings, audit,
  and module visibility.
- Doctor: today's schedule, patient context, queue, appointment management, encounter,
  prescribing, and follow-up.
- Reception: patient registration/search, appointment booking, check-in, queue, and
  invoice handoff.
- Pharmacist: purchases, dated batch receipt, stock, prescriptions, dispensing, and
  immutable label preview.
- Accountant and the remaining seeded roles: distinct permitted navigation and
  dashboard content. Pharmacy navigation is hidden when the clinic module is disabled.

## Responsive and visual inspection

The following viewports were exercised by the browser suite and visually inspected from
captured screenshots:

| Viewport | Modes and workflows inspected | Result |
|---|---|---|
| 1440 x 900 | English/Arabic dashboards, dark dashboard, appointments, staff | Passed |
| 1280 x 800 | English dashboard and dense operational layout | Passed |
| 768 x 1024 | Dashboard and Arabic patient form | Passed |
| 390 x 844 | Dashboard, Arabic patient form, and patient table scrolling | Passed |

The automated page-overflow assertion passed at every required width. The 390 px patient
table keeps a 680 px internal table inside a 364 px scroll container while the page stays
at the 390 px viewport width.

## Commands executed and results

| Command | Result |
|---|---|
| `cd frontend && npm run lint` | Passed |
| `cd frontend && npm run typecheck` | Passed |
| `cd frontend && npm test -- --run` | Passed; 4 files, 7 tests |
| `cd frontend && npm run build` | Passed; 32 static pages generated and all listed routes compiled |
| `cd frontend && PLAYWRIGHT_CHROMIUM_PATH=/home/hashem/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome npx playwright test` | Passed; 6 journeys in 1.0 minute |
| Axe scans in light and dark owner journeys | Passed; no serious or critical findings |
| `docker compose config --quiet` and `docker compose up -d backend frontend` | Passed; database healthy and app/API reachable |

The final E2E run used a clean migrated/seeded browser test database. Iterative Axe
checks exposed secondary text, avatar, warning-status, and filled-action contrast
issues; the tokens were corrected and the final uninterrupted 6/6 run passed both
theme scans.

## Skipped validation

- Backend lint, backend unit tests, and Docker image builds were not rerun because this
  continuation was explicitly frontend-only and no backend or infrastructure file was
  changed. Docker configuration, startup, service health, and frontend/API reachability
  were rerun on 2026-07-30.
- The Axe journey is targeted evidence for the core owner workflow, not a complete WCAG
  2.2, clinical-safety, or legal compliance certification.

## Backend limitations and remaining issues

- Email, SMS, and WhatsApp delivery remain mocked by the backend; development flows
  expose invitation and reset links directly.
- Private documents still use local filesystem storage. Production requires encrypted
  object storage, malware scanning, managed keys, retention, and backup policies.
- Pharmacy workflows remain operational software and do not replace statutory registers
  or jurisdiction-specific professional controls.
- Patient registration and appointment booking now use direct semantic keys. Some
  older secondary routes still use the central compatibility translator and should be
  migrated incrementally; tested Arabic workflows rendered translated UI and correct
  RTL behavior.
- No unsupported frontend action or fake persistence was introduced. Features absent
  from the existing backend remain omitted rather than simulated.
