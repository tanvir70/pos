from datetime import datetime
from decimal import Decimal
from pydantic import Field, field_validator
from app.schemas.base import CamelModel

class ProductDto(CamelModel):
    id: int | None = None
    product_code: str
    name_en: str
    name_bn: str
    company_name: str = "Agro Chem"
    category: str
    base_unit: str
    carton_multiplier: Decimal = Field(default=Decimal("1.000"), ge=Decimal("0.001"))
    default_barcode: str | None = None
    standard_retail_price: Decimal = Field(default=Decimal("0.00"), ge=Decimal("0.00"))
    standard_wholesale_price: Decimal | None = None
    buying_price: Decimal | None = None
    min_stock_alert: int = 5
    image_path: str | None = None
    created_at: datetime | None = None

class ProductCreateDto(CamelModel):
    product_code: str
    name_en: str
    name_bn: str
    company_name: str = "Agro Chem"
    category: str
    base_unit: str
    carton_multiplier: Decimal = Field(default=Decimal("1.000"), ge=Decimal("0.001"))
    default_barcode: str | None = None
    standard_retail_price: Decimal = Field(ge=Decimal("0.00"))
    standard_wholesale_price: Decimal | None = Field(default=None, ge=Decimal("0.00"))
    buying_price: Decimal | None = Field(default=None, ge=Decimal("0.00"))
    min_stock_alert: int = Field(default=5, ge=0)
    image_path: str | None = None

    @field_validator("product_code", "name_en", "name_bn")
    @classmethod
    def validate_non_empty(cls, v: str) -> str:
        trimmed = (v or "").strip()
        if not trimmed:
            raise ValueError("Field cannot be empty")
        return trimmed

    @field_validator("category", "base_unit", "company_name", "default_barcode")
    @classmethod
    def sanitize_strings(cls, v: str | None) -> str | None:
        if v is None:
            return None
        trimmed = v.strip()
        return trimmed or None

class ProductUpdateDto(CamelModel):
    name_en: str | None = None
    name_bn: str | None = None
    company_name: str | None = None
    category: str | None = None
    base_unit: str | None = None
    carton_multiplier: Decimal | None = None
    default_barcode: str | None = None
    standard_retail_price: Decimal | None = None
    standard_wholesale_price: Decimal | None = None
    buying_price: Decimal | None = None
    min_stock_alert: int | None = None
    image_path: str | None = None
