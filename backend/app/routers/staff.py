from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select

from ..audit import log
from ..dependencies import Db, permission
from ..models import (
    DoctorProfile,
    InvitationStatus,
    PasswordReset,
    Role,
    Service,
    StaffInvitation,
    User,
)
from ..schemas import (
    DoctorProfileIn,
    DoctorProfileOut,
    InvitationAccept,
    InvitationCreate,
    InvitationOut,
    StaffPermissionsUpdate,
    StaffStatusUpdate,
    UserOut,
)
from ..security import hash_password, new_single_use_token, token_digest

router = APIRouter(tags=["Staff and invitations"])
staff_manager = permission("staff.manage")


def utc(value: datetime) -> datetime:
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value


def invitation_state(invitation: StaffInvitation) -> InvitationStatus:
    if invitation.status == InvitationStatus.pending and utc(
        invitation.expires_at
    ) <= datetime.now(timezone.utc):
        invitation.status = InvitationStatus.expired
    return invitation.status


def invite_out(
    invitation: StaffInvitation, demo_token: str | None = None
) -> InvitationOut:
    invitation_state(invitation)
    result = InvitationOut.model_validate(invitation)
    return result.model_copy(update={"demo_token": demo_token})


@router.get("/staff", response_model=list[UserOut])
def list_staff(db: Db, owner=Depends(staff_manager)):
    return db.scalars(
        select(User).where(User.clinic_id == owner.clinic_id).order_by(User.full_name)
    ).all()


@router.get("/staff/{staff_id}", response_model=dict)
def get_staff(staff_id: int, db: Db, owner=Depends(staff_manager)):
    staff = db.scalar(
        select(User).where(User.id == staff_id, User.clinic_id == owner.clinic_id)
    )
    if not staff:
        raise HTTPException(404, "Staff member not found")
    profile = db.scalar(
        select(DoctorProfile).where(
            DoctorProfile.user_id == staff.id,
            DoctorProfile.clinic_id == owner.clinic_id,
        )
    )
    invitation = db.scalar(
        select(StaffInvitation)
        .where(
            StaffInvitation.clinic_id == owner.clinic_id,
            StaffInvitation.email == staff.email,
        )
        .order_by(StaffInvitation.id.desc())
    )
    return {
        "user": UserOut.model_validate(staff).model_dump(mode="json"),
        "doctor_profile": DoctorProfileOut.model_validate(profile).model_dump(
            mode="json"
        )
        if profile
        else None,
        "invitation_status": invitation_state(invitation).value if invitation else None,
    }


@router.patch("/staff/{staff_id}/status", response_model=UserOut)
def set_status(
    staff_id: int,
    data: StaffStatusUpdate,
    db: Db,
    owner=Depends(staff_manager),
):
    staff = db.scalar(
        select(User).where(User.id == staff_id, User.clinic_id == owner.clinic_id)
    )
    if not staff:
        raise HTTPException(404, "Staff member not found")
    if staff.id == owner.id and not data.active:
        raise HTTPException(400, "You cannot disable your own account")
    staff.is_active = data.active
    staff.disabled_at = None if data.active else datetime.now(timezone.utc)
    staff.session_version += 1
    log(
        db,
        owner,
        "staff.reactivated" if data.active else "staff.disabled",
        "user",
        staff.id,
    )
    db.commit()
    db.refresh(staff)
    return staff


@router.patch("/staff/{staff_id}/permissions", response_model=UserOut)
def set_permissions(
    staff_id: int,
    data: StaffPermissionsUpdate,
    db: Db,
    owner=Depends(staff_manager),
):
    staff = db.scalar(
        select(User).where(User.id == staff_id, User.clinic_id == owner.clinic_id)
    )
    if not staff:
        raise HTTPException(404, "Staff member not found")
    staff.permissions = sorted(set(data.permissions))
    log(
        db,
        owner,
        "staff.permissions_changed",
        "user",
        staff.id,
        {"permissions": staff.permissions},
    )
    db.commit()
    db.refresh(staff)
    return staff


