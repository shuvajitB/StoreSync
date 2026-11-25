
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies.auth import get_current_user, require_roles
from app.models import (
    Product,
    Store,
    InventoryStock,
    InventoryMovement,
)
from app.schemas.schemas import (
    StockCreate,
    StockAdjustment,
    StockResponse,
    InventoryMovementResponse,
)

router = APIRouter(prefix="/inventory", tags=["Inventory"])

stock_managers = require_roles(
    "business_owner",
    "inventory_manager",
    "store_manager",
    "super_admin",
)


def get_authorized_store(store_id, current_user, db):
    query = db.query(Store).filter(Store.id == store_id)

    if current_user.role != "super_admin":
        query = query.filter(
            Store.business_id == current_user.business_id
        )

    store = query.first()

    if not store:
        raise HTTPException(404, "Store not found")

    if current_user.role not in {"business_owner", "super_admin"}:
        access = db.query(Store).filter(
            Store.id == store_id,
            Store.user_access.any(user_id=current_user.id),
        ).first()

        if not access:
            raise HTTPException(403, "You do not have access to this store")

    return store


def get_business_product(product_id, current_user, db):
    product = db.query(Product).filter(
        Product.id == product_id,
        Product.business_id == current_user.business_id,
        Product.is_active.is_(True),
    ).first()

    if not product:
        raise HTTPException(404, "Active product not found")

    return product


@router.post("/stock", response_model=StockResponse, status_code=201)
def create_stock(
    stock_data: StockCreate,
    current_user=Depends(stock_managers),
    db: Session = Depends(get_db),
):
    store = get_authorized_store(
        stock_data.store_id, current_user, db
    )

    product = get_business_product(
        stock_data.product_id, current_user, db
    )

    if product.business_id != store.business_id:
        raise HTTPException(400, "Product and store must belong to the same business")

    existing = db.query(InventoryStock).filter(
        InventoryStock.product_id == product.id,
        InventoryStock.store_id == store.id,
    ).first()

    if existing:
        raise HTTPException(409, "Stock record already exists for this product and store")

    stock = InventoryStock(
        product_id=product.id,
        store_id=store.id,
        quantity=stock_data.quantity,
        reorder_level=stock_data.reorder_level,
    )

    db.add(stock)

    if stock_data.quantity > 0:
        movement = InventoryMovement(
            business_id=current_user.business_id,
            product_id=product.id,
            store_id=store.id,
            user_id=current_user.id,
            movement_type="stock_in",
            quantity_change=stock_data.quantity,
            quantity_before=0,
            quantity_after=stock_data.quantity,
            note="Initial stock allocation",
        )
        db.add(movement)

    db.commit()
    db.refresh(stock)

    return stock





@router.get("/stock", response_model=list[StockResponse])
def list_stock(
    store_id: str | None = None,
    low_stock: bool = False,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = (
        db.query(InventoryStock)
        .join(Store, InventoryStock.store_id == Store.id)
        .join(Product, InventoryStock.product_id == Product.id)
        .filter(
            Store.business_id == current_user.business_id,
            Product.business_id == current_user.business_id,
)
    )

    if store_id:
        get_authorized_store(store_id, current_user, db)
        query = query.filter(InventoryStock.store_id == store_id)
    elif current_user.role not in {"business_owner", "super_admin"}:
        query = query.filter(
            Store.user_access.any(user_id=current_user.id)
        )

    if low_stock:
        query = query.filter(
            InventoryStock.quantity <= InventoryStock.reorder_level
        )

    return query.all()





@router.patch("/stock/{stock_id}", response_model=StockResponse)
def adjust_stock(
    stock_id: str,
    adjustment: StockAdjustment,
    current_user=Depends(stock_managers),
    db: Session = Depends(get_db),
):
    stock = db.query(InventoryStock).filter(
        InventoryStock.id == stock_id
    ).first()

    if not stock:
        raise HTTPException(404, "Stock record not found")

    store = get_authorized_store(stock.store_id, current_user, db)

    if current_user.role != "super_admin" and store.business_id != current_user.business_id:
        raise HTTPException(403, "Access denied")

    if adjustment.quantity_change == 0:
        raise HTTPException(400, "Quantity change cannot be zero")

    if adjustment.movement_type == "stock_in" and adjustment.quantity_change < 0:
        raise HTTPException(400, "Stock in quantity must be positive")

    if adjustment.movement_type == "stock_out" and adjustment.quantity_change > 0:
        raise HTTPException(400, "Stock out quantity must be negative")

    if adjustment.movement_type == "adjustment" and adjustment.quantity_change == 0:
        raise HTTPException(400, "Adjustment cannot be zero")

    before = stock.quantity
    after = before + adjustment.quantity_change

    if after < 0:
        raise HTTPException(400, "Insufficient stock. Quantity cannot become negative.")

    stock.quantity = after

    movement = InventoryMovement(
        business_id=store.business_id,
        product_id=stock.product_id,
        store_id=stock.store_id,
        user_id=current_user.id,
        movement_type=adjustment.movement_type,
        quantity_change=adjustment.quantity_change,
        quantity_before=before,
        quantity_after=after,
        note=adjustment.note,
    )

    db.add(movement)
    db.commit()
    db.refresh(stock)

    return stock


@router.get("/movements", response_model=list[InventoryMovementResponse])
def list_movements(
    store_id: str | None = None,
    product_id: str | None = None,
    limit: int = Query(default=100, ge=1, le=500),
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(InventoryMovement).filter(
        InventoryMovement.business_id == current_user.business_id
    )

    if store_id:
        get_authorized_store(store_id, current_user, db)
        query = query.filter(InventoryMovement.store_id == store_id)
    elif current_user.role not in {"business_owner", "super_admin"}:
        query = query.filter(
            InventoryMovement.store_id.in_(
                db.query(Store.id).filter(
                    Store.user_access.any(user_id=current_user.id)
                )
            )
        )

    if product_id:
        query = query.filter(
            InventoryMovement.product_id == product_id
        )

    return query.order_by(
        InventoryMovement.created_at.desc()
    ).limit(limit).all()
