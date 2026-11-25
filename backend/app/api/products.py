
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies.auth import get_current_user, require_roles
from app.models import Product
from app.schemas.schemas import (
    ProductCreate,
    ProductUpdate,
    ProductResponse,
)

router = APIRouter(prefix="/products", tags=["Products"])


# Roles allowed to manage the product catalogue
product_managers = require_roles(
    "business_owner",
    "inventory_manager",
    "super_admin",
)


def get_business_product(
    product_id: str,
    current_user,
    db: Session,
):
    product = db.query(Product).filter(
        Product.id == product_id
    ).first()

    if not product:
        raise HTTPException(
            status_code=404,
            detail="Product not found",
        )

    if product.business_id != current_user.business_id:
        raise HTTPException(
            status_code=404,
            detail="Product not found",
        )

    return product


@router.get("/", response_model=list[ProductResponse])
def list_products(
    search: str | None = Query(default=None),
    category: str | None = Query(default=None),
    active_only: bool = True,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(Product).filter(
        Product.business_id == current_user.business_id
    )

    if active_only:
        query = query.filter(Product.is_active.is_(True))

    if category:
        query = query.filter(Product.category.ilike(category))

    if search:
        term = f"%{search.strip()}%"
        query = query.filter(
            (Product.name.ilike(term))
            | (Product.sku.ilike(term))
            | (Product.barcode.ilike(term))
        )

    return query.order_by(Product.name.asc()).all()


@router.get("/{product_id}", response_model=ProductResponse)
def get_product(
    product_id: str,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return get_business_product(product_id, current_user, db)


@router.post(
    "/",
    response_model=ProductResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_product(
    product_data: ProductCreate,
    current_user=Depends(product_managers),
    db: Session = Depends(get_db),
):
    if not current_user.business_id:
        raise HTTPException(
            status_code=400,
            detail="Your account is not associated with a business",
        )

    product = Product(
        business_id=current_user.business_id,
        name=product_data.name.strip(),
        sku=product_data.sku.strip(),
        barcode=product_data.barcode.strip() if product_data.barcode else None,
        category=product_data.category.strip() if product_data.category else None,
        description=product_data.description,
        unit=product_data.unit.strip(),
    )

    db.add(product)

    try:
        db.commit()
        db.refresh(product)
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="A product with this SKU or barcode already exists",
        )

    return product


@router.patch("/{product_id}", response_model=ProductResponse)
def update_product(
    product_id: str,
    product_data: ProductUpdate,
    current_user=Depends(product_managers),
    db: Session = Depends(get_db),
):
    product = get_business_product(product_id, current_user, db)

    updates = product_data.model_dump(exclude_unset=True)

    if not updates:
        raise HTTPException(
            status_code=400,
            detail="No changes provided",
        )

    non_nullable_fields = {
        "name",
        "sku",
        "unit",
        "is_active",
    }

    for field, value in updates.items():
        if field in non_nullable_fields and value is None:
            raise HTTPException(
                status_code=422,
                detail=f"{field} cannot be null",
            )

        if field in {"name", "sku", "unit"} and isinstance(value, str):
            value = value.strip()
            if not value:
                raise HTTPException(
                    status_code=422,
                    detail=f"{field} cannot be empty",
                )

        if field in {"barcode", "category"} and isinstance(value, str):
            value = value.strip() or None

        setattr(product, field, value)

    try:
        db.commit()
        db.refresh(product)
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="A product with this SKU or barcode already exists",
        )

    return product


@router.delete("/{product_id}", response_model=ProductResponse)
def deactivate_product(
    product_id: str,
    current_user=Depends(product_managers),
    db: Session = Depends(get_db),
):
    product = get_business_product(product_id, current_user, db)

    product.is_active = False

    db.commit()
    db.refresh(product)

    return product
