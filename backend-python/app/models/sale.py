from datetime import datetime
from decimal import Decimal
from sqlalchemy import (
    BigInteger,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base

class Sale(Base):
    __tablename__ = "sale"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    version: Mapped[int] = mapped_column(BigInteger, default=0, nullable=False)
    invoice_no: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    sale_date: Mapped[datetime] = mapped_column(
        DateTime, default=func.current_timestamp(), nullable=False, index=True
    )
    customer_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("customer.id", ondelete="SET NULL"), nullable=True, index=True
    )
    sale_mode: Mapped[str] = mapped_column(String(20), default="RETAIL", nullable=False)
    subtotal: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    discount: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=Decimal("0.00"), nullable=False)
    round_off: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=Decimal("0.00"), nullable=False)
    total_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    payment_method: Mapped[str] = mapped_column(String(30), default="CASH", nullable=False)
    cash_paid: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=Decimal("0.00"), nullable=False)
    cash_tendered: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=Decimal("0.00"), nullable=False)
    change_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=Decimal("0.00"), nullable=False)
    digital_paid: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=Decimal("0.00"), nullable=False)
    digital_medium: Mapped[str | None] = mapped_column(String(30), nullable=True)
    digital_trx_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    due_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=Decimal("0.00"), nullable=False)
    cashier_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    client_trx_id: Mapped[str | None] = mapped_column(String(64), unique=True, nullable=True, index=True)

    customer = relationship("Customer", lazy="joined")
    items = relationship("SaleItem", back_populates="sale", cascade="all, delete-orphan", lazy="selectin")

class SaleItem(Base):
    __tablename__ = "sale_item"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    sale_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("sale.id", ondelete="CASCADE"), nullable=False, index=True
    )
    lot_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("inventory_lot.id", ondelete="RESTRICT"), nullable=False, index=True
    )

    total_quantity: Mapped[Decimal] = mapped_column(Numeric(12, 3), nullable=False)
    unit_price: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    unit_cost: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    subtotal: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)

    sale = relationship("Sale", back_populates="items")
    lot = relationship("InventoryLot", lazy="joined")
