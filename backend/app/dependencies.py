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

# The full catalog of individually grantable permissions, grouped for display.
# Every string here already gates a real endpoint (see permission(...) usage
# across app/routers/); nothing here is aspirational.
PERMISSION_CATALOG: dict[str, list[str]] = {
    "Patients": ["patients.read", "patients.create", "patients.update"],
    "Appointments & queue": [
        "appointments.read_own",
        "appointments.manage_own",
        "appointments.read_all",
        "appointments.manage_all",
        "queue.manage",
        "waitlist.manage",
    ],
    "Clinical records": [
        "encounters.create",
        "encounters.finalize",
        "encounters.amend",
        "prescriptions.create",
        "orders.manage",
        "referrals.manage",
        "consents.manage",
    ],
    "Documents & messaging": ["documents.manage", "messages.create"],
    "Billing & insurance": ["billing.create", "claims.manage"],
    "Pharmacy": [
        "pharmacy.read",
        "pharmacy.dispense",
        "pharmacy.inventory_manage",
        "pharmacy.purchase_manage",
    ],
    "Quality & reporting": ["quality.manage", "reports.view"],
    "Administration": ["staff.manage", "settings.manage"],
}

ALL_PERMISSIONS: set[str] = {
    name for names in PERMISSION_CATALOG.values() for name in names
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


def grantable_permissions(user: User) -> set[str]:
    """Permissions this user is allowed to hand out to others.

    Owners (role permission "*") may grant anything in the catalog; everyone
    else may only grant permissions they themselves currently hold, so staff
    can never escalate a colleague past their own access.
    """
    granted = ROLE_PERMISSIONS.get(user.role, set()) | set(user.permissions or [])
    if "*" in granted:
        return set(ALL_PERMISSIONS)
    return granted & ALL_PERMISSIONS
