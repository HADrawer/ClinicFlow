from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError

from ..audit import log
from ..dependencies import CurrentUser, Db, has_permission
from ..models import (
    DispenseItem,
    DispenseOrder,
    DispenseStatus,
    Invoice,
    Medicine,
    MedicineBatch,
    Patient,
    PharmacyClarification,
    Prescription,
    PurchaseOrder,
    PurchaseOrderItem,
    PurchaseOrderStatus,
    StockMovement,
    Supplier,
    User,
    Visit,
)
from ..schemas import (
    BatchOut,
    ClarificationIn,
    DispenseIn,
    DispenseOut,
    GoodsReceiptIn,
    MedicineIn,
    MedicineOut,
    PurchaseOrderIn,
    PurchaseOrderOut,
    SupplierIn,
    SupplierOut,
)

router = APIRouter(prefix="/pharmacy", tags=["Pharmacy"])


def pharmacy_access(*permissions: str):
    def check(user: CurrentUser):
        if not user.clinic.pharmacy_enabled:
            raise HTTPException(404, "Pharmacy module is not enabled")
        if not any(has_permission(user, name) for name in permissions):
            raise HTTPException(403, "Insufficient permission")
        return user

    return check


read_access = pharmacy_access(
    "pharmacy.read",
    "pharmacy.inventory_manage",
    "pharmacy.dispense",
    "pharmacy.purchase_manage",
)
inventory_access = pharmacy_access("pharmacy.inventory_manage")
purchase_access = pharmacy_access(
    "pharmacy.purchase_manage", "pharmacy.inventory_manage"
)
dispense_access = pharmacy_access("pharmacy.dispense")


@router.get("/dashboard", response_model=dict)
def dashboard(db: Db, user=Depends(read_access)):
    today = date.today()
    horizon = today + timedelta(days=90)
    medicines = db.scalars(
        select(Medicine).where(Medicine.clinic_id == user.clinic_id, Medicine.active)
    ).all()
    batches = db.scalars(
        select(MedicineBatch).where(MedicineBatch.clinic_id == user.clinic_id)
    ).all()
    totals = {
        medicine.id: sum(
            batch.quantity_available
            for batch in batches
            if batch.medicine_id == medicine.id
        )
        for medicine in medicines
    }
    return {
        "awaiting_dispensing": db.scalar(
            select(func.count(Prescription.id)).where(
                Prescription.clinic_id == user.clinic_id,
                Prescription.status.in_(["issued", "partially_dispensed"]),
            )
        )
        or 0,
        "low_stock": sum(
            1 for medicine in medicines if totals[medicine.id] <= medicine.reorder_level
        ),
        "near_expiry": sum(
            1
            for batch in batches
            if today < batch.expiry_date <= horizon and batch.quantity_available > 0
        ),
        "expired": sum(
            1
            for batch in batches
            if batch.expiry_date <= today and batch.quantity_available > 0
        ),
        "out_of_stock": sum(1 for medicine in medicines if totals[medicine.id] == 0),
        "today_dispensing": db.scalar(
            select(func.count(DispenseOrder.id)).where(
                DispenseOrder.clinic_id == user.clinic_id,
                DispenseOrder.status == DispenseStatus.finalized,
                DispenseOrder.finalized_at
                >= datetime.combine(today, datetime.min.time(), tzinfo=timezone.utc),
            )
        )
        or 0,
        "pending_purchase_orders": db.scalar(
            select(func.count(PurchaseOrder.id)).where(
                PurchaseOrder.clinic_id == user.clinic_id,
                PurchaseOrder.status.in_(
                    [
                        PurchaseOrderStatus.draft,
                        PurchaseOrderStatus.ordered,
                        PurchaseOrderStatus.partially_received,
                    ]
                ),
            )
        )
        or 0,
    }


