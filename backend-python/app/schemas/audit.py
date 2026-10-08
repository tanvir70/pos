from decimal import Decimal
from pydantic import Field
from app.schemas.base import CamelModel

class InvoiceAnomaly(CamelModel):
    sale_id: int
    invoice_no: str
    issue: str
    subtotal: Decimal
    discount: Decimal
    round_off: Decimal
    total_amount: Decimal
    cash_paid: Decimal
    digital_paid: Decimal
    due_amount: Decimal
    calculated_balance: Decimal

class CustomerLedgerAnomaly(CamelModel):
    customer_id: int
    customer_name: str
    stored_due: Decimal
    ledger_due: Decimal
    variance: Decimal
    total_debits: Decimal
    total_credits: Decimal

class InventoryAnomaly(CamelModel):
    lot_id: int
    lot_number: str
    location: str
    quantity: Decimal
    issue: str

class ReturnAnomaly(CamelModel):
    return_id: int
    return_no: str
    original_sale_id: int | None
    refund_amount: Decimal
    original_sale_total: Decimal | None
    cumulative_refunds: Decimal
    issue: str

class FinancialAuditReport(CamelModel):
    status: str  # "HEALTHY" | "DISCREPANCIES_DETECTED"
    audit_timestamp: str
    total_sales_checked: int
    total_customers_checked: int
    total_lots_checked: int
    total_returns_checked: int
    invoice_anomalies: list[InvoiceAnomaly] = Field(default_factory=list)
    ledger_anomalies: list[CustomerLedgerAnomaly] = Field(default_factory=list)
    inventory_anomalies: list[InventoryAnomaly] = Field(default_factory=list)
    return_anomalies: list[ReturnAnomaly] = Field(default_factory=list)

class ReconciliationResult(CamelModel):
    customer_id: int
    customer_name: str
    previous_due: Decimal
    reconciled_due: Decimal
    adjustment_applied: Decimal
    status: str
    notes: str
