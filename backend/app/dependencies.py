from typing import Annotated
import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session
from .database import get_db
from .models import Role, User
from .security import decode_token

bearer = HTTPBearer(auto_error=False)
Db = Annotated[Session, Depends(get_db)]


def get_current_user(
    db: Db, credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)]
) -> User:
    if not credentials:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Authentication required")
    try:
        payload = decode_token(credentials.credentials)
        user_id = int(payload["sub"])
    except (jwt.PyJWTError, KeyError, ValueError):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired token")
    user = db.get(User, user_id)
    if not user or not user.is_active:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Authentication required")
    if int(payload.get("sv", 1)) != user.session_version:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Session has been revoked")
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]


def roles(*allowed: Role):
    def check(user: CurrentUser) -> User:
        if user.role not in allowed:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Insufficient permission")
        return user

    return check


ROLE_PERMISSIONS: dict[Role, set[str]] = {
    Role.owner: {"*"},
    Role.doctor: {
        "patients.read",
        "patients.create",
        "patients.update",
        "appointments.read_own",
        "appointments.manage_own",
        "encounters.create",
        "encounters.finalize",
        "encounters.amend",
        "prescriptions.create",
        "orders.manage",
        "referrals.manage",
        "messages.create",
        "documents.manage",
    },
    Role.receptionist: {
        "patients.read",
        "patients.create",
        "patients.update",
        "appointments.read_all",
        "appointments.manage_all",
        "queue.manage",
        "waitlist.manage",
        "billing.create",
        "messages.create",
        "consents.manage",
        "documents.manage",
        "quality.manage",
    },
    Role.accountant: {"billing.create", "claims.manage", "reports.view"},
    Role.nurse: {
        "patients.read",
        "appointments.read_all",
        "queue.manage",
        "encounters.create",
        "consents.manage",
        "documents.manage",
        "quality.manage",
    },
    Role.pharmacist: {
        "patients.read",
        "pharmacy.read",
        "pharmacy.dispense",
        "pharmacy.inventory_manage",
        "pharmacy.purchase_manage",
    },
}


def has_permission(user: User, name: str) -> bool:
    granted = ROLE_PERMISSIONS.get(user.role, set()) | set(user.permissions or [])
    return "*" in granted or name in granted


def permission(*names: str):
    def check(user: CurrentUser) -> User:
        if not any(has_permission(user, name) for name in names):
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Insufficient permission")
        return user

    return check