@router.get("/prescriptions", response_model=list[dict])
def prescription_queue(db: Db, user=Depends(read_access)):
    prescriptions = db.scalars(
        select(Prescription)
        .where(
            Prescription.clinic_id == user.clinic_id,
            Prescription.status.in_(["issued", "partially_dispensed"]),
        )
        .order_by(Prescription.created_at)
    ).all()
    result = []
    for prescription in prescriptions:
        patient = db.get(Patient, prescription.patient_id)
        visit = db.get(Visit, prescription.visit_id)
        prescriber = db.get(User, visit.doctor_id) if visit else None
        result.append(
            {
                "id": prescription.id,
                "patient_id": patient.id,
                "patient_name": patient.full_name,
                "patient_number": patient.patient_number,
                "allergies": patient.allergies,
                "prescriber": prescriber.full_name if prescriber else "Unknown",
                "status": prescription.status,
                "created_at": prescription.created_at.isoformat(),
                "items": [
                    {
                        "id": item.id,
                        "medicine_name": item.medicine_name,
                        "dosage": item.dosage,
                        "frequency": item.frequency,
                        "duration": item.duration,
                        "quantity": item.quantity,
                        "instructions": item.instructions,
                    }
                    for item in prescription.items
                ],
            }
        )
    return result


@router.get("/prescriptions/{prescription_id}", response_model=dict)
def prescription_detail(prescription_id: int, db: Db, user=Depends(read_access)):
    rows = prescription_queue(db, user)
    prescription = next((row for row in rows if row["id"] == prescription_id), None)
    if not prescription:
        raise HTTPException(404, "Open prescription not found")
    medicines = db.scalars(
        select(Medicine).where(Medicine.clinic_id == user.clinic_id, Medicine.active)
    ).all()
    suggestions = []
    for item in prescription["items"]:
        needle = item["medicine_name"].lower()
        matches = [
            medicine
            for medicine in medicines
            if needle in medicine.generic_name.lower()
            or (medicine.brand_name and needle in medicine.brand_name.lower())
            or medicine.generic_name.lower() in needle
        ]
        suggestions.append(
            {
                "prescription_item_id": item["id"],
                "medicines": [
                    {
                        "id": medicine.id,
                        "name": medicine.generic_name,
                        "strength": medicine.strength,
                        "batches": [
                            {
                                "id": batch.id,
                                "batch_number": batch.batch_number,
                                "expiry_date": batch.expiry_date.isoformat(),
                                "quantity_available": batch.quantity_available,
                            }
                            for batch in db.scalars(
                                select(MedicineBatch)
                                .where(
                                    MedicineBatch.clinic_id == user.clinic_id,
                                    MedicineBatch.medicine_id == medicine.id,
                                    MedicineBatch.expiry_date > date.today(),
                                    MedicineBatch.quantity_available > 0,
                                    MedicineBatch.status == "available",
                                    MedicineBatch.quarantined.is_(False),
                                )
                                .order_by(MedicineBatch.expiry_date)
                            ).all()
                        ],
                    }
                    for medicine in matches
                ],
            }
        )
    prescription["suggestions"] = suggestions
    return prescription


@router.get("/medicines", response_model=list[MedicineOut])
def medicines(db: Db, user=Depends(read_access), search: str = ""):
    query = select(Medicine).where(Medicine.clinic_id == user.clinic_id)
    if search:
        query = query.where(
            Medicine.generic_name.ilike(f"%{search}%")
            | Medicine.brand_name.ilike(f"%{search}%")
            | Medicine.code.ilike(f"%{search}%")
        )
    return db.scalars(query.order_by(Medicine.generic_name)).all()


@router.post("/medicines", response_model=MedicineOut, status_code=201)
def create_medicine(data: MedicineIn, db: Db, user=Depends(inventory_access)):
    medicine = Medicine(clinic_id=user.clinic_id, **data.model_dump())
    db.add(medicine)
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "Medicine code already exists")
    log(db, user, "pharmacy.medicine_created", "medicine", medicine.id)
    db.commit()
    db.refresh(medicine)
    return medicine


@router.get("/suppliers", response_model=list[SupplierOut])
def suppliers(db: Db, user=Depends(read_access)):
    return db.scalars(
        select(Supplier)
        .where(Supplier.clinic_id == user.clinic_id)
        .order_by(Supplier.name)
    ).all()


