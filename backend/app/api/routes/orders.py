import uuid
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.orm import Session

from app.config import get_settings
from app.core.deps import get_current_user, get_db
from app.core.limiter import limiter
from app.models.user import User, UserRole
from app.models.order import Order, OrderStatus
from app.models.product import Product
from app.schemas.order import OrderCreate, OrderResponse, ProductResponse

router = APIRouter()


def _fetch_order(order_id: str, db: Session) -> Order:
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return order


@router.get("/products", response_model=List[ProductResponse])
def list_products(
    category: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    q = db.query(Product).filter(Product.is_active == True, Product.requires_prescription == False)
    if category and category != "all":
        q = q.filter(Product.category == category)
    if search:
        q = q.filter(Product.name.ilike(f"%{search}%"))
    products = q.order_by(Product.category, Product.name).all()
    return [ProductResponse.model_validate(p) for p in products]


@router.get("/products/{product_id}", response_model=ProductResponse)
def get_product(product_id: str, db: Session = Depends(get_db)):
    product = db.query(Product).filter(Product.id == product_id, Product.is_active == True).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return ProductResponse.model_validate(product)


@router.get("/my", response_model=List[OrderResponse])
def my_orders(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    orders = (
        db.query(Order)
        .filter(Order.patient_id == current_user.id)
        .order_by(Order.created_at.desc())
        .all()
    )
    return [OrderResponse.model_validate(o) for o in orders]


@router.post("/", response_model=OrderResponse, status_code=201)
def create_order(
    data: OrderCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    resolved: list[tuple[Product, int]] = []
    clinic_id = None

    for item in data.items:
        product = db.query(Product).filter(
            Product.id == item.product_id, Product.is_active == True
        ).with_for_update().first()
        if not product:
            raise HTTPException(status_code=404, detail=f"Product not found: {item.product_id}")
        if product.requires_prescription:
            raise HTTPException(
                status_code=400,
                detail=f'"{product.name}" requires a prescription and cannot be ordered here.',
            )
        if product.stock_quantity < item.quantity:
            raise HTTPException(
                status_code=400,
                detail=f"Insufficient stock for {product.name} (available: {product.stock_quantity})",
            )
        if clinic_id is None:
            clinic_id = product.clinic_id
        elif product.clinic_id != clinic_id:
            raise HTTPException(
                status_code=400,
                detail="All products in a single order must belong to the same clinic",
            )
        resolved.append((product, item.quantity))

    if clinic_id is None:
        raise HTTPException(status_code=400, detail="No valid products")

    subtotal = sum(p.price_kes * qty for p, qty in resolved)
    _settings = get_settings()
    delivery_fee = float(_settings.delivery_fee_kes) if str(data.delivery_method) == "delivery" else 0.0

    items_snapshot = [
        {
            "product_id": str(p.id),
            "name": p.name,
            "qty": qty,
            "unit_price": float(p.price_kes),
            "total": float(p.price_kes * qty),
        }
        for p, qty in resolved
    ]

    order = Order(
        order_number=f"MO-{str(uuid.uuid4()).upper().replace('-', '')[:8]}",
        clinic_id=clinic_id,
        patient_id=current_user.id,
        items=items_snapshot,
        subtotal_kes=subtotal,
        delivery_fee_kes=delivery_fee,
        total_kes=subtotal + delivery_fee,
        delivery_method=str(data.delivery_method),
        payment_method=str(data.payment_method),
    )
    db.add(order)

    for product, qty in resolved:
        if product.stock_quantity < qty:
            raise HTTPException(
                status_code=400,
                detail=f"Insufficient stock for {product.name} — concurrent order may have consumed it",
            )
        product.stock_quantity -= qty

    db.commit()
    return OrderResponse.model_validate(_fetch_order(str(order.id), db))


@router.post("/{order_id}/initiate-payment", status_code=202)
@limiter.limit("5/minute")
async def initiate_order_payment(
    request: Request,
    order_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Trigger M-Pesa STK push for an order."""
    order = _fetch_order(order_id, db)
    if str(order.patient_id) != str(current_user.id):
        raise HTTPException(status_code=403, detail="Not your order")
    if order.payment_status == "paid":
        raise HTTPException(status_code=400, detail="Order already paid")
    if str(order.payment_method) != "mpesa":
        raise HTTPException(status_code=400, detail="Order payment method is not M-Pesa")
    if not current_user.phone:
        raise HTTPException(status_code=400, detail="No phone number on your account")

    from app.services.mpesa import stk_push
    _settings = get_settings()
    reference = f"MO-{str(order.id).upper().replace('-', '')[:8]}"
    callback_url = f"{_settings.mpesa_callback_url}/api/v1/webhooks/mpesa/stk-callback"

    try:
        result = await stk_push(
            phone=current_user.phone,
            amount=int(order.total_kes),
            account_reference=reference,
            description=f"Order {reference}",
            callback_url=callback_url,
        )
    except Exception:
        raise HTTPException(status_code=502, detail="Payment initiation failed. Please try again.")

    checkout_request_id = result.get("CheckoutRequestID")
    if checkout_request_id:
        order.mpesa_transaction_id = checkout_request_id
        db.commit()

    return {
        "message": f"M-Pesa prompt sent to {current_user.phone}. Enter your PIN to confirm.",
        "checkout_request_id": checkout_request_id,
    }


_VALID_TRANSITIONS: dict[str, set[str]] = {
    "pending":          {"confirmed", "processing", "cancelled"},
    "confirmed":        {"processing", "cancelled"},
    "processing":       {"ready", "out_for_delivery", "cancelled"},
    "ready":            {"delivered", "cancelled"},
    "out_for_delivery": {"delivered", "cancelled"},
    "delivered":        {"refunded"},
    "cancelled":        set(),
    "refunded":         set(),
}


@router.patch("/{order_id}/status", response_model=OrderResponse)
async def update_order_status(
    order_id: str,
    status: OrderStatus = Query(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role not in [UserRole.CLINIC_ADMIN, UserRole.SUPER_ADMIN]:
        raise HTTPException(status_code=403, detail="Not authorized")
    order = _fetch_order(order_id, db)
    old_status = str(order.status)
    new_status = str(status)

    allowed = _VALID_TRANSITIONS.get(old_status, set())
    if new_status not in allowed:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot transition order from '{old_status}' to '{new_status}'. "
                   f"Allowed: {sorted(allowed) or 'none'}",
        )

    order.status = new_status
    db.commit()

    # Notify patient of order status change
    import asyncio
    _t = asyncio.ensure_future(_notify_order_status(
        order_id=order_id,
        patient_id=str(order.patient_id),
        new_status=str(status),
        order_number=order.order_number,
    ))
    _t.add_done_callback(lambda _: None)

    return OrderResponse.model_validate(_fetch_order(order_id, db))


async def _notify_order_status(
    order_id: str, patient_id: str, new_status: str, order_number: str,
) -> None:
    from app.database import SessionLocal
    from app.models.user import User as UserModel
    from app.models.clinic import Clinic
    from app.models.order import Order
    from app.services.notification_service import notify
    from app.services.sms import sms_order_ready, sms_order_delivered

    STATUS_TITLES = {
        "processing":       "Order Processing",
        "ready":            "Order Ready for Pickup",
        "out_for_delivery": "Order Out for Delivery",
        "delivered":        "Order Delivered",
        "cancelled":        "Order Cancelled",
    }
    title = STATUS_TITLES.get(new_status)
    if not title:
        return

    db = SessionLocal()
    try:
        patient = db.query(UserModel).filter(UserModel.id == patient_id).first()
        order = db.query(Order).filter(Order.id == order_id).first()
        if not patient or not order:
            return

        clinic = db.query(Clinic).filter(Clinic.id == order.clinic_id).first()
        clinic_name = clinic.name if clinic else "the clinic"
        clinic_addr = clinic.address if clinic else ""

        if new_status == "ready":
            sms_body = sms_order_ready(
                patient.full_name, order_number, clinic_name, clinic_addr, "48 hours"
            )
        elif new_status == "delivered":
            sms_body = sms_order_delivered(patient.full_name, order_number, order_id)
        else:
            sms_body = f"MedAssist AI: Your order #{order_number} status: {new_status}."

        channels = ["in_app"]
        if patient.phone and new_status in ("ready", "delivered", "cancelled"):
            channels.append("sms")

        await notify(
            db, patient,
            type=f"order_{new_status}",
            title=title,
            body=sms_body,
            data={"order_id": order_id, "order_number": order_number, "status": new_status},
            channels=channels,
        )
        db.commit()
    finally:
        db.close()
