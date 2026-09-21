from datetime import datetime
from decimal import Decimal
from sqlalchemy import BigInteger, DateTime, Integer, Numeric, String, func
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base


class Product(Base):
    __tablename__ = "product"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    version: Mapped[int] = mapped_column(BigInteger, default=0, nullable=False)
    product_code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    name_en: Mapped[str] = mapped_column(String(255), nullable=False)
    name_bn: Mapped[str] = mapped_column(String(255), nullable=False)
    company_name: Mapped[str] = mapped_column(String(150), default="Agro Chem", nullable=False)
    category: Mapped[str] = mapped_column(String(100), nullable=False)
    base_unit: Mapped[str] = mapped_column(String(30), nullable=False)
    carton_multiplier: Mapped[Decimal] = mapped_column(
        Numeric(10, 3), default=Decimal("1.000"), nullable=False
    )
    default_barcode: Mapped[str | None] = mapped_column(String(100), nullable=True)
    standard_retail_price: Mapped[Decimal] = mapped_column(
        Numeric(12, 2), default=Decimal("0.00"), nullable=False
    )
    standard_wholesale_price: Mapped[Decimal | None] = mapped_column(Numeric(12, 2), nullable=True)
    buying_price: Mapped[Decimal | None] = mapped_column(Numeric(12, 2), nullable=True)
    min_stock_alert: Mapped[int] = mapped_column(Integer, default=5, nullable=False)
    image_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=func.current_timestamp(), nullable=False
    )