@router.post("/staff/{staff_id}/revoke-sessions", status_code=204)
def revoke_sessions(staff_id: int, db: Db, owner=Depends(staff_manager)):
    staff = db.scalar(
        select(User).where(User.id == staff_id, User.clinic_id == owner.clinic_id)
    )
    if not staff:
        raise HTTPException(404, "Staff member not found")
    staff.session_version += 1
    log(db, owner, "staff.sessions_revoked", "user", staff.id)
    db.commit()


@router.post("/staff/{staff_id}/password-reset")
def create_staff_reset(staff_id: int, db: Db, owner=Depends(staff_manager)):
    staff = db.scalar(
        select(User).where(User.id == staff_id, User.clinic_id == owner.clinic_id)
    )
    if not staff:
        raise HTTPException(404, "Staff member not found")
    token, digest = new_single_use_token()
    db.add(
        PasswordReset(
            user_id=staff.id,
            token_hash=digest,
            expires_at=datetime.now(timezone.utc) + timedelta(hours=1),
        )
    )
    log(db, owner, "staff.password_reset_created", "user", staff.id)
    db.commit()
    return {"demo_token": token, "expires_in_minutes": 60}


@router.put("/staff/{staff_id}/doctor-profile", response_model=DoctorProfileOut)
def update_doctor_profile(
    staff_id: int,
    data: DoctorProfileIn,
    db: Db,
    owner=Depends(staff_manager),
):
    doctor = db.scalar(
        select(User).where(
            User.id == staff_id,
            User.clinic_id == owner.clinic_id,
            User.role == Role.doctor,
        )
    )
    if not doctor:
        raise HTTPException(404, "Doctor not found")
    valid_services = set(
        db.scalars(select(Service.id).where(Service.clinic_id == owner.clinic_id)).all()
    )
    if not set(data.service_ids).issubset(valid_services):
        raise HTTPException(400, "Invalid service selection")
    profile = db.scalar(select(DoctorProfile).where(DoctorProfile.user_id == doctor.id))
    if not profile:
        profile = DoctorProfile(clinic_id=owner.clinic_id, user_id=doctor.id)
        db.add(profile)
    for key, value in data.model_dump().items():
        setattr(profile, key, value)
    doctor.specialty = data.specialty
    log(db, owner, "doctor.profile_updated", "user", doctor.id)
    db.commit()
    db.refresh(profile)
    return profile


@router.get("/invitations", response_model=list[InvitationOut])
def invitations(db: Db, owner=Depends(staff_manager)):
    rows = db.scalars(
        select(StaffInvitation)
        .where(StaffInvitation.clinic_id == owner.clinic_id)
        .order_by(StaffInvitation.created_at.desc())
    ).all()
    result = [invite_out(row) for row in rows]
    if any(row.status == InvitationStatus.expired for row in rows):
        db.commit()
    return result


@router.post("/invitations", response_model=InvitationOut, status_code=201)
def create_invitation(
    data: InvitationCreate,
    db: Db,
    owner=Depends(staff_manager),
):
    if data.role == Role.owner:
        raise HTTPException(400, "Owner invitations are not supported")
    if db.scalar(select(User).where(User.email == data.email.lower())):
        raise HTTPException(409, "Email already registered")
    existing = db.scalar(
        select(StaffInvitation).where(
            StaffInvitation.email == data.email.lower(),
            StaffInvitation.status == InvitationStatus.pending,
        )
    )
    if existing and utc(existing.expires_at) > datetime.now(timezone.utc):
        raise HTTPException(409, "A pending invitation already exists")
    if existing:
        existing.status = InvitationStatus.expired
    token, digest = new_single_use_token()
    invitation = StaffInvitation(
        clinic_id=owner.clinic_id,
        created_by_id=owner.id,
        email=data.email.lower(),
        full_name=data.full_name,
        role=data.role,
        token_hash=digest,
        expires_at=datetime.now(timezone.utc) + timedelta(hours=data.expires_in_hours),
        profile_data=data.profile_data,
    )
    db.add(invitation)
    db.flush()
    log(
        db,
        owner,
        "invitation.created",
        "staff_invitation",
        invitation.id,
        {"role": data.role.value},
    )
    db.commit()
    db.refresh(invitation)
    return invite_out(invitation, token)


