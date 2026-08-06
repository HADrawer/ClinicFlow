# ClinicFlow design audit

Baseline audit performed before the Claude Design redesign pass. Covers every
frontend route and the shared UI layer as of commit `39ab318`.

**Status: token migration complete** (commit following `8ac69e1`). Every hex
leak and raw-Tailwind-palette usage catalogued below has been replaced with
the corresponding CSS variable. See the end-of-task report in conversation
history for the full file list, the two new `.alert-warning`/`.alert-info`
variants added to `globals.css`, and the remaining design debt that is
intentionally deferred (decorative marketing panel on `(auth)/layout.tsx`,
info-callout boxes left as token-based divs rather than restructured onto
`.alert-info`).

## Existing design system (already in place)

`frontend/app/globals.css` already defines a real, deliberate token system —
this is not a from-scratch redesign:

- CSS custom properties for ink/surface/line/status colors, both
  `:root` (light) and `html[data-theme="dark"]` (dark)
- A "Clinical Current" palette: navy/teal, restrained 3–6px radii, flat
  1px borders, minimal shadow — already avoids gradients, glassmorphism,
  neon, oversized pill buttons, and decorative charts
- RTL logical-property support (`inset-inline-*`, `[dir="rtl"]` overrides)
- Focus-visible ring, `prefers-reduced-motion`, print stylesheet
- Shared primitives: `Button`, `Card`/`CardHeader`, `Modal`, `DataTable`,
  `EmptyState`, `Badge`, `PageHeader`, `MetricStrip`, `ErrorMessage`/`Loading`,
  `SearchCombobox`, date/time pickers — all token-driven, no hex leakage

**Conclusion: the direction is sound.** The work needed is not "make it look
premium" from zero — it's completing a token migration that was left
half-finished, and unifying a few duplicated patterns.

## Cross-cutting design debt (highest priority)

