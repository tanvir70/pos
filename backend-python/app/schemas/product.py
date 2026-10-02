from datetime import date, datetime
from decimal import Decimal
from pydantic import Field, field_validator, model_validator
from app.constants.units import normalize_unit, extract_carton_multiplier
from app.schemas.base import CamelModel
from app.schemas.inventory import InventoryLotDto

class InitialStockDto(CamelModel):
    quantity: Decimal = Field(gt=Decimal("0.000"), description="Total stock quantity to receive in base units")
    cartons: Decimal | None = Field(default=None, ge=Decimal("0.000"), description="Optional cartons count")
    loose_units: Decimal | None = Field(default=None, ge=Decimal("0.000"), description="Optional loose units count")
    lot_number: str = Field(default="LOT-01", description="Lot batch number, defaults to LOT-01")
    barcode: str | None = Field(default=None, description="Optional custom barcode. Auto-generated Code 128 if omitted.")
    entry_date: date | None = Field(default=None, description="Arrival date, defaults to today")
    expiry_date: date | None = Field(default=None, description="Expiration date, defaults to +2 years")
    purchase_cost: Decimal | None = Field(default=None, gt=Decimal("0.00"), description="Purchase cost per unit")
    lot_retail_price: Decimal | None = Field(default=None, gt=Decimal("0.00"), description="Retail MRP per unit")
    lot_wholesale_price: Decimal | None = Field(default=None, gt=Decimal("0.00"), description="Wholesale trade price per unit")
    supplier_name: str | None = Field(default=None, description="Distributor / vendor name")
    challan_no: str | None = Field(default=None, description="Delivery challan reference")

class ProductDto(CamelModel):
    id: int | None = None
    product_code: str
    name_en: str
    name_bn: str
    company_name: str = "Syngenta Bangladesh Limited"
    category: str
    base_unit: str
    pack_size: str | None = None
    unit_size: str | None = None
    carton_multiplier: Decimal = Field(default=Decimal("1.000"), gt=Decimal("0.000"))
    default_barcode: str | None = None
    standard_retail_price: Decimal = Field(default=Decimal("0.00"), ge=Decimal("0.00"))
    standard_wholesale_price: Decimal | None = None
    buying_price: Decimal | None = None
    carton_wholesale_price: Decimal | None = None
    carton_buying_price: Decimal | None = None
    min_stock_alert: int = 5
    image_path: str | None = None
    created_at: datetime | None = None
    initial_lot: InventoryLotDto | None = None

class ProductCreateDto(CamelModel):
    product_code: str
    name_en: str
    name_bn: str
    company_name: str = "Syngenta Bangladesh Limited"
    category: str
    base_unit: str
    pack_size: str | None = None
    unit_size: str | None = None
    carton_multiplier: Decimal = Field(default=Decimal("1.000"), gt=Decimal("0.000"))
    default_barcode: str | None = None
    standard_retail_price: Decimal = Field(ge=Decimal("0.00"))
    standard_wholesale_price: Decimal | None = Field(default=None, ge=Decimal("0.00"))
    buying_price: Decimal | None = Field(default=None, ge=Decimal("0.00"))
    carton_wholesale_price: Decimal | None = Field(default=None, ge=Decimal("0.00"))
    carton_buying_price: Decimal | None = Field(default=None, ge=Decimal("0.00"))
    min_stock_alert: int = Field(default=5, ge=0)
    image_path: str | None = None
    initial_stock: InitialStockDto | None = None

    @field_validator("product_code", "name_en", "name_bn")
    @classmethod
    def validate_non_empty(cls, v: str) -> str:
        trimmed = (v or "").strip()
        if not trimmed:
            raise ValueError("Field cannot be empty")
        return trimmed

    @field_validator("category", "company_name", "default_barcode", "pack_size", "unit_size")
    @classmethod
    def sanitize_strings(cls, v: str | None) -> str | None:
        if v is None:
            return None
        trimmed = v.strip()
        return trimmed or None

    @field_validator("base_unit")
    @classmethod
    def validate_and_normalize_unit(cls, v: str) -> str:
        return normalize_unit(v)

    @model_validator(mode="after")
    def infer_carton_multiplier(self) -> "ProductCreateDto":
        if self.carton_multiplier == Decimal("1.000") and self.pack_size:
            inferred = extract_carton_multiplier(self.pack_size)
            if inferred and inferred > Decimal("1.000"):
                self.carton_multiplier = inferred
        return self

class ProductUpdateDto(CamelModel):
    name_en: str | None = None
    name_bn: str | None = None
    company_name: str | None = None
    category: str | None = None
    base_unit: str | None = None
    pack_size: str | None = None
    unit_size: str | None = None
    carton_multiplier: Decimal | None = None
    default_barcode: str | None = None
    standard_retail_price: Decimal | None = None
    standard_wholesale_price: Decimal | None = None
    buying_price: Decimal | None = None
    carton_wholesale_price: Decimal | None = None
    carton_buying_price: Decimal | None = None
    min_stock_alert: int | None = None
    image_path: str | None = None

    @field_validator("base_unit")
    @classmethod
    def validate_and_normalize_unit(cls, v: str | None) -> str | None:
        if v is None:
            return None
        return normalize_unit(v)