@router.post("/suppliers", response_model=SupplierOut, status_code=201)
def create_supplier(data: SupplierIn, db: Db, user=Depends(purchase_access)):
    supplier = Supplier(clinic_id=user.clinic_id, **data.model_dump())
    db.add(supplier)
    db.flush()
    log(db, user, "pharmacy.supplier_created", "supplier", supplier.id)
    db.commit()
    db.refresh(supplier)
    return supplier


def purchase_payload(db, order: PurchaseOrder):
    items = db.scalars(
        select(PurchaseOrderItem).where(PurchaseOrderItem.purchase_order_id == order.id)
    ).all()
    return {
        "id": order.id,
        "supplier_id": order.supplier_id,
        "order_number": order.order_number,
        "status": order.status,
        "expected_delivery": order.expected_delivery,
        "supplier_invoice_reference": order.supplier_invoice_reference,
        "notes": order.notes,
        "created_at": order.created_at,
        "items": [
            {
                "id": item.id,
                "medicine_id": item.medicine_id,
                "quantity_ordered": item.quantity_ordered,
                "quantity_received": item.quantity_received,
                "unit_cost": str(item.unit_cost),
            }
            for item in items
        ],
    }


@router.get("/purchase-orders", response_model=list[PurchaseOrderOut])
def purchase_orders(db: Db, user=Depends(read_access)):
    rows = db.scalars(
        select(PurchaseOrder)
        .where(PurchaseOrder.clinic_id == user.clinic_id)
        .order_by(PurchaseOrder.created_at.desc())
    ).all()
    return [purchase_payload(db, row) for row in rows]


@router.post("/purchase-orders", response_model=PurchaseOrderOut, status_code=201)
def create_purchase_order(data: PurchaseOrderIn, db: Db, user=Depends(purchase_access)):
    supplier = db.scalar(
        select(Supplier).where(
            Supplier.id == data.supplier_id,
            Supplier.clinic_id == user.clinic_id,
            Supplier.active,
        )
    )
    medicine_ids = {item.medicine_id for item in data.items}
    valid = set(
        db.scalars(
            select(Medicine.id).where(
                Medicine.clinic_id == user.clinic_id, Medicine.id.in_(medicine_ids)
            )
        ).all()
    )
    if not supplier or valid != medicine_ids:
        raise HTTPException(400, "Invalid supplier or medicine")
    last_id = (
        db.scalar(
            select(PurchaseOrder.id)
            .where(PurchaseOrder.clinic_id == user.clinic_id)
            .order_by(PurchaseOrder.id.desc())
            .limit(1)
        )
        or 0
    )
    order = PurchaseOrder(
        clinic_id=user.clinic_id,
        supplier_id=data.supplier_id,
        order_number=f"PO-{last_id + 1:05d}",
        status=PurchaseOrderStatus.ordered,
        expected_delivery=data.expected_delivery,
        notes=data.notes,
        created_by_id=user.id,
    )
    db.add(order)
    db.flush()
    db.add_all(
        [
            PurchaseOrderItem(purchase_order_id=order.id, **item.model_dump())
            for item in data.items
        ]
    )
    log(db, user, "pharmacy.purchase_order_created", "purchase_order", order.id)
    db.commit()
    db.refresh(order)
    return purchase_payload(db, order)


