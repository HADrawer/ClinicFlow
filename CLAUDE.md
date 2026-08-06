# ClinicFlow

## Architecture

ClinicFlow is a multi-tenant clinic-management SaaS.

- Frontend: Next.js App Router, React, TypeScript, Tailwind CSS in `frontend/`
- Backend: FastAPI, SQLAlchemy, Pydantic and Alembic in `backend/`
- Database: PostgreSQL on Neon
- Deployment: frontend and backend are separate Vercel projects
- Authentication: JWT
- Authorization: roles plus granular permissions
- Every database operation must remain clinic-scoped

## Engineering rules

- Preserve existing working functionality.
- Inspect existing patterns before adding new abstractions.
- Do not rewrite unrelated modules.
- Use additive Alembic migrations.
- Never use `Base.metadata.create_all()` for production.
- Never store or log plaintext invitation tokens.
- Never hardcode secrets.
- Enforce permissions and tenant isolation on the backend.
- Do not claim tests passed unless they were actually run.
- Do not read generated or dependency directories unless necessary:
  `.next`, `node_modules`, `.venv`, `__pycache__`, build outputs.
- Keep final implementation summaries concise.

## Current invitation implementation

The existing invitation lifecycle already supports:

- Secure random invitation tokens
- Token hashing
- Expiration
- Revocation
- Validation
- Acceptance
- Audit logging
- Create, resend, validate and accept endpoints

Important existing files:

- `backend/app/routers/staff.py`
- `backend/app/models.py`
- `backend/app/schemas.py`
- `backend/app/security.py`
- `backend/tests/test_expansion_flows.py`
- `frontend/app/(auth)/invite/[token]/page.tsx`
- `frontend/app/(protected)/staff/page.tsx`
- `frontend/e2e/clinicflow.spec.ts`

Do not replace the existing invitation lifecycle. Extend it.

## Remaining task

Complete the Resend integration for staff invitations.

Missing pieces:

- Resend dependency and provider
- Environment configuration
- HTML and plain-text email templates
- APP_BASE_URL invitation-link generation
- Email delivery-status persistence
- Sending email on create and resend
- Production configuration failure handling
- Removing production dependence on `demo_token`
- Mocked email-delivery tests