@router.post("/invitations/{invitation_id}/resend", response_model=InvitationOut)
def resend_invitation(invitation_id: int, db: Db, owner=Depends(staff_manager)):
    invitation = db.scalar(
        select(StaffInvitation).where(
            StaffInvitation.id == invitation_id,
            StaffInvitation.clinic_id == owner.clinic_id,
        )
    )
    if not invitation or invitation.status == InvitationStatus.accepted:
        raise HTTPException(404, "Invitation cannot be resent")
    token, digest = new_single_use_token()
    invitation.token_hash = digest
    invitation.status = InvitationStatus.pending
    invitation.expires_at = datetime.now(timezone.utc) + timedelta(hours=72)
    invitation.revoked_at = None
    log(db, owner, "invitation.resent", "staff_invitation", invitation.id)
    db.commit()
    db.refresh(invitation)
    return invite_out(invitation, token)


@router.post("/invitations/{invitation_id}/revoke", response_model=InvitationOut)
def revoke_invitation(invitation_id: int, db: Db, owner=Depends(staff_manager)):
    invitation = db.scalar(
        select(StaffInvitation).where(
            StaffInvitation.id == invitation_id,
            StaffInvitation.clinic_id == owner.clinic_id,
        )
    )
    if not invitation or invitation.status != InvitationStatus.pending:
        raise HTTPException(404, "Pending invitation not found")
    invitation.status = InvitationStatus.revoked
    invitation.revoked_at = datetime.now(timezone.utc)
    log(db, owner, "invitation.revoked", "staff_invitation", invitation.id)
    db.commit()
    db.refresh(invitation)
    return invite_out(invitation)


@router.get("/invitations/validate/{token}", response_model=dict)
def validate_invitation(token: str, db: Db):
    invitation = db.scalar(
        select(StaffInvitation).where(StaffInvitation.token_hash == token_digest(token))
    )
    if not invitation or invitation_state(invitation) != InvitationStatus.pending:
        raise HTTPException(400, "Invitation is invalid or expired")
    return {
        "email": invitation.email,
        "full_name": invitation.full_name,
        "role": invitation.role.value,
        "expires_at": invitation.expires_at,
    }


@router.post("/invitations/accept", response_model=UserOut)
def accept_invitation(data: InvitationAccept, db: Db):
    invitation = db.scalar(
        select(StaffInvitation).where(
            StaffInvitation.token_hash == token_digest(data.token)
        )
    )
    if not invitation or invitation_state(invitation) != InvitationStatus.pending:
        raise HTTPException(400, "Invitation is invalid or expired")
    if not data.terms_accepted or not data.privacy_acknowledged:
        raise HTTPException(422, "Terms and privacy acknowledgement are required")
    if db.scalar(select(User).where(User.email == invitation.email)):
        raise HTTPException(409, "Email already registered")
    user = User(
        clinic_id=invitation.clinic_id,
        email=invitation.email,
        full_name=invitation.full_name,
        password_hash=hash_password(data.password),
        role=invitation.role,
        specialty=invitation.profile_data.get("specialty"),
        permissions=invitation.profile_data.get("permissions", []),
    )
    db.add(user)
    db.flush()
    if user.role == Role.doctor:
        allowed = set(DoctorProfileIn.model_fields)
        raw_profile = {
            key: value
            for key, value in invitation.profile_data.items()
            if key in allowed
        }
        profile = DoctorProfileIn.model_validate(raw_profile).model_dump()
        db.add(DoctorProfile(clinic_id=user.clinic_id, user_id=user.id, **profile))
    invitation.status = InvitationStatus.accepted
    invitation.accepted_at = datetime.now(timezone.utc)
    log(db, user, "invitation.accepted", "staff_invitation", invitation.id)
    db.commit()
    db.refresh(user)
    return user
