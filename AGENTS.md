# AGENTS.md

## Mission

Redesign and improve the ClinicFlow frontend only.

The goal is to produce a complete, distinctive, production-quality clinic management interface that:

- Does not look AI-generated.
- Matches the real ClinicFlow workflows.
- Supports both Arabic and English.
- Works correctly in RTL and LTR modes.
- Remains consistent with the existing backend and API.
- Preserves all currently working functionality.
- Is usable on desktop, tablet, and mobile.

This task is a frontend design and frontend implementation task only.

---

## Strict Scope

You may modify only frontend-related files, including:

- Frontend pages.
- Frontend routes.
- React components.
- Layouts.
- Navigation.
- Styles.
- Design tokens.
- Icons.
- Client-side validation.
- Frontend API integration.
- Frontend localization files.
- Frontend tests.
- Playwright tests related to the interface.
- Frontend documentation.

You may read backend files to understand:

- Available API endpoints.
- Request and response schemas.
- Authentication behavior.
- User roles.
- Permissions.
- Existing system features.
- Error response formats.
- Supported workflows.

You must not modify:

- Backend Python code.
- FastAPI routes.
- SQLAlchemy models.
- Pydantic schemas.
- Alembic migrations.
- Database schema.
- Database seed logic.
- Authentication implementation.
- Backend permission logic.
- Docker backend configuration.
- Backend tests.
- Infrastructure unrelated to the frontend.

Do not create new backend endpoints.

Do not modify the API contract.

Do not modify the database.

If a required frontend feature is not supported by the existing backend, do not implement fake behavior. Record it as a limitation in `UI_REDESIGN_REPORT.md`.

---

## Source of Truth

Before changing the frontend, read:

1. `ClinicFlow_System_Expansion_Spec.md`
2. Existing frontend README files.
3. Existing architecture documentation.
4. Existing frontend routes and layouts.
5. Existing frontend components.
6. Existing API client code.
7. Existing localization or translation implementation.
8. Existing authentication and session usage in the frontend.
9. Existing backend routes and schemas, read-only.
10. Existing frontend and browser tests.
11. All relevant skills under `.agents/skills`.

The system specification and the existing backend define which features are real.

Do not invent unsupported features.

Do not remove existing working features because they do not fit the new design.

---

## Required Skills

Use the following skills when relevant:

- `$clinicflow-ui-design`
- `$avoid-ai-design`
- `$frontend-design`
- `$frontend-design-review`
- `$frontend-ui-engineering`
- `$ui-ux-pro-max`
- `$clinicflow-webapp-validation`

Use `$clinicflow-ui-design` as the main product-specific design direction.

Use the other design skills to audit and improve:

- Visual hierarchy.
- Typography.
- Spacing.
- Layout.
- Accessibility.
- Responsiveness.
- Interaction design.
- RTL behavior.
- Design consistency.
- Removal of generic AI-generated design patterns.

Do not blindly combine every recommendation.

When skills conflict, prioritize:

1. ClinicFlow requirements.
2. Existing system functionality.
3. Accessibility and usability.
4. `$clinicflow-ui-design`.
5. Existing frontend architecture.
6. General design recommendations.

---

## Frontend-Only Repository Audit

Before editing:

1. Inspect the complete frontend structure.
2. Identify all pages and routes.
3. Identify shared layouts.
4. Identify all reusable components.
5. Identify the current design tokens.
6. Identify styling libraries and component libraries.
7. Identify role-based navigation.
8. Identify all API calls used by each page.
9. Identify missing loading, empty, error, success, and permission states.
10. Identify pages that use mock data.
11. Identify fake or nonfunctional controls.
12. Identify English-only hardcoded strings.
13. Identify RTL layout problems.
14. Identify inconsistent visual patterns.
15. Identify default component-library styling.
16. Identify screens that look like generic AI-generated dashboards.

Create a frontend page inventory before broad redesign work.

Do not start by randomly restyling individual components.

---

## Design Direction

Use `$clinicflow-ui-design`.

The design direction is:

# Clinical Current

The interface must feel:

