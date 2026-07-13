from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import joinedload
from ..dependencies import Db, roles
from ..models import AuditLog, Role, User
from ..schemas import AuditOut

router = APIRouter(prefix="/audit-logs", tags=["Audit logs"])


@router.get("", response_model=list[AuditOut])
def logs(db: Db, user=Depends(roles(Role.owner))):
    return db.scalars(
        select(AuditLog)
        .options(joinedload(AuditLog.user).joinedload(User.clinic))
        .where(AuditLog.clinic_id == user.clinic_id)
        .order_by(AuditLog.created_at.desc())
        .limit(100)
    ).all()
