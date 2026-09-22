from datetime import datetime
from decimal import Decimal
from sqlalchemy import (
    BigInteger,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base

class Customer(Base):
    __tablename__ = "customer"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    version: Mapped[int] = mapped_column(BigInteger, default=0, nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    father_name: Mapped[str | None] = mapped_column(String(150), nullable=True)
    business_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    phone: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    whatsapp_number: Mapped[str | None] = mapped_column(String(50), nullable=True)
    email: Mapped[str | None] = mapped_column(String(100), nullable=True)
    village_address: Mapped[str | None] = mapped_column(String(255), nullable=True)
    customer_type: Mapped[str] = mapped_column(String(30), default="RETAIL", nullable=False)
    credit_limit: Mapped[Decimal] = mapped_column(
        Numeric(12, 2), default=Decimal("0.00"), nullable=False
    )
    current_due: Mapped[Decimal] = mapped_column(
        Numeric(12, 2), default=Decimal("0.00"), nullable=False
    )
    total_purchases: Mapped[Decimal] = mapped_column(
        Numeric(12, 2), default=Decimal("0.00"), nullable=False
    )
    mfs_type: Mapped[str | None] = mapped_column(String(30), nullable=True)
    mfs_number: Mapped[str | None] = mapped_column(String(50), nullable=True)
    bank_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    bank_branch: Mapped[str | None] = mapped_column(String(100), nullable=True)
    bank_account_no: Mapped[str | None] = mapped_column(String(100), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=func.current_timestamp(), nullable=False
    )

    ledger_entries = relationship("CustomerLedger", back_populates="customer", cascade="all, delete-orphan")

class CustomerLedger(Base):
    __tablename__ = "customer_ledger"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    customer_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("customer.id", ondelete="CASCADE"), nullable=False, index=True
    )

    transaction_date: Mapped[datetime] = mapped_column(
        DateTime, default=func.current_timestamp(), nullable=False, index=True
    )
    transaction_type: Mapped[str] = mapped_column(String(50), nullable=False)
    debit: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=Decimal("0.00"), nullable=False)
    credit: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=Decimal("0.00"), nullable=False)
    balance_after: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    money_receipt_no: Mapped[str | None] = mapped_column(String(50), nullable=True)
    sale_id: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    client_trx_id: Mapped[str | None] = mapped_column(String(64), unique=True, nullable=True, index=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    customer = relationship("Customer", back_populates="ledger_entries", lazy="joined")