- Calm.
- Precise.
- Trustworthy.
- Professional.
- Operational.
- Clinically appropriate.
- Modern without appearing trendy.
- Efficient for repeated daily use.
- Clearly designed for ClinicFlow.

Use:

- Mineral navy.
- Gulf teal.
- Restrained clinical neutrals.
- Clear status colors.
- Compact professional typography.
- Strong patient-safety hierarchy.
- Information-dense desktop layouts.
- Clear tables.
- Strong scheduling and calendar interfaces.
- Structured forms.
- Consistent toolbars.
- Restrained borders and shadows.

All visual values must come from reusable design tokens where practical.

---

## Anti-AI Design Rules

The redesigned interface must not look like a generic AI-generated SaaS template.

Do not use:

- Purple or violet gradients.
- Indigo gradients as a default.
- Gradient text.
- Glassmorphism.
- Excessive blur.
- Glowing cards.
- Decorative floating blobs.
- Random background grids.
- Oversized hero sections.
- Giant headings on operational pages.
- Excessive cards.
- Cards inside cards.
- A card grid for every page.
- Large decorative statistic cards.
- Excessive rounded corners.
- Excessive pill-shaped buttons.
- The same corner radius for every component.
- Excessive shadows.
- Excessive empty space.
- Generic startup illustrations.
- Emoji as UI icons.
- Fake charts.
- Placeholder analytics.
- Decorative metrics unsupported by the backend.
- Generic dashboard text.
- Default shadcn or component-library styling.
- Animations on every component.
- Hover effects on non-interactive elements.
- Buttons that do not work.
- Filters that are not connected to real data.
- Controls unsupported by the backend.

Do not use generic text such as:

- Welcome back.
- Everything you need in one place.
- Unlock your potential.
- Manage everything easily.
- Your all-in-one solution.

Use ClinicFlow-specific and workflow-specific content.

---

## Layout Rules

Do not place every section inside a card.

Choose components according to the workflow.

Use:

- Tables for structured operational data.
- Calendars for appointments.
- Lists for compact scanning.
- Split layouts for list and detail workflows.
- Drawers for contextual editing.
- Dialogs for focused confirmation.
- Dedicated pages for complex workflows.
- Toolbars for filters and actions.
- Dividers for simple visual grouping.
- Inline actions for frequent tasks.
- Tabs only when content is closely related.

Desktop screens must use horizontal space effectively.

Do not make desktop pages look like enlarged mobile layouts.

Keep filters close to the content they affect.

Keep frequent actions visible.

Do not hide important actions inside overflow menus merely to make the screen look cleaner.

---

## Role-Based Interface

The interface must adapt meaningfully to the logged-in role.

Do not use the same dashboard for every role with only different navigation links.

### Owner

Prioritize:

- Clinic overview.
- Staff management.
- Doctors.
- Invitations.
- Account statuses.
- Permissions.
- Clinic settings.
- Enabled modules.
- Operational oversight.

### Doctor

Prioritize:

- Today's schedule.
- Upcoming appointments.
- Patient context.
- Doctor-specific calendar.
- Appointment management supported by the backend.
- Relevant clinical workflows.

### Reception

Prioritize:

- Appointment creation.
- Daily calendar.
- Patient search.
- Patient registration.
- Check-in.
- Rescheduling.
- Cancellation.
- Appointment statuses.

### Pharmacist

Prioritize:

- Dispensing.
- Inventory.
- Medication batches.
- Expiry dates.
- Purchases.
- Low stock.
- Stock audit.

Do not show a feature to a role when the existing backend does not permit it.

The frontend may hide or disable unavailable actions, but backend behavior remains the final authority.

---

## Arabic and English Support

The entire interface must support:

- English.
- Arabic.
- LTR layout.
- RTL layout.
- Runtime language switching.
- Language persistence after refresh.
- Localized navigation.
- Localized forms.
- Localized tables.
- Localized dialogs.
- Localized validation messages.
- Localized loading states.
- Localized empty states.
- Localized error messages.
- Localized success messages.
- Localized accessibility labels.
- Localized date and time display.
- Localized number display where appropriate.

