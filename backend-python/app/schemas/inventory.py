from datetime import date, datetime
from decimal import Decimal
from pydantic import Field
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

class LotEntryRequest(CamelModel):
    product_id: int
    lot_number: str
    entry_date: date
    expiry_date: date
    purchase_cost: Decimal = Field(gt=Decimal("0.00"))
    lot_retail_price: Decimal = Field(gt=Decimal("0.00"))
    lot_wholesale_price: Decimal = Field(gt=Decimal("0.00"))
    barcode: str
    quantity: Decimal = Field(gt=Decimal("0.000"))
    location: str = "DOKAN"
    supplier_name: str | None = None
    challan_no: str | None = None

class StockItemResponse(CamelModel):
    product_id: int
    product_code: str
    product_name_en: str
    product_name_bn: str
    category: str
    base_unit: str
    carton_multiplier: Decimal
    default_barcode: str | None = None
    buying_price: Decimal | None = None

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
    lot_id: int
    quantity: Decimal = Field(gt=Decimal("0.000"))
    reason: str
    performed_by: str | None = None

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
    product_id: int
    lot_id: int
    adjustment_type: str
    quantity: Decimal = Field(gt=Decimal("0.000"))
    action_type: str = "SCRAP_DISCARD"  # 'SCRAP_DISCARD' or 'MOVE_TO_QUARANTINE'
    reason: str
    performed_by: str | None = None

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
