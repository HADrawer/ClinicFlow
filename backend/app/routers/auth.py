from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select
from . import clinics as clinic_router
from ..dependencies import CurrentUser, Db
from ..models import Clinic, PasswordReset, Role, User
from ..schemas import (
    Login,
    PasswordChange,
    PasswordResetConfirm,
    PasswordResetRequest,
    Register,
    Token,
    UserOut,
)
from ..security import (
    create_access_token,
    hash_password,
    new_single_use_token,
    token_digest,
    verify_password,
)

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/login", response_model=Token)
def login(data: Login, db: Db):
    user = db.scalar(select(User).where(User.email == data.email.lower()))
    if (
        not user
        or not user.is_active
        or not verify_password(data.password, user.password_hash)
    ):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid email or password")
    user.last_login_at = datetime.now(timezone.utc)
    db.commit()
    return Token(
        access_token=create_access_token(
            user.id, user.clinic_id, user.role.value, user.session_version
        )
    )


@router.post("/register", response_model=Token, status_code=201)
def register(data: Register, db: Db):
    if db.scalar(select(User).where(User.email == data.email.lower())):
        raise HTTPException(409, "Email already registered")
    clinic = Clinic(
        name=data.clinic_name,
        phone=data.phone,
        address="",
        working_hours=clinic_router.DEFAULT_HOURS,
    )
    db.add(clinic)
    db.flush()
    user = User(
        clinic_id=clinic.id,
        email=data.email.lower(),
        full_name=data.full_name,
        password_hash=hash_password(data.password),
        role=Role.owner,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return Token(
        access_token=create_access_token(
            user.id, user.clinic_id, user.role.value, user.session_version
        )
    )


@router.get("/me", response_model=UserOut)
def me(user: CurrentUser):
    return user


@router.post("/change-password", status_code=204)
def change_password(data: PasswordChange, db: Db, user: CurrentUser):
    if not verify_password(data.current_password, user.password_hash):
        raise HTTPException(400, "Current password is incorrect")
    user.password_hash = hash_password(data.new_password)
    user.session_version += 1
    db.commit()


@router.post("/forgot-password")
def forgot_password(data: PasswordResetRequest, db: Db):
    user = db.scalar(select(User).where(User.email == data.email.lower()))
    demo_token = None
    if user and user.is_active:
        token, digest = new_single_use_token()
        db.add(
            PasswordReset(
                user_id=user.id,
                token_hash=digest,
                expires_at=datetime.now(timezone.utc) + timedelta(hours=1),
            )
        )
        db.commit()
        demo_token = token
    return {
        "message": "If an active account exists, password reset instructions are available.",
        "demo_token": demo_token,
    }


@router.post("/reset-password", status_code=204)
def reset_password(data: PasswordResetConfirm, db: Db):
    reset = db.scalar(
        select(PasswordReset).where(
            PasswordReset.token_hash == token_digest(data.token)
        )
    )
    now = datetime.now(timezone.utc)
    if not reset or reset.used_at or as_utc(reset.expires_at) <= now:
        raise HTTPException(400, "Reset link is invalid or expired")
    user = db.get(User, reset.user_id)
    if not user or not user.is_active:
        raise HTTPException(400, "Reset link is invalid or expired")
    user.password_hash = hash_password(data.password)
    user.session_version += 1
    reset.used_at = now
    db.commit()


@router.post("/logout", status_code=204)
def logout(db: Db, user: CurrentUser):
    user.session_version += 1
    db.commit()


def as_utc(value: datetime) -> datetime:
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value