@router.post("/purchase-orders/{order_id}/receive", response_model=list[BatchOut])
def receive_purchase(
    order_id: int,
    data: GoodsReceiptIn,
    db: Db,
    user=Depends(purchase_access),
):
    try:
        order = db.scalar(
            select(PurchaseOrder)
            .where(
                PurchaseOrder.id == order_id,
                PurchaseOrder.clinic_id == user.clinic_id,
                PurchaseOrder.status.not_in(
                    [
                        PurchaseOrderStatus.cancelled,
                        PurchaseOrderStatus.received,
                    ]
                ),
            )
            .with_for_update()
        )
        if not order:
            raise HTTPException(404, "Open purchase order not found")
        requested_ids = {item.purchase_order_item_id for item in data.items}
        order_items = {
            item.id: item
            for item in db.scalars(
                select(PurchaseOrderItem)
                .where(
                    PurchaseOrderItem.purchase_order_id == order.id,
                    PurchaseOrderItem.id.in_(requested_ids),
                )
                .with_for_update()
            ).all()
        }
        if set(order_items) != requested_ids:
            raise HTTPException(400, "Invalid purchase order item")
        for incoming in data.items:
            item = order_items[incoming.purchase_order_item_id]
            if item.quantity_received + incoming.quantity > item.quantity_ordered:
                raise HTTPException(422, "Receipt exceeds ordered quantity")
            if incoming.expiry_date <= date.today():
                raise HTTPException(
                    422, "Expired stock cannot be received as available"
                )
        batches = []
        for incoming in data.items:
            item = order_items[incoming.purchase_order_item_id]
            batch = MedicineBatch(
                clinic_id=user.clinic_id,
                medicine_id=item.medicine_id,
                supplier_id=order.supplier_id,
                purchase_order_id=order.id,
                batch_number=incoming.batch_number,
                expiry_date=incoming.expiry_date,
                quantity_received=incoming.quantity,
                quantity_available=incoming.quantity,
                purchase_cost=item.unit_cost,
                received_date=date.today(),
                storage_location=incoming.storage_location,
            )
            db.add(batch)
            db.flush()
            db.add(
                StockMovement(
                    clinic_id=user.clinic_id,
                    medicine_id=item.medicine_id,
                    batch_id=batch.id,
                    actor_id=user.id,
                    movement_type="purchase_receipt",
                    quantity=incoming.quantity,
                    before_quantity=0,
                    after_quantity=incoming.quantity,
                    source_type="purchase_order",
                    source_id=order.id,
                )
            )
            item.quantity_received += incoming.quantity
            batches.append(batch)
        all_items = db.scalars(
            select(PurchaseOrderItem).where(
                PurchaseOrderItem.purchase_order_id == order.id
            )
        ).all()
        order.status = (
            PurchaseOrderStatus.received
            if all(
                item.quantity_received == item.quantity_ordered for item in all_items
            )
            else PurchaseOrderStatus.partially_received
        )
        order.supplier_invoice_reference = data.supplier_invoice_reference
        log(
            db,
            user,
            "pharmacy.goods_received",
            "purchase_order",
            order.id,
            {"batches": len(batches)},
        )
        db.commit()
        return batches
    except HTTPException:
        db.rollback()
        raise
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "Batch number already exists")


@router.get("/stock", response_model=list[BatchOut])
def stock(db: Db, user=Depends(read_access), medicine_id: int | None = None):
    query = select(MedicineBatch).where(MedicineBatch.clinic_id == user.clinic_id)
    if medicine_id:
        query = query.where(MedicineBatch.medicine_id == medicine_id)
    return db.scalars(
        query.order_by(MedicineBatch.expiry_date, MedicineBatch.batch_number)
    ).all()


@router.get("/stock/fefo/{medicine_id}", response_model=list[BatchOut])
def fefo(medicine_id: int, db: Db, user=Depends(read_access)):
    return db.scalars(
        select(MedicineBatch)
        .where(
            MedicineBatch.clinic_id == user.clinic_id,
            MedicineBatch.medicine_id == medicine_id,
            MedicineBatch.expiry_date > date.today(),
            MedicineBatch.quantity_available > 0,
            MedicineBatch.quarantined.is_(False),
        )
        .order_by(MedicineBatch.expiry_date, MedicineBatch.received_date)
    ).all()