1. **Two off-token palettes leak through raw Tailwind arbitrary-value hex
   classes** instead of the CSS variables already defined for exactly this
   purpose:
   - Custom hex set duplicating tokens: `#52656e`≈`--ink-500`,
     `#d6e1de`/`#e3ebe9`≈`--line`, `#b74242`≈`--danger`, `#9a6417`≈`--warning`,
     `#0f625f`/`#167d78`≈`--gulf-teal`/`--link`, `#10212b`/`#12305a`/`#163c52`≈
     `--ink-950`/`--clinical-navy`. Found in: `dashboard/page.tsx`,
     `encounters/[id]`, `quality`, `queue`, `reports`, `visit-form.tsx`, all
     5 auth pages, most of `pharmacy/*`, `billing`/`insurance` list pages.
   - Raw default-Tailwind palette (`slate-500/700/900`, `blue-800`,
     `red-200/700`) with **no token mapping at all**: `prescriptions/[id]`
     (print), `prescription-form.tsx`, `billing/invoices/[id]`,
     `insurance/claims/[id]`. These will not respond to dark mode or RTL.
   - Fully clean reference pages (copy their pattern, don't reinvent):
     `patients/page.tsx`, `appointments/page.tsx`, `patient-form.tsx`,
     `appointment-form.tsx`, `pharmacy/page.tsx`, `pharmacy/suppliers/page.tsx`,
     `search-combobox.tsx`, `badge.tsx`, `data-table.tsx`, `modal.tsx`.
2. **Duplicated component patterns** doing the same job differently:
   - KPI rows: `MetricStrip` (tokenized, reusable) vs. ad-hoc `<dl>` grids in
     `reports/page.tsx` and the accountant branch of `dashboard/page.tsx`.
   - Empty states: `DataTable` correctly delegates to `EmptyState`, but
     `encounters/[id]`, `quality/page.tsx`, and `appointment-form.tsx`'s
     `NoProvider` hand-roll their own "No X" text instead of reusing it.
   - Buttons: `billing/invoices/[id]`'s "Create claim" link bypasses
     `Button`/`.button-base` with a one-off class string.
   - Dividers: `border-[#d6e1de]` repeated verbatim 5+ times across
     `pharmacy/medicines`, `pharmacy/stock`, `pharmacy/purchases` (×2),
     dispensing forms, instead of one `border-[var(--line)]` utility.
   - Status color drift: stock/medicines/prescriptions pages hardcode
     `#b74242`/`#9a6417` text next to a `Badge` using `status-danger`/
     `status-warning` — the two can go out of sync since they're not the
     same source of truth.
3. **Selected-patient context** is correctly wired in `patients`,
   `appointments`, and `appointment-form` (prefills, `selectPatient` on
   save/view). It is plausibly missing from `encounters/[id]` and `queue`,
   which are patient-adjacent but never call `useSelectedPatient`.
   `pharmacy/dispensing`, billing/insurance detail, and prescriptions print
   are keyed by their own record id, not a patient — correctly out of scope.

## Full route inventory

Legend: L=loading, E=empty, Er=error, SP=selected-patient reference.

| Route | Purpose | User type | L | E | Er | SP | Flags |
|---|---|---|---|---|---|---|---|
| `/dashboard` | Role-based operational home | all | Y | partial | Y | correctly none | Heavy hex; pharmacy tiles are a different component era from the rest of the same page |
| `/patients` | Directory, search, register, select | owner/doctor/reception/nurse | Y | Y | Y | Y (source of truth) | Clean — reference page |
| `/patients/new` | Register patient | same | delegates | — | — | — | Thin wrapper, fine |
| `/patients/[id]` | Patient record (tabs: timeline/appts/rx/orders/billing/messages/docs) | same | Y | mixed | Y | Y (syncs on load, this session) | Deeply nested tab content; some inline `any[]` typing |
| `/appointments` | Day/week/month/list calendar + booking | owner/doctor/reception/nurse | Y | Y | Y | Y | Clean, no hex |
| `/appointments/new` | Book appointment | same | Y | — | — | via form | Fine |
| `/appointments/[id]` | Appointment detail + workflow actions | same | Y | — | Y | Y (syncs on load, this session) | Fine |
| `/encounters/[id]` | SOAP encounter + amendments | doctor/owner | Y | ad-hoc | Y | **missing** | Hex-heavy; different era than patients/appointments |
| `/prescriptions/[id]` | Printable prescription | doctor/owner | Y | n/a | Y | not needed | Worst offender — raw Tailwind slate/blue, no tokens (print-only, partially defensible) |
| `/quality` | Complaints & incidents | owner/reception/nurse | Y | ad-hoc | Y | n/a | Hex-heavy |
| `/queue` | Live arrivals/wait queue | owner/doctor/reception/nurse | Y | Y (DataTable) | Y | **missing** | Hex-heavy; queue rows could jump into patient context |
| `/reports` | Role-based ops/financial reports | owner/accountant/pharmacist | Y | none | Y | n/a | Ad-hoc `<dl>` instead of `MetricStrip` |
| `/billing` | Invoice ledger | owner/reception/accountant | Y | Y | Y | n/a | Clean |
| `/billing/invoices` | Redirect → `/billing` | — | — | — | — | — | Stub |
| `/billing/invoices/[id]` | Printable invoice + claim creation | same | Y | none | Y | n/a | Raw Tailwind slate/blue; ad-hoc button |
| `/billing/new` | Create invoice | same | Y | — | delegates | Y (via `InvoiceForm`) | Fine |
| `/insurance` | Claims list | owner/accountant | Y | Y | Y | n/a | Raw Tailwind blue link color |
| `/insurance/claims/[id]` | Claim detail + status workflow | same | Y | none | Y | n/a | Raw Tailwind red banner instead of `status-danger` |
| `/pharmacy` | Pharmacy KPI hub | owner/pharmacist | Y | — | — | n/a | Clean — reference page |
| `/pharmacy/medicines` | Catalog CRUD | same | Y | Y | Y | n/a | Some hex |
| `/pharmacy/medicines/[id]` | Redirect stub | — | — | — | — | — | Stub |
| `/pharmacy/stock` | Batch stock + adjustments | same | Y | Y | Y | n/a | Hex; status-color drift from `Badge` |
| `/pharmacy/counts` | Redirect → `/pharmacy/stock` | — | — | — | — | — | Stub |
| `/pharmacy/suppliers` | Supplier CRUD | same | Y | Y | Y | n/a | Clean |
| `/pharmacy/purchases` | Purchase orders | same | Y | Y | Y | n/a | Hex; reinvented info callout |
| `/pharmacy/purchases/[id]` | Redirect stub | — | — | — | — | — | Stub |
| `/pharmacy/dispensing/[id]` | Safety-critical dispense workflow | pharmacist | Y | — | Y | n/a (keyed by rx) | Most hex-heavy page in the app (16 arbitrary hex classes) |
| `/pharmacy/prescriptions` | Dispensing queue | pharmacist | Y | Y (DataTable) | Y | n/a | Some hex |
| `/pharmacy/reports` | Redirect → `/reports` | — | — | — | — | — | Stub |
| `/staff` | Team + invitations | owner | Y | Y | Y | n/a | Already redesigned this session (permission editor) |
| `/staff/[id]` | Staff detail + permission editing | owner | Y | Y | Y | n/a | Already redesigned this session |
| `/settings` | Clinic profile, services, access, templates, insurance, audit | owner | Y | mixed | Y | n/a | Already extended this session (onboarding reopen) |
| `/onboarding` | Post-signup setup wizard | owner | Y | Y | Y | n/a | Built this session; needs the visual pass in Phase 7 |
| `/messages` | Mock WhatsApp message log | owner/doctor/reception | Y | — | Y | Y (prefill, this session) | Fine |
| `/orders` | Lab/imaging orders | owner/doctor/nurse | Y | — | Y | Y (prefill, this session) | Fine |
| `/waitlist` | Appointment waitlist | owner/doctor/reception | Y | Y | Y | Y (prefill, this session) | Fine |
| `/login`, `/register`, `/forgot-password`, `/reset-password`, `/invite/[token]` | Auth | unauthenticated | Y (most) | n/a | Y | n/a | All 5 share the same off-token hex palette, near-duplicate of the real tokens |
| `/` | Redirect → `/dashboard` | — | — | — | — | — | Trivial |

## Shared UI/shell audit

- **App shell** (`components/layout/app-shell.tsx`): fixed topbar + collapsible
  sidebar + mobile drawer, quick-create menu, profile menu — token-driven,
  responsive breakpoints in `globals.css`. No duplicated navigation found.
  Single clinic per user (no clinic switcher exists in the product yet — see
  design debt below).
- **Patient sidebar** (`components/layout/patient-context.tsx` +
  `.patient-context`/`.patient-chip` CSS): desktop rail (≥1024px, fixed
  320px, pushes content via `.app-main--patient`) collapses to a bottom
  drawer + floating chip on mobile. Already reasonably compact (facts grid,
  not a huge banner). Returns `null` when nothing selected — clean empty
  state.
- **Forms/dialogs/tables/badges/pickers**: consistent primitives exist and
  are used correctly on ~60% of routes; the redesign work is applying them
  to the other ~40% (see hex-leak list above), not inventing new ones.
- **Permission editor** (`components/staff/permission-editor.tsx`, built this
  session): grouped checkboxes, shared across onboarding/invite/staff-detail
  already. Phase 8 additions still needed: selected count, unsaved-change
  indicator, search (only matters once the catalog grows), group-level
  select-all.

## Design debt not caused by tokens

- No clinic-switching UI exists in the product (single clinic per user by
  design — see `[[patient-context-design]]` memory). Phase 5's "fast clinic
  switching" requirement doesn't apply to the current backend model; flagging
  so the design direction doesn't invent a control the API can't back.
- Dashboard "Quick Actions" already excludes "New Doctor" (verified earlier
  this session) — Phase 6 constraint already satisfied, no action needed.
- Onboarding wizard (Phase 7) exists functionally but has not had a visual
  pass — plain `Card` steps, no progress-step icons/animation, no inline
  validation styling beyond the shared `ErrorMessage`.
