from fastapi import APIRouter
from sqlalchemy import select
from ..dependencies import CurrentUser, Db
from ..models import Role, User
from ..schemas import UserOut

router = APIRouter(prefix="/doctors", tags=["Doctors"])


@router.get("", response_model=list[UserOut])
def doctors(db: Db, user: CurrentUser):
    return db.scalars(
        select(User).where(
            User.clinic_id == user.clinic_id, User.role == Role.doctor, User.is_active
        )
    ).all()
