
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models import Business, Store, User, UserStoreAccess
from app.core.security import hash_password


STORES = [
    ("Downtown", "ATZ001", "Downtown", "St. John's"),
    ("Avalon Mall", "ATZ002", "Avalon Mall", "St. John's"),
    ("Mount Pearl", "ATZ003", "Mount Pearl", "Mount Pearl"),
    ("Paradise", "ATZ004", "Paradise", "Paradise"),
    ("Torbay", "ATZ005", "Torbay", "Torbay"),
    ("Conception Bay", "ATZ006", "Conception Bay", "Conception Bay South"),
    ("Gander", "ATZ007", "Gander", "Gander"),
    ("Grand Falls", "ATZ008", "Grand Falls", "Grand Falls-Windsor"),
    ("Corner Brook", "ATZ009", "Corner Brook", "Corner Brook"),
    ("Stephenville", "ATZ010", "Stephenville", "Stephenville"),
]


DEMO_USERS = [
    {
        "full_name": "AtoZ Business Owner",
        "email": "admin@atozretail.demo",
        "password": "Admin@12345",
        "role": "business_owner",
        "store_code": None,
    },
    {
        "full_name": "Downtown Store Manager",
        "email": "manager@atozretail.demo",
        "password": "Manager@12345",
        "role": "store_manager",
        "store_code": "ATZ001",
    },
    {
        "full_name": "Downtown Cashier",
        "email": "cashier@atozretail.demo",
        "password": "Cashier@12345",
        "role": "cashier",
        "store_code": "ATZ001",
    },
]


def seed_database():
    db: Session = SessionLocal()

    try:
        # Create or retrieve the demo business.
        business = db.query(Business).filter(
            Business.name == "AtoZ Retail"
        ).first()

        if not business:
            business = Business(name="AtoZ Retail")
            db.add(business)
            db.flush()

        # Create or retrieve the 10 demo stores.
        stores_by_code = {}

        for name, code, address, city in STORES:
            store = db.query(Store).filter(
                Store.business_id == business.id,
                Store.code == code,
            ).first()

            if not store:
                store = Store(
                    business_id=business.id,
                    name=name,
                    code=code,
                    address=address,
                    city=city,
                    province="Newfoundland and Labrador",
                )
                db.add(store)
                db.flush()

            stores_by_code[code] = store

        # Create demo users and their store access.
        for user_data in DEMO_USERS:
            user = db.query(User).filter(
                User.email == user_data["email"]
            ).first()

            if not user:
                user = User(
                    business_id=business.id,
                    full_name=user_data["full_name"],
                    email=user_data["email"],
                    hashed_password=hash_password(user_data["password"]),
                    role=user_data["role"],
                )
                db.add(user)
                db.flush()

            store_code = user_data["store_code"]

            if store_code:
                store = stores_by_code[store_code]

                access = db.query(UserStoreAccess).filter(
                    UserStoreAccess.user_id == user.id,
                    UserStoreAccess.store_id == store.id,
                ).first()

                if not access:
                    db.add(
                        UserStoreAccess(
                            user_id=user.id,
                            store_id=store.id,
                        )
                    )

        db.commit()
        print("StoreSync demo database seeded successfully.")

    except Exception:
        db.rollback()
        raise

    finally:
        db.close()


if __name__ == "__main__":
    seed_database()
