import re
from datetime import datetime
from decimal import Decimal
from pydantic import Field, field_validator
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
    land_area: str | None = None
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
    land_area: str | None = None
    customer_type: str = "RETAIL"
    current_due: Decimal | None = None
    initial_due: Decimal | None = Field(default=None, ge=Decimal("0.00"))
    mfs_type: str | None = None
    mfs_number: str | None = None
    bank_name: str | None = None
    bank_branch: str | None = None
    bank_account_no: str | None = None

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        trimmed = (v or "").strip()
        if not trimmed:
            raise ValueError("Customer name is required and cannot be empty.")
        return trimmed

    @field_validator(
        "father_name",
        "business_name",
        "email",
        "village_address",
        "land_area",
        "bank_name",
        "bank_branch",
        "bank_account_no",
    )
    @classmethod
    def sanitize_optional_text(cls, v: str | None) -> str | None:
        if v is None:
            return None
        trimmed = v.strip()
        return trimmed or None

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Mobile number is required.")
        cleaned = re.sub(r"\D", "", v.strip())
        if cleaned.startswith("880"):
            cleaned = cleaned[2:]
        if not re.fullmatch(r"01[3-9]\d{8}", cleaned):
            raise ValueError(
                "Phone number must be an 11-digit Bangladeshi mobile number starting with 01 (e.g. 017XXXXXXXX)."
            )
        return cleaned

    @field_validator("mfs_number")
    @classmethod
    def validate_mfs_number(cls, v: str | None) -> str | None:
        if not v or not v.strip():
            return None
        cleaned = re.sub(r"\D", "", v.strip())
        return cleaned or None

    @field_validator("whatsapp_number")
    @classmethod
    def validate_whatsapp_number(cls, v: str | None) -> str | None:
        if not v or not v.strip():
            return None
        cleaned = re.sub(r"\D", "", v.strip())
        if cleaned.startswith("880"):
            cleaned = cleaned[2:]
        return cleaned or None

class CustomerPaymentRequest(CamelModel):
    amount: Decimal = Field(gt=Decimal("0.00"))
    payment_method: str = "CASH"
    money_receipt_no: str | None = None
    notes: str | None = None
    client_trx_id: str | None = None

    @field_validator("payment_method")
    @classmethod
    def validate_method(cls, v: str) -> str:
        return (v or "CASH").strip().upper()

    @field_validator("money_receipt_no", "notes", "client_trx_id")
    @classmethod
    def sanitize_strings(cls, v: str | None) -> str | None:
        if v is None:
            return None
        trimmed = v.strip()
        return trimmed or None

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
