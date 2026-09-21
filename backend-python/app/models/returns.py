from datetime import datetime
from decimal import Decimal
from sqlalchemy import (
    BigInteger,
    Boolean,
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

class SaleReturn(Base):
    __tablename__ = "sale_return"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    return_no: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    original_sale_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("sale.id", ondelete="SET NULL"), nullable=True
    )
    customer_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("customer.id", ondelete="SET NULL"), nullable=True, index=True
    )
    return_date: Mapped[datetime] = mapped_column(
        DateTime, default=func.current_timestamp(), nullable=False, index=True
    )
    total_refund_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    refund_type: Mapped[str] = mapped_column(String(30), nullable=False)  # 'CASH_REFUND' or 'DUE_ADJUSTMENT'
    reason: Mapped[str | None] = mapped_column(Text, nullable=True)

    original_sale = relationship("Sale", lazy="joined")
    customer = relationship("Customer", lazy="joined")
    items = relationship("SaleReturnItem", back_populates="sale_return", cascade="all, delete-orphan", lazy="selectin")

class SaleReturnItem(Base):
    __tablename__ = "sale_return_item"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    sale_return_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("sale_return.id", ondelete="CASCADE"), nullable=False, index=True
    )
    lot_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("inventory_lot.id", ondelete="RESTRICT"), nullable=False, index=True
    )

    quantity: Mapped[Decimal] = mapped_column(Numeric(12, 3), nullable=False)
    refund_price: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    is_damaged: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    restock_location: Mapped[str] = mapped_column(String(20), default="DOKAN", nullable=False)

    sale_return = relationship("SaleReturn", back_populates="items")
    lot = relationship("InventoryLot", lazy="joined")
