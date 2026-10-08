from typing import Any
from datetime import date, datetime
from decimal import Decimal
from pydantic import Field, field_validator, model_validator
from app.schemas.base import CamelModel

class InventoryLotDto(CamelModel):
    id: int
    product_id: int
    product_code: str | None = None
    product_name_en: str | None = None
    lot_number: str
    entry_date: date
    expiry_date: date
    purchase_cost: Decimal
    lot_retail_price: Decimal
    lot_wholesale_price: Decimal
    barcode: str
    supplier_name: str | None = None
    challan_no: str | None = None
    created_at: datetime | None = None
    carton_multiplier: Decimal | None = None

class LotEntryRequest(CamelModel):
    product_id: int = Field(gt=0, description="Master product ID")
    lot_number: str = Field(default="LOT-01", description="Lot batch number, e.g. LOT-01")
    entry_date: date | None = Field(default=None, description="Arrival date, defaults to today")
    expiry_date: date = Field(description="Mandatory expiration date for agricultural chemicals")
    purchase_cost: Decimal = Field(gt=Decimal("0.00"), description="Supplier purchase cost per unit")
    lot_retail_price: Decimal = Field(gt=Decimal("0.00"), description="Mandated MRP retail price per unit")
    lot_wholesale_price: Decimal = Field(gt=Decimal("0.00"), description="Wholesale trade price per unit")
    barcode: str | None = Field(default=None, description="Optional custom barcode. Auto-generated Code 128 if omitted.")
    quantity: Decimal = Field(gt=Decimal("0.000"), description="Total stock quantity to receive in base units")
    location: str = Field(default="DOKAN", description="Stock receiving location")
    supplier_name: str | None = Field(default=None, description="Distributor / vendor name")
    challan_no: str | None = Field(default=None, description="Delivery challan reference")
    save_as_default_carton_size: bool = Field(
        default=False,
        description="Whether to atomically update master product's carton_multiplier and carton prices",
    )
    carton_multiplier: Decimal | None = Field(
        default=None,
        gt=Decimal("0.000"),
        description="Carton packaging multiplier (units per carton) to persist if save_as_default_carton_size is True",
    )

    @field_validator("lot_number")
    @classmethod
    def validate_code(cls, v: str) -> str:
        trimmed = (v or "").strip()
        if not trimmed:
            raise ValueError("Lot number cannot be blank")
        return trimmed

    @field_validator("barcode")
    @classmethod
    def sanitize_barcode(cls, v: str | None) -> str | None:
        if v is None:
            return None
        trimmed = v.strip()
        return trimmed or None

    @field_validator("supplier_name", "challan_no")
    @classmethod
    def sanitize_optional_text(cls, v: str | None) -> str | None:
        if v is None:
            return None
        trimmed = v.strip()
        return trimmed or None

    @model_validator(mode="before")
    @classmethod
    def resolve_defaults(cls, data: Any) -> Any:
        if isinstance(data, dict):
            # Default entry_date to today if missing
            if not data.get("entry_date") and not data.get("entryDate"):
                from datetime import date
                data["entry_date"] = date.today().isoformat()
        return data

    @model_validator(mode="after")
    def validate_dates(self) -> "LotEntryRequest":
        if self.entry_date is None:
            from datetime import date
            self.entry_date = date.today()
        if self.expiry_date < self.entry_date:
            raise ValueError(
                f"Lot expiry date ({self.expiry_date}) cannot be earlier than entry date ({self.entry_date})."
            )
        return self

class StockItemResponse(CamelModel):
    product_id: int
    product_code: str
    product_name_en: str
    product_name_bn: str
    category: str
    base_unit: str
    carton_multiplier: Decimal
    pack_size: str | None = None
    unit_size: str | None = None
    default_barcode: str | None = None
    buying_price: Decimal | None = None
    carton_wholesale_price: Decimal | None = None
    carton_buying_price: Decimal | None = None

    lot_id: int
    lot_number: str
    entry_date: date
    expiry_date: date
    purchase_cost: Decimal
    lot_retail_price: Decimal
    lot_wholesale_price: Decimal
    barcode: str

    quantity: Decimal
    quarantine_quantity: Decimal = Decimal("0.000")

class QuarantineStockResponse(CamelModel):
    lot_id: int
    product_id: int
    product_code: str
    product_name_en: str
    lot_number: str
    expiry_date: date
    barcode: str
    quarantine_quantity: Decimal
    purchase_cost: Decimal
    estimated_loss: Decimal

class QuarantineDisposalRequest(CamelModel):
    lot_id: int = Field(gt=0)
    quantity: Decimal = Field(gt=Decimal("0.000"))
    reason: str
    performed_by: str | None = None

    @field_validator("reason")
    @classmethod
    def validate_reason(cls, v: str) -> str:
        trimmed = (v or "").strip()
        if not trimmed:
            raise ValueError("Reason cannot be blank")
        return trimmed

class StockMovementDto(CamelModel):
    id: int
    product_id: int
    product_name_en: str | None = None
    lot_id: int
    lot_number: str | None = None
    movement_time: datetime
    movement_type: str
    location: str
    quantity_change: Decimal
    balance_before: Decimal
    balance_after: Decimal
    unit: str
    reference_doc_no: str | None = None
    remarks: str | None = None
    performed_by: str | None = None

class StockAdjustmentRequest(CamelModel):
    product_id: int = Field(gt=0)
    lot_id: int = Field(gt=0)
    adjustment_type: str
    quantity: Decimal = Field(gt=Decimal("0.000"))
    action_type: str = "SCRAP_DISCARD"  # 'SCRAP_DISCARD' or 'MOVE_TO_QUARANTINE'
    reason: str
    performed_by: str | None = None

    @field_validator("reason", "adjustment_type", "action_type")
    @classmethod
    def validate_adjustment_text(cls, v: str) -> str:
        trimmed = (v or "").strip()
        if not trimmed:
            raise ValueError("Field cannot be blank")
        return trimmed

class StockAdjustmentResponse(CamelModel):
    id: int
    adjustment_no: str
    adjustment_date: datetime
    product_id: int
    product_name: str
    lot_id: int
    lot_number: str
    adjustment_type: str
    quantity: Decimal
    unit: str
    action_type: str
    cost_price: Decimal
    total_loss_value: Decimal
    reason: str
    performed_by: str | None = None

class StockValuationSummaryDto(CamelModel):
    total_products: int
    total_lots: int
    total_stock_units: Decimal
    total_cost_valuation: Decimal
    total_retail_valuation: Decimal
    potential_gross_margin: Decimal
