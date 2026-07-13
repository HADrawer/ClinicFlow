from fastapi import APIRouter, Depends
from pydantic import BaseModel
from ..dependencies import CurrentUser, Db, roles
from ..models import Clinic, Role
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
