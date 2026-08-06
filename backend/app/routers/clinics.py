from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from ..dependencies import CurrentUser, Db, permission, roles
from ..models import Clinic, Role
from ..quick_create import QUICK_CREATE_ACTIONS
from ..schemas import ClinicOut

router = APIRouter(prefix="/clinics", tags=["Clinic"])
DEFAULT_HOURS = {
    "sunday": "08:00–20:00",
    "monday": "08:00–20:00",
    "tuesday": "08:00–20:00",
    "wednesday": "08:00–20:00",
    "thursday": "08:00–18:00",
    "friday": "Closed",
    "saturday": "09:00–14:00",
}


class ClinicUpdate(BaseModel):
    name: str
    address: str
    phone: str
    contact_email: str | None = None
    timezone: str = "Asia/Bahrain"
    logo_url: str | None = None
    working_hours: dict
    pharmacy_enabled: bool = False
    feature_flags: dict = {}


@router.get("/me", response_model=ClinicOut)
def get_clinic(user: CurrentUser):
    return user.clinic


@router.put("/me", response_model=ClinicOut)
def update_clinic(data: ClinicUpdate, db: Db, user=Depends(roles(Role.owner))):
    clinic = db.get(Clinic, user.clinic_id)
    for key, value in data.model_dump().items():
        setattr(clinic, key, value)
    db.commit()
    db.refresh(clinic)
    return clinic


@router.post("/me/onboarding/complete", response_model=ClinicOut)
def complete_onboarding(db: Db, user=Depends(roles(Role.owner))):
    clinic = db.get(Clinic, user.clinic_id)
    clinic.onboarding_completed = True
    db.commit()
    db.refresh(clinic)
    return clinic


@router.post("/me/onboarding/reopen", response_model=ClinicOut)
def reopen_onboarding(db: Db, user=Depends(roles(Role.owner))):
    clinic = db.get(Clinic, user.clinic_id)
    clinic.onboarding_completed = False
    db.commit()
    db.refresh(clinic)
    return clinic


@router.get("/me/quick-create-catalog", response_model=dict)
def quick_create_catalog(user=Depends(permission("settings.manage"))):
    return QUICK_CREATE_ACTIONS


class QuickCreateConfigUpdate(BaseModel):
    actions: list[str]


@router.put("/me/quick-create-config", response_model=ClinicOut)
def update_quick_create_config(
    data: QuickCreateConfigUpdate, db: Db, user=Depends(permission("settings.manage"))
):
    invalid = set(data.actions) - set(QUICK_CREATE_ACTIONS)
    if invalid:
        raise HTTPException(
            422, f"Unknown quick-create actions: {', '.join(sorted(invalid))}"
        )
    seen: set[str] = set()
    ordered: list[str] = []
    for action in data.actions:
        if action not in seen:
            seen.add(action)
            ordered.append(action)
    clinic = db.get(Clinic, user.clinic_id)
    clinic.quick_create_actions = ordered
    db.commit()
    db.refresh(clinic)
    return clinic
