from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .routers import (
    analytics,
    appointments,
    audit_logs,
    auth,
    billing,
    clinics,
    clinical,
    doctors,
    documents,
    insurance,
    messages,
    patients,
    pharmacy,
    prescriptions,
    quality,
    settings as settings_router,
    staff,
    users,
    visits,
)

app = FastAPI(
    title=settings.app_name,
    version="1.0.0",
    description="Multi-tenant clinic operations API for Bahrain and the GCC",
    docs_url="/docs",
    openapi_url="/api/openapi.json",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_list,
    allow_credentials=True,
    allow_methods=[
        "GET",
        "POST",
        "PUT",
        "PATCH",
        "DELETE",
        "OPTIONS",
    ],
    allow_headers=[
        "Authorization",
        "Content-Type",
        "Accept",
    ],
)

routers = [
    auth.router,
    clinics.router,
    staff.router,
    users.router,
    doctors.router,
    patients.router,
    clinical.router,
    documents.router,
    appointments.router,
    visits.router,
    prescriptions.router,
    pharmacy.router,
    quality.router,
    billing.router,
    insurance.router,
    messages.router,
    analytics.router,
    settings_router.router,
    audit_logs.router,
]

for router in routers:
    app.include_router(router, prefix="/api")


@app.get("/", include_in_schema=False)
def root():
    return {
        "service": "clinicflow-api",
        "status": "running",
        "health": "/health",
        "docs": "/docs",
    }


@app.get("/health", tags=["System"])
def health():
    return {
        "status": "ok",
        "service": "clinicflow-api",
    }