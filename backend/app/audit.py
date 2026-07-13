from sqlalchemy.orm import Session
from .models import AuditLog, User


def log(
    db: Session,
    user: User,
    action: str,
    entity_type: str,
    entity_id: int | None,
    details: dict | None = None,
):
    db.add(
        AuditLog(
            user_id=user.id,
            clinic_id=user.clinic_id,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            details=details or {},
        )
    )
