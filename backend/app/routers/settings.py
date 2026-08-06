from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func, select
from ..dependencies import CurrentUser, Db, permission
from ..message_variables import MESSAGE_TEMPLATE_VARIABLES, unsupported_variables
from ..models import Appointment, InsuranceClaim, InsuranceCompany, MessageTemplate, Service, WaitlistEntry
from ..schemas import CompanyOut, ServiceCreate, ServiceOut, TemplateOut

router = APIRouter(prefix="/settings", tags=["Settings"])
manage = permission("settings.manage")


class CompanyIn(BaseModel):
    name: str
    active: bool = True


class TemplateCreate(BaseModel):
    name: str
    kind: str
    language: str
    body: str


@router.get("", response_model=dict)
def settings(db: Db, user: CurrentUser):
    return {
        "services": [
            ServiceOut.model_validate(x).model_dump(mode="json")
            for x in db.scalars(
                select(Service).where(Service.clinic_id == user.clinic_id)
            ).all()
        ],
        "insurance_companies": [
            CompanyOut.model_validate(x).model_dump()
            for x in db.scalars(
                select(InsuranceCompany).where(
                    InsuranceCompany.clinic_id == user.clinic_id
                )
            ).all()
        ],
        "message_templates": [
            TemplateOut.model_validate(x).model_dump()
            for x in db.scalars(
                select(MessageTemplate).where(
                    MessageTemplate.clinic_id == user.clinic_id
                )
            ).all()
        ],
    }


@router.post("/services", response_model=ServiceOut, status_code=201)
def create_service(data: ServiceCreate, db: Db, user=Depends(manage)):
    item = Service(**data.model_dump(), clinic_id=user.clinic_id)
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.put("/services/{item_id}", response_model=ServiceOut)
def update_service(item_id: int, data: ServiceCreate, db: Db, user=Depends(manage)):
    item = db.scalar(
        select(Service).where(Service.id == item_id, Service.clinic_id == user.clinic_id)
    )
    if not item:
        raise HTTPException(404, "Service not found")
    for k, v in data.model_dump().items():
        setattr(item, k, v)
    db.commit()
    db.refresh(item)
    return item


@router.get("/services/{item_id}/usage", response_model=dict)
def service_usage(item_id: int, db: Db, user=Depends(manage)):
    appointments = db.scalar(
        select(func.count()).select_from(
            select(Appointment.id)
            .where(Appointment.service_id == item_id, Appointment.clinic_id == user.clinic_id)
            .subquery()
        )
    )
    waitlisted = db.scalar(
        select(func.count()).select_from(
            select(WaitlistEntry.id)
            .where(WaitlistEntry.service_id == item_id, WaitlistEntry.clinic_id == user.clinic_id)
            .subquery()
        )
    )
    return {"appointments": appointments or 0, "waitlist_entries": waitlisted or 0}


@router.delete("/services/{item_id}", status_code=204)
def delete_service(item_id: int, db: Db, user=Depends(manage)):
    item = db.scalar(
        select(Service).where(Service.id == item_id, Service.clinic_id == user.clinic_id)
    )
    if not item:
        raise HTTPException(404, "Service not found")
    in_use = db.scalar(
        select(Appointment.id).where(Appointment.service_id == item_id)
    ) or db.scalar(select(WaitlistEntry.id).where(WaitlistEntry.service_id == item_id))
    if in_use:
        raise HTTPException(
            409,
            "This service is used by existing appointments or waitlist entries. "
            "Deactivate it instead of deleting.",
        )
    db.delete(item)
    db.commit()


def _duplicate_company(db: Db, user, name: str, exclude_id: int | None = None):
    query = select(InsuranceCompany).where(
        InsuranceCompany.clinic_id == user.clinic_id,
        func.lower(InsuranceCompany.name) == name.strip().lower(),
    )
    if exclude_id is not None:
        query = query.where(InsuranceCompany.id != exclude_id)
    return db.scalar(query)


@router.post("/insurance-companies", response_model=CompanyOut, status_code=201)
def create_company(data: CompanyIn, db: Db, user=Depends(manage)):
    if _duplicate_company(db, user, data.name):
        raise HTTPException(409, "An insurance company with this name already exists")
    item = InsuranceCompany(clinic_id=user.clinic_id, name=data.name.strip(), active=data.active)
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.put("/insurance-companies/{item_id}", response_model=CompanyOut)
def update_company(item_id: int, data: CompanyIn, db: Db, user=Depends(manage)):
    item = db.scalar(
        select(InsuranceCompany).where(
            InsuranceCompany.id == item_id, InsuranceCompany.clinic_id == user.clinic_id
        )
    )
    if not item:
        raise HTTPException(404, "Insurance company not found")
    if _duplicate_company(db, user, data.name, exclude_id=item_id):
        raise HTTPException(409, "An insurance company with this name already exists")
    item.name = data.name.strip()
    item.active = data.active
    db.commit()
    db.refresh(item)
    return item


@router.delete("/insurance-companies/{item_id}", status_code=204)
def delete_company(item_id: int, db: Db, user=Depends(manage)):
    item = db.scalar(
        select(InsuranceCompany).where(
            InsuranceCompany.id == item_id, InsuranceCompany.clinic_id == user.clinic_id
        )
    )
    if not item:
        raise HTTPException(404, "Insurance company not found")
    if db.scalar(select(InsuranceClaim.id).where(InsuranceClaim.insurance_company_id == item_id)):
        raise HTTPException(
            409,
            "This insurer has existing claims on file. Deactivate it instead of deleting.",
        )
    db.delete(item)
    db.commit()


@router.get("/message-template-variables", response_model=dict)
def message_template_variables(user=Depends(manage)):
    return MESSAGE_TEMPLATE_VARIABLES


@router.post("/message-templates", response_model=TemplateOut, status_code=201)
def create_template(data: TemplateCreate, db: Db, user=Depends(manage)):
    bad = unsupported_variables(data.body)
    if bad:
        raise HTTPException(422, f"Unsupported template variables: {', '.join(sorted(bad))}")
    item = MessageTemplate(clinic_id=user.clinic_id, **data.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.put("/message-templates/{item_id}", response_model=TemplateOut)
def update_template(item_id: int, data: TemplateCreate, db: Db, user=Depends(manage)):
    item = db.scalar(
        select(MessageTemplate).where(
            MessageTemplate.id == item_id, MessageTemplate.clinic_id == user.clinic_id
        )
    )
    if not item:
        raise HTTPException(404, "Template not found")
    bad = unsupported_variables(data.body)
    if bad:
        raise HTTPException(422, f"Unsupported template variables: {', '.join(sorted(bad))}")
    for k, v in data.model_dump().items():
        setattr(item, k, v)
    db.commit()
    db.refresh(item)
    return item


@router.delete("/message-templates/{item_id}", status_code=204)
def delete_template(item_id: int, db: Db, user=Depends(manage)):
    item = db.scalar(
        select(MessageTemplate).where(
            MessageTemplate.id == item_id, MessageTemplate.clinic_id == user.clinic_id
        )
    )
    if not item:
        raise HTTPException(404, "Template not found")
    db.delete(item)
    db.commit()
