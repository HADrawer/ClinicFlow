from datetime import datetime, timedelta, timezone
from pathlib import Path
from uuid import uuid4

import jwt
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy import select

from ..audit import log
from ..config import settings
from ..dependencies import Db, permission
from ..models import Appointment, Document, Patient, Role, User, Visit

router = APIRouter(prefix="/documents", tags=["Secure documents"])
ALLOWED_TYPES = {"application/pdf", "image/jpeg", "image/png"}


def scoped_patient(db, user: User, patient_id: int):
    query = select(Patient).where(
        Patient.id == patient_id, Patient.clinic_id == user.clinic_id
    )
    if user.role == Role.doctor:
        query = query.where(
            Patient.id.in_(
                select(Appointment.patient_id).where(
                    Appointment.clinic_id == user.clinic_id,
                    Appointment.doctor_id == user.id,
                )
            )
        )
    patient = db.scalar(query)
    if not patient:
        raise HTTPException(404, "Patient not found")
    return patient


def serialize(document: Document):
    return {
        "id": document.id,
        "patient_id": document.patient_id,
        "visit_id": document.visit_id,
        "category": document.category,
        "description": document.description,
        "original_name": document.original_name,
        "content_type": document.content_type,
        "size_bytes": document.size_bytes,
        "uploader_id": document.uploader_id,
        "clinical_photo_consent": document.clinical_photo_consent,
        "created_at": document.created_at.isoformat(),
    }


@router.get("", response_model=list[dict])
def documents(
    patient_id: int,
    db: Db,
    user=Depends(permission("documents.manage")),
):
    scoped_patient(db, user, patient_id)
    rows = db.scalars(
        select(Document)
        .where(
            Document.clinic_id == user.clinic_id,
            Document.patient_id == patient_id,
        )
        .order_by(Document.created_at.desc())
    ).all()
    return [serialize(row) for row in rows]


@router.post("", response_model=dict, status_code=201)
async def upload_document(
    db: Db,
    user=Depends(permission("documents.manage")),
    patient_id: int = Form(...),
    category: str = Form(...),
    description: str | None = Form(None),
    visit_id: int | None = Form(None),
    clinical_photo_consent: bool = Form(False),
    file: UploadFile = File(...),
):
    scoped_patient(db, user, patient_id)
    content_type = file.content_type or "application/octet-stream"
    if content_type not in ALLOWED_TYPES:
        raise HTTPException(422, "Only PDF, JPEG, and PNG files are accepted")
    if (
        content_type.startswith("image/")
        and category == "clinical_photo"
        and not clinical_photo_consent
    ):
        raise HTTPException(422, "Clinical photo consent must be recorded")
    if visit_id and not db.scalar(
        select(Visit).where(
            Visit.id == visit_id,
            Visit.clinic_id == user.clinic_id,
            Visit.patient_id == patient_id,
        )
    ):
        raise HTTPException(400, "Invalid encounter")
    contents = await file.read(settings.max_upload_bytes + 1)
    if len(contents) > settings.max_upload_bytes:
        raise HTTPException(413, "File is larger than the configured upload limit")
    if not contents:
        raise HTTPException(422, "File is empty")
    upload_dir = Path(settings.private_upload_dir).resolve()
    upload_dir.mkdir(parents=True, exist_ok=True, mode=0o700)
    storage_key = uuid4().hex
    path = upload_dir / storage_key
    path.write_bytes(contents)
    path.chmod(0o600)
    original_name = Path(file.filename or "document").name[:255]
    document = Document(
        clinic_id=user.clinic_id,
        patient_id=patient_id,
        visit_id=visit_id,
        category=category,
        description=description,
        original_name=original_name,
        content_type=content_type,
        size_bytes=len(contents),
        storage_key=storage_key,
        uploader_id=user.id,
        clinical_photo_consent=clinical_photo_consent,
    )
    try:
        db.add(document)
        db.flush()
        log(
            db,
            user,
            "document.uploaded",
            "document",
            document.id,
            {"category": category},
        )
        db.commit()
        db.refresh(document)
    except Exception:
        path.unlink(missing_ok=True)
        db.rollback()
        raise
    return serialize(document)


@router.post("/{document_id}/download-link", response_model=dict)
def download_link(
    document_id: int,
    db: Db,
    user=Depends(permission("documents.manage")),
):
    document = db.scalar(
        select(Document).where(
            Document.id == document_id,
            Document.clinic_id == user.clinic_id,
        )
    )
    if not document:
        raise HTTPException(404, "Document not found")
    scoped_patient(db, user, document.patient_id)
    token = jwt.encode(
        {
            "type": "document_download",
            "document_id": document.id,
            "clinic_id": user.clinic_id,
            "user_id": user.id,
            "sv": user.session_version,
            "exp": datetime.now(timezone.utc) + timedelta(minutes=5),
        },
        settings.jwt_secret,
        algorithm=settings.jwt_algorithm,
    )
    return {
        "url": f"/documents/download/{token}",
        "expires_in_seconds": 300,
    }


@router.get("/download/{token}")
def download(token: str, db: Db):
    try:
        payload = jwt.decode(
            token, settings.jwt_secret, algorithms=[settings.jwt_algorithm]
        )
    except jwt.PyJWTError:
        raise HTTPException(401, "Download link is invalid or expired")
    if payload.get("type") != "document_download":
        raise HTTPException(401, "Download link is invalid or expired")
    user = db.scalar(
        select(User).where(
            User.id == payload.get("user_id"),
            User.clinic_id == payload.get("clinic_id"),
            User.is_active,
        )
    )
    if not user or user.session_version != payload.get("sv"):
        raise HTTPException(401, "Download link is invalid or expired")
    document = db.scalar(
        select(Document).where(
            Document.id == payload.get("document_id"),
            Document.clinic_id == user.clinic_id,
        )
    )
    if not document:
        raise HTTPException(404, "Document not found")
    scoped_patient(db, user, document.patient_id)
    path = Path(settings.private_upload_dir).resolve() / document.storage_key
    if not path.is_file():
        raise HTTPException(404, "Document file not found")
    log(db, user, "document.downloaded", "document", document.id)
    db.commit()
    return FileResponse(
        path,
        media_type=document.content_type,
        filename=document.original_name,
        headers={"Cache-Control": "private, no-store"},
    )
