from datetime import datetime
from decimal import Decimal
from pydantic import Field
from app.schemas.base import CamelModel

class CustomerDto(CamelModel):
    id: int
    name: str
    father_name: str | None = None
    business_name: str | None = None
    phone: str
    whatsapp_number: str | None = None
    email: str | None = None
    village_address: str | None = None
    customer_type: str = "RETAIL"
    total_purchases: Decimal = Decimal("0.00")
    current_due: Decimal = Decimal("0.00")
    mfs_type: str | None = None
    mfs_number: str | None = None
    bank_name: str | None = None
    bank_branch: str | None = None
    bank_account_no: str | None = None
    created_at: datetime | None = None

class CustomerRequest(CamelModel):
    name: str
    father_name: str | None = None
    business_name: str | None = None
    phone: str
    whatsapp_number: str | None = None
    email: str | None = None
    village_address: str | None = None
    customer_type: str = "RETAIL"
    current_due: Decimal | None = None
    initial_due: Decimal | None = None
    mfs_type: str | None = None
    mfs_number: str | None = None
    bank_name: str | None = None
    bank_branch: str | None = None
    bank_account_no: str | None = None

class CustomerPaymentRequest(CamelModel):
    amount: Decimal = Field(gt=Decimal("0.00"))
    payment_method: str = "CASH"
    money_receipt_no: str | None = None
    notes: str | None = None
    client_trx_id: str | None = None

class CustomerLedgerDto(CamelModel):
    id: int
    customer_id: int
    transaction_date: datetime
    transaction_type: str
    debit: Decimal = Decimal("0.00")
    credit: Decimal = Decimal("0.00")
    balance_after: Decimal
    money_receipt_no: str | None = None
    sale_id: int | None = None
    notes: str | None = None
    client_trx_id: str | None = None
