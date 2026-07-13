from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from ..dependencies import CurrentUser, Db, roles
from ..models import InsuranceCompany, MessageTemplate, Role, Service
from ..schemas import CompanyOut, ServiceCreate, ServiceOut, TemplateOut

router = APIRouter(prefix="/settings", tags=["Settings"])


class CompanyCreate(BaseModel):
    name: str


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
def create_service(data: ServiceCreate, db: Db, user=Depends(roles(Role.owner))):
    item = Service(**data.model_dump(), clinic_id=user.clinic_id)
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.put("/services/{item_id}", response_model=ServiceOut)
def update_service(
    item_id: int, data: ServiceCreate, db: Db, user=Depends(roles(Role.owner))
):
    item = db.scalar(
        select(Service).where(
            Service.id == item_id, Service.clinic_id == user.clinic_id
        )
    )
    if not item:
        raise HTTPException(404, "Service not found")
    for k, v in data.model_dump().items():
        setattr(item, k, v)
    db.commit()
    db.refresh(item)
    return item


@router.post("/insurance-companies", response_model=CompanyOut, status_code=201)
def create_company(data: CompanyCreate, db: Db, user=Depends(roles(Role.owner))):
    item = InsuranceCompany(clinic_id=user.clinic_id, name=data.name)
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.post("/message-templates", response_model=TemplateOut, status_code=201)
def create_template(data: TemplateCreate, db: Db, user=Depends(roles(Role.owner))):
    item = MessageTemplate(clinic_id=user.clinic_id, **data.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.put("/message-templates/{item_id}", response_model=TemplateOut)
def update_template(
    item_id: int, data: TemplateCreate, db: Db, user=Depends(roles(Role.owner))
):
    item = db.scalar(
        select(MessageTemplate).where(
            MessageTemplate.id == item_id, MessageTemplate.clinic_id == user.clinic_id
        )
    )
    if not item:
        raise HTTPException(404, "Template not found")
    for k, v in data.model_dump().items():
        setattr(item, k, v)
    db.commit()
    db.refresh(item)
    return item
