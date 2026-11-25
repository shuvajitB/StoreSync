
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies.auth import get_current_user, require_roles
from app.models import Store, User, UserStoreAccess
from app.schemas.schemas import StoreCreate, StoreResponse, StoreUpdate


router = APIRouter(prefix="/stores", tags=["Stores"])


def get_authorized_store(
    store_id: str,
    current_user: User,
    db: Session,
) -> Store:
    """Return a store only if the current user may access it."""

    query = db.query(Store).filter(Store.id == store_id)

    if current_user.role != "super_admin":
        query = query.filter(
            Store.business_id == current_user.business_id
        )

    store = query.first()

    if not store:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Store not found.",
        )

    if current_user.role not in ["business_owner", "super_admin"]:
        access = db.query(UserStoreAccess).filter(
            UserStoreAccess.user_id == current_user.id,
            UserStoreAccess.store_id == store.id,
        ).first()

        if not access:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have access to this store.",
            )

    return store


@router.get("/", response_model=list[StoreResponse])
def get_stores(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(Store)

    if current_user.role != "super_admin":
        query = query.filter(
            Store.business_id == current_user.business_id
        )

    if current_user.role not in ["business_owner", "super_admin"]:
        accessible_store_ids = (
            db.query(UserStoreAccess.store_id)
            .filter(UserStoreAccess.user_id == current_user.id)
            .subquery()
        )

        query = query.filter(Store.id.in_(accessible_store_ids))

    return query.order_by(Store.name).all()


@router.get("/{store_id}", response_model=StoreResponse)
def get_store(
    store_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return get_authorized_store(store_id, current_user, db)


@router.post(
    "/",
    response_model=StoreResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_store(
    store_data: StoreCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles("business_owner", "super_admin")
    ),
):
    existing_store = db.query(Store).filter(
        Store.business_id == current_user.business_id,
        Store.code == store_data.code,
    ).first()

    if existing_store:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A store with this code already exists.",
        )

    new_store = Store(
        business_id=current_user.business_id,
        name=store_data.name,
        code=store_data.code,
        address=store_data.address,
        city=store_data.city,
        province=store_data.province,
    )

    db.add(new_store)
    db.commit()
    db.refresh(new_store)

    return new_store


@router.patch("/{store_id}", response_model=StoreResponse)
def update_store(
    store_id: str,
    store_data: StoreUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles("business_owner", "super_admin")
    ),
):
    store = get_authorized_store(store_id, current_user, db)

    updates = store_data.model_dump(exclude_unset=True)

    if not updates:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No changes were provided.",
        )

    if "code" in updates:
        duplicate = db.query(Store).filter(
            Store.business_id == store.business_id,
            Store.code == updates["code"],
            Store.id != store.id,
        ).first()

        if duplicate:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Another store already uses this code.",
            )

    for field, value in updates.items():
        setattr(store, field, value)

    db.commit()
    db.refresh(store)

    return store
