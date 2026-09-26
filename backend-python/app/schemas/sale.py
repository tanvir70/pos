from datetime import datetime
from decimal import Decimal
from pydantic import Field, field_validator
from app.schemas.base import CamelModel

class SaleItemRequest(CamelModel):
    lot_id: int = Field(gt=0)
    total_quantity: Decimal = Field(gt=Decimal("0.000"))
    unit_price: Decimal = Field(ge=Decimal("0.00"))

class SaleRequest(CamelModel):
    customer_id: int | None = Field(default=None, gt=0)
    sale_mode: str = "RETAIL"
    items: list[SaleItemRequest] = Field(min_length=1)
    discount: Decimal = Field(default=Decimal("0.00"), ge=Decimal("0.00"))
    round_off: Decimal = Field(default=Decimal("0.00"), ge=Decimal("0.00"), le=Decimal("50.00"))
    payment_method: str = "CASH"
    cash_paid: Decimal = Field(default=Decimal("0.00"), ge=Decimal("0.00"))
    cash_tendered: Decimal = Field(default=Decimal("0.00"), ge=Decimal("0.00"))
    digital_paid: Decimal = Field(default=Decimal("0.00"), ge=Decimal("0.00"))
    digital_medium: str | None = None
    digital_trx_id: str | None = None
    cashier_name: str | None = None
    client_trx_id: str | None = None

    @field_validator("sale_mode", "payment_method")
    @classmethod
    def validate_code_strings(cls, v: str) -> str:
        return (v or "").strip().upper()

    @field_validator("digital_medium", "digital_trx_id", "cashier_name", "client_trx_id")
    @classmethod
    def sanitize_optional_strings(cls, v: str | None) -> str | None:
        if v is None:
            return None
        trimmed = v.strip()
        return trimmed or None

class SaleItemDetailResponse(CamelModel):
    id: int
    lot_id: int
    lot_number: str
    barcode: str
    product_name_en: str
    product_name_bn: str
    total_quantity: Decimal
    unit_price: Decimal
    unit_cost: Decimal
    subtotal: Decimal
    line_profit: Decimal

class SaleResponse(CamelModel):
    id: int
    invoice_no: str
    sale_date: datetime
    customer_id: int | None = None
    customer_name: str | None = None
    customer_phone: str | None = None
    sale_mode: str
    subtotal: Decimal
    discount: Decimal
    round_off: Decimal
    total_amount: Decimal
    payment_method: str
    cash_paid: Decimal
    cash_tendered: Decimal
    change_amount: Decimal
    digital_paid: Decimal
    digital_medium: str | None = None
    digital_trx_id: str | None = None
    due_amount: Decimal
    cashier_name: str | None = None
    client_trx_id: str | None = None
    total_profit: Decimal
    items: list[SaleItemDetailResponse]
