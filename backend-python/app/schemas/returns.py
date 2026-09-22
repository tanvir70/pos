from datetime import datetime
from decimal import Decimal
from pydantic import Field
from app.schemas.base import CamelModel

class SaleReturnItemRequest(CamelModel):
    lot_id: int
    quantity: Decimal = Field(gt=Decimal("0.000"))
    refund_price: Decimal = Field(ge=Decimal("0.00"))
    is_damaged: bool = False
    restock_location: str = "DOKAN"

class SaleReturnRequest(CamelModel):
    original_sale_id: int | None = None
    customer_id: int | None = None
    refund_type: str = "CASH_REFUND"  # 'CASH_REFUND' or 'DUE_ADJUSTMENT'
    reason: str | None = None
    client_trx_id: str | None = None
    items: list[SaleReturnItemRequest]

class SaleReturnItemDto(CamelModel):
    id: int
    lot_id: int
    lot_number: str
    barcode: str
    product_name_en: str
    product_name_bn: str
    quantity: Decimal
    refund_price: Decimal
    is_damaged: bool
    restock_location: str
    subtotal: Decimal

class SaleReturnResponse(CamelModel):
    id: int
    return_no: str
    original_sale_id: int | None = None
    customer_id: int | None = None
    customer_name: str | None = None
    customer_phone: str | None = None
    return_date: datetime
    total_refund_amount: Decimal
    refund_type: str
    reason: str | None = None
    client_trx_id: str | None = None
    items: list[SaleReturnItemDto]