@router.post("/stock/{batch_id}/adjust", response_model=BatchOut)
def adjust_stock(batch_id: int, data: dict, db: Db, user=Depends(inventory_access)):
    quantity = int(data.get("quantity", 0))
    reason = str(data.get("reason", "")).strip()
    if not quantity or len(reason) < 3:
        raise HTTPException(422, "Non-zero quantity and adjustment reason are required")
    batch = db.scalar(
        select(MedicineBatch)
        .where(
            MedicineBatch.id == batch_id,
            MedicineBatch.clinic_id == user.clinic_id,
        )
        .with_for_update()
    )
    if not batch:
        raise HTTPException(404, "Batch not found")
    before = batch.quantity_available
    after = before + quantity
    if after < 0:
        raise HTTPException(409, "Adjustment would create negative stock")
    batch.quantity_available = after
    batch.version += 1
    movement = StockMovement(
        clinic_id=user.clinic_id,
        medicine_id=batch.medicine_id,
        batch_id=batch.id,
        actor_id=user.id,
        movement_type="adjustment_in" if quantity > 0 else "adjustment_out",
        quantity=quantity,
        before_quantity=before,
        after_quantity=after,
        reason=reason,
        source_type="stock_adjustment",
    )
    db.add(movement)
    db.flush()
    log(
        db,
        user,
        "pharmacy.stock_adjusted",
        "medicine_batch",
        batch.id,
        {"movement_id": movement.id},
    )
    db.commit()
    db.refresh(batch)
    return batch


@router.post("/dispensing", response_model=DispenseOut, status_code=201)
def dispense(data: DispenseIn, db: Db, user=Depends(dispense_access)):
    if data.idempotency_key:
        existing = db.scalar(
            select(DispenseOrder).where(
                DispenseOrder.clinic_id == user.clinic_id,
                DispenseOrder.idempotency_key == data.idempotency_key,
            )
        )
        if existing:
            return existing
    try:
        prescription = db.scalar(
            select(Prescription)
            .where(
                Prescription.id == data.prescription_id,
                Prescription.clinic_id == user.clinic_id,
                Prescription.status.in_(["issued", "partially_dispensed"]),
            )
            .with_for_update()
        )
        if not prescription:
            raise HTTPException(404, "Open prescription not found")
        if data.invoice_id is not None:
            invoice = db.scalar(
                select(Invoice).where(
                    Invoice.id == data.invoice_id,
                    Invoice.clinic_id == user.clinic_id,
                    Invoice.patient_id == prescription.patient_id,
                )
            )
            if not invoice:
                raise HTTPException(400, "Invoice does not belong to this prescription")
        requested_batch_ids = {item.batch_id for item in data.items}
        batches = {
            batch.id: batch
            for batch in db.scalars(
                select(MedicineBatch)
                .where(
                    MedicineBatch.clinic_id == user.clinic_id,
                    MedicineBatch.id.in_(requested_batch_ids),
                )
                .with_for_update()
            ).all()
        }
        if set(batches) != requested_batch_ids:
            raise HTTPException(400, "Invalid batch selection")
        for requested in data.items:
            batch = batches[requested.batch_id]
            if batch.medicine_id != requested.medicine_id:
                raise HTTPException(400, "Batch does not match medicine")
            if (
                batch.expiry_date <= date.today()
                or batch.status != "available"
                or batch.quarantined
            ):
                raise HTTPException(
                    409, "Expired or unavailable stock cannot be dispensed"
                )
            if batch.quantity_available < requested.quantity:
                raise HTTPException(409, "Insufficient stock")
        order = DispenseOrder(
            clinic_id=user.clinic_id,
            prescription_id=prescription.id,
            patient_id=prescription.patient_id,
            pharmacist_id=user.id,
            status=DispenseStatus.finalized,
            verification_note=data.verification_note,
            counseling_note=data.counseling_note,
            invoice_id=data.invoice_id,
            finalized_at=datetime.now(timezone.utc),
            idempotency_key=data.idempotency_key,
        )
        db.add(order)
        db.flush()
        for requested in data.items:
            batch = batches[requested.batch_id]
            before = batch.quantity_available
            batch.quantity_available -= requested.quantity
            batch.version += 1
            db.add(
                DispenseItem(
                    dispense_order_id=order.id,
                    medicine_id=requested.medicine_id,
                    batch_id=requested.batch_id,
                    quantity=requested.quantity,
                )
            )
            db.add(
                StockMovement(
                    clinic_id=user.clinic_id,
                    medicine_id=requested.medicine_id,
                    batch_id=requested.batch_id,
                    actor_id=user.id,
                    movement_type="dispensing",
                    quantity=-requested.quantity,
                    before_quantity=before,
                    after_quantity=batch.quantity_available,
                    source_type="dispense_order",
                    source_id=order.id,
                )
            )
        db.flush()
        required_quantity = sum(item.quantity for item in prescription.items)
        dispensed_quantity = db.scalar(
            select(func.coalesce(func.sum(DispenseItem.quantity), 0))
            .join(DispenseOrder, DispenseOrder.id == DispenseItem.dispense_order_id)
            .where(
                DispenseOrder.prescription_id == prescription.id,
                DispenseOrder.clinic_id == user.clinic_id,
                DispenseOrder.status == DispenseStatus.finalized,
            )
        )
        prescription.status = (
            "fully_dispensed"
            if dispensed_quantity >= required_quantity
            else "partially_dispensed"
        )
        log(
            db,
            user,
            "pharmacy.dispensed",
            "dispense_order",
            order.id,
            {"item_count": len(data.items)},
        )
        db.commit()
        db.refresh(order)
        return order
    except HTTPException:
        db.rollback()
        raise
    except IntegrityError:
        db.rollback()
        if data.idempotency_key:
            existing = db.scalar(
                select(DispenseOrder).where(
                    DispenseOrder.idempotency_key == data.idempotency_key
                )
            )
            if existing:
                return existing
        raise HTTPException(409, "Dispensing could not be finalized")


