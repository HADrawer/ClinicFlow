from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from ..dependencies import Db, roles
from ..models import Role, User
from ..schemas import UserCreate, UserOut
from ..security import hash_password

router = APIRouter(prefix="/users", tags=["Users"])


@router.get("", response_model=list[UserOut])
def list_users(db: Db, user=Depends(roles(Role.owner))):
    return db.scalars(
        select(User).where(User.clinic_id == user.clinic_id).order_by(User.full_name)
    ).all()


@router.post("", response_model=UserOut, status_code=201)
def create_user(data: UserCreate, db: Db, owner=Depends(roles(Role.owner))):
    if db.scalar(select(User).where(User.email == data.email.lower())):
        raise HTTPException(409, "Email already registered")
    item = User(
        **data.model_dump(exclude={"password"}),
        clinic_id=owner.clinic_id,
        email=data.email.lower(),
        password_hash=hash_password(data.password),
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item
