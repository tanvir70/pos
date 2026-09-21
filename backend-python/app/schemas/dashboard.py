from datetime import date
from decimal import Decimal
from app.schemas.base import CamelModel

class ExpiringLotDto(CamelModel):
    lot_id: int
    product_code: str
    product_name_en: str
    product_name_bn: str
    lot_number: str
    expiry_date: date
    days_until_expiry: int
    quantity: Decimal

class LowStockProductDto(CamelModel):
    product_id: int
    product_code: str
    name_en: str
    name_bn: str
    min_stock_alert: int
    total_stock: Decimal

class TopSellingProductDto(CamelModel):
    product_id: int
    product_code: str
    name_en: str
    name_bn: str
    unit: str
    total_quantity: Decimal
    total_revenue: Decimal
    percentage_share: float | None = 0.0

class DashboardSummaryDto(CamelModel):
    total_sales_today: Decimal
    total_sales_month: Decimal
    total_orders_today: int
    total_returns_today: Decimal
    gross_profit_today: Decimal
    gross_profit_month: Decimal
    cash_in_drawer_today: Decimal
    total_market_due: Decimal
    total_customers: int
    low_stock_count: int
    expiring_soon_count: int
    sales_growth: float | None = 0.0
    orders_growth: float | None = 0.0
    profit_growth: float | None = 0.0
    returns_growth: float | None = 0.0
    expiring_lots: list[ExpiringLotDto] = []
    low_stock_products: list[LowStockProductDto] = []