Do not leave visible hardcoded English strings in redesigned pages.

Do not leave visible hardcoded Arabic strings outside the translation system.

Use structured translation keys.

Example structure:

```text
navigation.appointments
appointments.create
appointments.status.confirmed
patients.empty.title
patients.empty.description
common.save
common.cancel
common.loading
errors.permissionDenied
```

Avoid using complete English sentences as translation keys.

---

## RTL Requirements

Arabic mode must use true RTL behavior.

When Arabic is active:

- Set the document direction to `rtl`.
- Use RTL-aware layout primitives.
- Reverse directional navigation patterns when appropriate.
- Align Arabic content correctly.
- Adjust sidebar placement when appropriate.
- Mirror directional icons where their meaning is directional.
- Do not mirror universal icons unnecessarily.
- Ensure dropdowns and popovers open correctly.
- Ensure dialogs and drawers work correctly.
- Ensure tables remain readable.
- Ensure forms preserve logical field order.
- Ensure breadcrumbs render correctly.
- Ensure pagination controls are understandable.
- Ensure calendar navigation is correct.
- Ensure mixed Arabic and English text remains readable.
- Ensure numbers, email addresses, IDs, and phone numbers display correctly.
- Ensure icons do not overlap labels.
- Ensure text truncation works in both directions.

Do not implement Arabic by only translating text.

RTL layout must be inspected visually.

---

## Typography

Select typography that supports both Arabic and English well.

The font system must:

- Render Arabic clearly.
- Render English professionally.
- Support multiple readable weights.
- Maintain similar visual density across both languages.
- Avoid layout jumps when switching languages.
- Avoid oversized headings.
- Remain readable in dense tables and forms.

Define consistent styles for:

- Page titles.
- Section titles.
- Body text.
- Labels.
- Supporting text.
- Table headers.
- Table cells.
- Numeric values.
- Status text.
- Buttons.
- Navigation.

Test long Arabic and English labels.

Test mixed-language content.

---

## Navigation

Navigation must:

- Reflect the logged-in role.
- Use translated labels.
- Support RTL and LTR.
- Clearly show the current location.
- Avoid unnecessary nesting.
- Keep frequent destinations easy to reach.
- Hide unsupported modules.
- Handle collapsed and expanded states.
- Work on desktop and mobile.
- Preserve accessibility.
- Avoid using icons without labels unless the meaning is unambiguous.

Do not add navigation items that lead to incomplete or unsupported pages.

---

## Forms

All forms must support both languages.

Forms must include:

- Visible labels.
- Required field indicators.
- Client-side validation.
- Existing server validation display.
- Localized field errors.
- Localized form-level errors.
- Loading state.
- Submitting state.
- Disabled state.
- Success feedback.
- Preservation of input after recoverable errors.
- Keyboard support.
- Accessible names.
- Correct RTL alignment.
- Protection against duplicate submission.

Do not rely on placeholders as labels.

Do not change backend validation rules.

Map backend errors to understandable localized frontend messages when possible.

---

## Tables

Tables are important in ClinicFlow.

Use tables for:

- Patients.
- Appointments.
- Staff.
- Invitations.
- Inventory.
- Medication batches.
- Purchases.
- Dispensing history.
- Audit records.
- Payments when present.

Tables must support the existing workflow with:

- Localized headers.
- Search.
- Filters.
- Sorting where supported.
- Pagination where supported.
- Row actions.
- Loading state.
- Empty state.
- Error state.
- Responsive behavior.
- Clear statuses.
- Proper numeric alignment.
- Proper date formatting.
- RTL support.
- Keyboard accessibility.

Do not turn desktop tables into large card grids.

On smaller screens, use deliberate adaptations such as:

- Priority columns.
- Horizontal scrolling.
- Expandable rows.
- Stacked data.
- Mobile detail views.

Do not silently hide critical information.

---

## Appointment Calendar

The appointment calendar must:

