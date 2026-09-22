from datetime import datetime
from decimal import Decimal
from pydantic import Field
from app.schemas.base import CamelModel

class SaleItemRequest(CamelModel):
    lot_id: int
    total_quantity: Decimal = Field(gt=Decimal("0.000"))
    unit_price: Decimal = Field(ge=Decimal("0.00"))

class SaleRequest(CamelModel):
    customer_id: int | None = None
    sale_mode: str = "RETAIL"
    items: list[SaleItemRequest]
    discount: Decimal = Decimal("0.00")
    round_off: Decimal = Decimal("0.00")
    payment_method: str = "CASH"
    cash_paid: Decimal = Decimal("0.00")
    cash_tendered: Decimal = Decimal("0.00")
    digital_paid: Decimal = Decimal("0.00")
    digital_medium: str | None = None
    digital_trx_id: str | None = None
    cashier_name: str | None = None
    client_trx_id: str | None = None

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
