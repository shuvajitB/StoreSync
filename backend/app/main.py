
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import auth, stores, products, inventory
from app.core.config import settings
from app.database import Base, engine
from app import models
from app.seed import seed_database


@asynccontextmanager
async def lifespan(app: FastAPI):
    if settings.ENVIRONMENT.lower() != "production":
        Base.metadata.create_all(bind=engine)
        seed_database()

    yield


app = FastAPI(
    title="StoreSync API",
    description="Multi-store retail management platform",
    version="1.0.0",
    lifespan=lifespan,
)


allowed_origins = [
    origin.strip()
    for origin in settings.FRONTEND_URL.split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(auth.router, prefix="/api/v1")
app.include_router(stores.router, prefix="/api/v1")
app.include_router(products.router, prefix="/api/v1")
app.include_router(inventory.router, prefix="/api/v1")


@app.get("/")
def root():
    return {
        "message": "Welcome to StoreSync API",
        "version": "1.0.0",
    }


@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "application": "StoreSync",
    }