- Match the existing backend capabilities.
- Support available views.
- Support role-based access.
- Use localized dates and times.
- Work in Arabic and English.
- Work in RTL and LTR.
- Show appointment status clearly.
- Show doctor and patient context.
- Provide clear creation and editing actions.
- Display loading and error states.
- Display conflict errors returned by the backend.
- Remain usable on smaller screens.

Do not add drag-and-drop rescheduling unless it already works through the existing backend.

Do not use color as the only indicator of appointment status.

---

## Pharmacy UI

The pharmacy interface must only appear when supported and enabled for the clinic.

Use the existing backend as the source of truth.

Design the frontend for supported workflows such as:

- Inventory.
- Medication items.
- Batches.
- Expiry.
- Purchases.
- Receipts.
- Dispensing.
- Low stock.
- Stock audit.

Do not implement local-only stock behavior.

Do not simulate purchases or dispensing in frontend state.

Display backend errors clearly, including:

- Insufficient stock.
- Expired batch.
- Invalid quantity.
- Permission denied.
- Record not found.
- Conflicting operation.

Pharmacy warnings must remain visible in both languages.

---

## UI States

Every data-driven page must include:

- Initial loading state.
- Refresh state.
- Empty state.
- Search-empty state.
- Filter-empty state.
- Error state.
- Permission-denied state.
- Disabled state.
- Success state.
- Retry action where useful.

Each empty state must be specific to the workflow.

Do not reuse the same generic empty-state text everywhere.

All states must be translated.

---

## Accessibility

Target WCAG 2.2 AA-compatible frontend behavior where practical.

At minimum:

- Use semantic HTML.
- Maintain sufficient contrast.
- Provide visible keyboard focus.
- Support keyboard navigation.
- Associate labels with inputs.
- Add accessible names to icon-only buttons.
- Manage focus in dialogs and drawers.
- Do not communicate meaning only through color.
- Respect reduced-motion preferences.
- Maintain logical heading order.
- Provide understandable validation errors.
- Ensure touch targets are usable.
- Test accessibility in Arabic and English.

Do not reduce accessibility for visual appearance.

---

## Responsive Design

Test redesigned pages at:

- Large desktop.
- Standard laptop.
- Tablet.
- Mobile.

For every size:

- Preserve task priority.
- Keep primary actions accessible.
- Avoid overlap.
- Avoid clipped labels.
- Avoid unreachable controls.
- Avoid unnecessary horizontal scrolling.
- Preserve critical information.
- Adapt navigation correctly.
- Test Arabic and English.
- Test RTL and LTR.
- Test tables.
- Test forms.
- Test calendars.
- Test dialogs.
- Test drawers.

Inspect screenshots and iterate.

Do not assume CSS responsiveness is correct without visual inspection.

---

## Motion

Use motion only to communicate:

- State change.
- Progress.
- Contextual reveal.
- Success.
- Failure.
- Spatial relationship.

Do not use:

- Continuous floating animations.
- Large hover scaling.
- Excessive entrance animations.
- Staggered animation across every page element.
- Animation that delays interaction.
- Animation that ignores reduced-motion settings.

---

## API Integration

Preserve the current API contract.

Before displaying or changing data:

1. Identify the existing endpoint.
2. Identify the request schema.
3. Identify the response schema.
4. Identify required permissions.
5. Identify possible errors.
6. Implement loading behavior.
7. Implement success behavior.
8. Implement localized error behavior.

Do not:

- Add fake data to production workflows.
- Pretend local state was saved.
- Create fake endpoints.
- Change endpoint paths.
- Change backend payloads.
- Suppress backend errors.
- Show success before the server confirms it.

If the API does not support an action, omit the action or document the limitation.

---

## Component System

Reuse and improve existing components before creating duplicates.

Create or refine shared frontend primitives for:

- Buttons.
- Inputs.
- Selects.
- Checkboxes.
- Radio groups.
- Date pickers.
- Status badges.
- Alerts.
- Dialogs.
- Drawers.
- Tables.
- Pagination.
- Empty states.
- Loading states.
- Page headers.
- Toolbars.
- Filters.
- Language switcher.
- Role navigation.