@router.get("/dispensing", response_model=list[DispenseOut])
def dispensing_history(db: Db, user=Depends(read_access)):
    return db.scalars(
        select(DispenseOrder)
        .where(DispenseOrder.clinic_id == user.clinic_id)
        .order_by(DispenseOrder.created_at.desc())
    ).all()


@router.post("/clarifications", status_code=201)
def clarify(data: ClarificationIn, db: Db, user=Depends(dispense_access)):
    prescription = db.scalar(
        select(Prescription).where(
            Prescription.id == data.prescription_id,
            Prescription.clinic_id == user.clinic_id,
        )
    )
    if not prescription:
        raise HTTPException(404, "Prescription not found")
    item = PharmacyClarification(
        clinic_id=user.clinic_id,
        prescription_id=prescription.id,
        pharmacist_id=user.id,
        note=data.note,
    )
    db.add(item)
    db.flush()
    log(db, user, "pharmacy.clarification_created", "pharmacy_clarification", item.id)
    db.commit()
    return {"id": item.id, "status": item.status}


@router.get("/movements", response_model=list[dict])
def movements(db: Db, user=Depends(read_access), medicine_id: int | None = None):
    query = select(StockMovement).where(StockMovement.clinic_id == user.clinic_id)
    if medicine_id:
        query = query.where(StockMovement.medicine_id == medicine_id)
    rows = db.scalars(query.order_by(StockMovement.created_at.desc()).limit(500)).all()
    return [
        {
            "id": row.id,
            "medicine_id": row.medicine_id,
            "batch_id": row.batch_id,
            "movement_type": row.movement_type,
            "quantity": row.quantity,
            "before_quantity": row.before_quantity,
            "after_quantity": row.after_quantity,
            "reason": row.reason,
            "source_type": row.source_type,
            "source_id": row.source_id,
            "actor_id": row.actor_id,
            "created_at": row.created_at.isoformat(),
        }
        for row in rows
    ]


@router.get("/reports/stock", response_model=dict)
def stock_report(db: Db, user=Depends(read_access)):
    batches = db.scalars(
        select(MedicineBatch).where(MedicineBatch.clinic_id == user.clinic_id)
    ).all()
    return {
        "stock_on_hand": sum(batch.quantity_available for batch in batches),
        "inventory_value": str(
            sum(
                (batch.purchase_cost * batch.quantity_available for batch in batches),
                Decimal("0"),
            )
        ),
        "expired_units": sum(
            batch.quantity_available
            for batch in batches
            if batch.expiry_date <= date.today()
        ),
        "note": "Operational report only; it does not replace any statutory register.",
    }
