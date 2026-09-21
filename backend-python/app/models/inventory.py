from datetime import date, datetime
from decimal import Decimal
from sqlalchemy import (
    BigInteger,
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base

class InventoryLot(Base):
    __tablename__ = "inventory_lot"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    version: Mapped[int] = mapped_column(BigInteger, default=0, nullable=False)
    product_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("product.id", ondelete="CASCADE"), nullable=False, index=True
    )
    lot_number: Mapped[str] = mapped_column(String(50), nullable=False)
    entry_date: Mapped[date] = mapped_column(Date, nullable=False)
    expiry_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    purchase_cost: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    lot_retail_price: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    lot_wholesale_price: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    barcode: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    supplier_name: Mapped[str | None] = mapped_column(String(150), nullable=True)
    challan_no: Mapped[str | None] = mapped_column(String(100), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=func.current_timestamp(), nullable=False
    )

    product = relationship("Product", lazy="joined")
    stocks = relationship("StockInventory", back_populates="lot", cascade="all, delete-orphan")

class StockInventory(Base):
    __tablename__ = "stock_inventory"
    __table_args__ = (UniqueConstraint("lot_id", "location", name="uq_lot_location"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    version: Mapped[int] = mapped_column(BigInteger, default=0, nullable=False)
    lot_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("inventory_lot.id", ondelete="CASCADE"), nullable=False, index=True
    )
    location: Mapped[str] = mapped_column(String(20), default="DOKAN", nullable=False)
    quantity: Mapped[Decimal] = mapped_column(
        Numeric(12, 3), default=Decimal("0.000"), nullable=False
    )

    lot = relationship("InventoryLot", back_populates="stocks", lazy="joined")

class StockMovement(Base):
    __tablename__ = "stock_movement"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    product_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("product.id", ondelete="CASCADE"), nullable=False, index=True
    )
    lot_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("inventory_lot.id", ondelete="CASCADE"), nullable=False, index=True
    )
    movement_time: Mapped[datetime] = mapped_column(
        DateTime, default=func.current_timestamp(), nullable=False, index=True
    )
    movement_type: Mapped[str] = mapped_column(String(40), nullable=False)
    location: Mapped[str] = mapped_column(String(20), default="DOKAN", nullable=False)
    quantity_change: Mapped[Decimal] = mapped_column(Numeric(12, 3), nullable=False)
    balance_before: Mapped[Decimal] = mapped_column(Numeric(12, 3), nullable=False)
    balance_after: Mapped[Decimal] = mapped_column(Numeric(12, 3), nullable=False)
    unit: Mapped[str] = mapped_column(String(30), nullable=False)
    reference_doc_no: Mapped[str | None] = mapped_column(String(100), nullable=True)
    remarks: Mapped[str | None] = mapped_column(String(255), nullable=True)
    performed_by: Mapped[str | None] = mapped_column(String(100), nullable=True)

    product = relationship("Product", lazy="joined")
    lot = relationship("InventoryLot", lazy="joined")

class StockAdjustment(Base):
    __tablename__ = "stock_adjustment"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    adjustment_no: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    adjustment_date: Mapped[datetime] = mapped_column(
        DateTime, default=func.current_timestamp(), nullable=False, index=True
    )
    product_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("product.id", ondelete="CASCADE"), nullable=False
    )
    lot_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("inventory_lot.id", ondelete="CASCADE"), nullable=False
    )

    adjustment_type: Mapped[str] = mapped_column(String(40), nullable=False)
    quantity: Mapped[Decimal] = mapped_column(Numeric(12, 3), nullable=False)
    unit: Mapped[str] = mapped_column(String(30), nullable=False)
    action_type: Mapped[str] = mapped_column(String(30), nullable=False)
    cost_price: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    total_loss_value: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    performed_by: Mapped[str | None] = mapped_column(String(100), nullable=True)

    product = relationship("Product", lazy="joined")
    lot = relationship("InventoryLot", lazy="joined")