Restyle component-library defaults so the product has a distinctive identity.

Do not over-abstract small one-time components.

Do not create multiple visually inconsistent versions of the same control.

---

## Validation

Use `$clinicflow-webapp-validation`.

Run actual relevant frontend commands:

- Type checking.
- Linting.
- Frontend unit tests.
- Component tests.
- Production build.
- Playwright E2E.
- Accessibility tests where available.

Do not modify the backend to make frontend tests pass.

For browser validation, test:

- English login and navigation.
- Arabic login and navigation.
- Switching from English to Arabic.
- Switching from Arabic to English.
- Language persistence after refresh.
- RTL sidebar and navigation.
- RTL forms.
- RTL tables.
- RTL dialogs and drawers.
- Role-specific navigation.
- Owner workflow.
- Doctor workflow.
- Reception workflow.
- Pharmacy workflow when available.
- Loading states.
- Empty states.
- Error states.
- Permission-denied states.
- Desktop.
- Tablet.
- Mobile.

Test every available seeded role when credentials exist.

Never invent passing results.

---

## Visual Review

Use `$frontend-design-review` and `$avoid-ai-design` after implementation.

Review every changed page for:

- Generic AI styling.
- Excessive cards.
- Excessive pills.
- Excessive rounding.
- Poor hierarchy.
- Default component-library styling.
- Unnecessary gradients.
- Inconsistent spacing.
- Unclear primary actions.
- Weak desktop data density.
- English-only strings.
- Broken RTL.
- Inconsistent typography.
- Unsupported controls.
- Fake data.
- Incomplete UI states.
- Mobile layout issues.
- Accessibility issues.

Repeat the review after fixing problems.

---

## UI_REDESIGN_REPORT.md

Create or update `UI_REDESIGN_REPORT.md`.

Include:

- Pages redesigned.
- Shared components updated.
- Design tokens added or changed.
- English support status.
- Arabic support status.
- RTL support status.
- Role-based pages reviewed.
- Responsive sizes tested.
- Browser workflows tested.
- Commands executed.
- Tests passed.
- Tests failed.
- Tests skipped.
- Accessibility results.
- Backend limitations found.
- Unsupported frontend actions removed or documented.
- Remaining visual issues.
- Remaining localization issues.
- Remaining RTL issues.

Never claim a test passed unless it was actually executed.

---

## Completion Criteria

The redesign is complete only when:

- Existing frontend workflows remain functional.
- No backend or database files were modified.
- English is supported.
- Arabic is supported.
- RTL and LTR work correctly.
- Visible strings use the translation system.
- Role-based navigation is accurate.
- Pages match the Clinical Current direction.
- Generic AI design patterns are removed.
- Component-library defaults are restyled.
- Loading, empty, error, permission, and success states exist.
- Desktop, tablet, and mobile layouts are inspected.
- Relevant frontend tests are executed.
- Production build succeeds, or failures are documented truthfully.
- `UI_REDESIGN_REPORT.md` is updated.

Visual appearance alone is not completion.

---

## Final Anti-AI Audit

Before finishing, ask:

- Could this interface belong to any unrelated SaaS product?
- Does the interface visibly belong to a clinic management system?
- Are there too many cards?
- Are there too many pills?
- Are corner radii overused?
- Are headings unnecessarily large?
- Is the desktop interface sufficiently information-dense?
- Are tables used for structured data?
- Are workflows more important than decoration?
- Are primary actions easy to find?
- Does every visible control work?
- Is every visible control supported by the existing backend?
- Are all strings translated?
- Does Arabic mode use real RTL behavior?
- Are mixed Arabic and English values readable?
- Are component-library defaults visibly customized?
- Do all roles receive an appropriate interface?
- Are mobile layouts intentionally designed?
- Are loading, empty, error, and permission states complete?

If the design could easily belong to an unrelated product, revise it.

---

## Final Response

Return only four numbered lines:

1. Pages and components redesigned.
2. Arabic, English, RTL, and responsive work completed.
3. Actual frontend test and build results.
4. Remaining limitations or backend features that prevented frontend completion.