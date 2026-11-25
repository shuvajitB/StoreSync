from pydantic import BaseModel, ConfigDict, EmailStr, Field


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    business_id: str
    full_name: str
    email: EmailStr
    role: str
    is_active: bool


class StoreResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    business_id: str
    name: str
    code: str
    address: str | None = None
    city: str | None = None
    province: str | None = None
    is_active: bool


class StoreCreate(BaseModel):
    name: str
    code: str
    address: str | None = None
    city: str | None = None
    province: str | None = None

class StoreUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=150)
    code: str | None = Field(default=None, min_length=2, max_length=30)
    address: str | None = Field(default=None, max_length=255)
    city: str | None = Field(default=None, max_length=100)
    province: str | None = Field(default=None, max_length=100)
    is_active: bool | None = None
    
    
from datetime import datetime


class ProductCreate(BaseModel):
    name: str = Field(min_length=2, max_length=150)
    sku: str = Field(min_length=2, max_length=50)
    barcode: str | None = Field(default=None, max_length=100)
    category: str | None = Field(default=None, max_length=100)
    description: str | None = None
    unit: str = Field(default="piece", min_length=1, max_length=30)


class ProductUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=150)
    sku: str | None = Field(default=None, min_length=2, max_length=50)
    barcode: str | None = Field(default=None, max_length=100)
    category: str | None = Field(default=None, max_length=100)
    description: str | None = None
    unit: str | None = Field(default=None, min_length=1, max_length=30)
    is_active: bool | None = None


class ProductResponse(BaseModel):
    id: str
    business_id: str
    name: str
    sku: str
    barcode: str | None
    category: str | None
    description: str | None
    unit: str
    is_active: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class StockCreate(BaseModel):
    product_id: str
    store_id: str
    quantity: int = Field(default=0, ge=0)
    reorder_level: int = Field(default=10, ge=0)


class StockAdjustment(BaseModel):
    quantity_change: int
    movement_type: str = Field(
        pattern="^(stock_in|stock_out|adjustment)$"
    )
    note: str | None = None


class StockResponse(BaseModel):
    id: str
    product_id: str
    store_id: str
    quantity: int
    reorder_level: int

    model_config = ConfigDict(from_attributes=True)


class InventoryMovementResponse(BaseModel):
    id: str
    product_id: str
    store_id: str
    user_id: str
    movement_type: str
    quantity_change: int
    quantity_before: int
    quantity_after: int
    note: str | None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
