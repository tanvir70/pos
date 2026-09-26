from datetime import datetime
from decimal import Decimal
from pydantic import Field, field_validator
from app.schemas.base import CamelModel

class SaleReturnItemRequest(CamelModel):
    lot_id: int = Field(gt=0)
    quantity: Decimal = Field(gt=Decimal("0.000"))
    refund_price: Decimal = Field(ge=Decimal("0.00"))
    is_damaged: bool = False
    restock_location: str = "DOKAN"

    @field_validator("restock_location")
    @classmethod
    def validate_location(cls, v: str) -> str:
        return (v or "DOKAN").strip().upper()

class SaleReturnRequest(CamelModel):
    original_sale_id: int | None = Field(default=None, gt=0)
    customer_id: int | None = Field(default=None, gt=0)
    refund_type: str = "CASH_REFUND"  # 'CASH_REFUND' or 'DUE_ADJUSTMENT'
    reason: str | None = None
    client_trx_id: str | None = None
    items: list[SaleReturnItemRequest] = Field(min_length=1)

    @field_validator("refund_type")
    @classmethod
    def validate_refund_type(cls, v: str) -> str:
        cleaned = (v or "CASH_REFUND").strip().upper()
        if cleaned not in ("CASH_REFUND", "DUE_ADJUSTMENT"):
            raise ValueError("Refund type must be CASH_REFUND or DUE_ADJUSTMENT")
        return cleaned

    @field_validator("reason", "client_trx_id")
    @classmethod
    def sanitize_strings(cls, v: str | None) -> str | None:
        if v is None:
            return None
        trimmed = v.strip()
        return trimmed or None

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
