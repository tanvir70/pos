from datetime import date, datetime, time, timedelta
from decimal import Decimal
from zoneinfo import ZoneInfo
from fastapi import HTTPException
from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config import get_settings
from app.models.customer import Customer, CustomerLedger
from app.models.inventory import InventoryLot, StockInventory
from app.models.product import Product
from app.models.returns import SaleReturn
from app.models.sale import Sale, SaleItem
from app.schemas.base import PagedResponse
from app.schemas.dashboard import (
    DashboardSummaryDto,
    ExpiringLotDto,
    LowStockProductDto,
    TopSellingProductDto,
)

settings = get_settings()

async def get_dashboard_summary(db: AsyncSession) -> DashboardSummaryDto:
    now_bd = datetime.now(ZoneInfo(settings.TIMEZONE))
    today = now_bd.date()
    start_of_today = datetime.combine(today, time.min)
    end_of_today = datetime.combine(today, time.max)
    start_of_month = datetime.combine(today.replace(day=1), time.min)

    # 1. Total Sales Today
    sales_today_stmt = select(
        func.coalesce(func.sum(Sale.total_amount), Decimal("0.00")),
        func.count(Sale.id),
        func.coalesce(func.sum(Sale.cash_paid), Decimal("0.00")),
    ).where(Sale.sale_date >= start_of_today, Sale.sale_date <= end_of_today)
    sales_res = (await db.execute(sales_today_stmt)).first()
    total_sales_today = sales_res[0].quantize(Decimal("0.01"))
    total_orders_today = sales_res[1]
    sales_cash = sales_res[2].quantize(Decimal("0.01"))

    # 2. Total Returns Today
    returns_today_stmt = select(
        func.coalesce(func.sum(SaleReturn.total_refund_amount), Decimal("0.00"))
    ).where(SaleReturn.return_date >= start_of_today, SaleReturn.return_date <= end_of_today)
    total_returns_today = (await db.execute(returns_today_stmt)).scalar() or Decimal("0.00")
    total_returns_today = total_returns_today.quantize(Decimal("0.01"))

    # Refunds cash today
    refunds_cash_stmt = select(
        func.coalesce(func.sum(SaleReturn.total_refund_amount), Decimal("0.00"))
    ).where(
        SaleReturn.return_date >= start_of_today,
        SaleReturn.return_date <= end_of_today,
        SaleReturn.refund_type == "CASH_REFUND",
    )
    refunds_cash = (await db.execute(refunds_cash_stmt)).scalar() or Decimal("0.00")

    # Repayments cash today
    repayments_stmt = select(
        func.coalesce(func.sum(CustomerLedger.credit), Decimal("0.00"))
    ).where(
        CustomerLedger.transaction_date >= start_of_today,
        CustomerLedger.transaction_date <= end_of_today,
        CustomerLedger.transaction_type == "CASH_PAYMENT",
    )
    repayments_cash = (await db.execute(repayments_stmt)).scalar() or Decimal("0.00")

    # Cash in drawer today
    cash_in_drawer = (sales_cash + repayments_cash - refunds_cash).quantize(Decimal("0.01"))

    # 3. Gross Profit Today & Month
    async def calc_gross_profit(start_dt: datetime, end_dt: datetime) -> Decimal:
        items_profit_stmt = (
            select(
                func.coalesce(
                    func.sum((SaleItem.unit_price - SaleItem.unit_cost) * SaleItem.total_quantity),
                    Decimal("0.00"),
                )
            )
            .join(Sale, SaleItem.sale_id == Sale.id)
            .where(Sale.sale_date >= start_dt, Sale.sale_date <= end_dt)
        )
        items_profit = (await db.execute(items_profit_stmt)).scalar() or Decimal("0.00")

        discounts_stmt = select(
            func.coalesce(func.sum(Sale.discount), Decimal("0.00"))
        ).where(Sale.sale_date >= start_dt, Sale.sale_date <= end_dt)
        discounts = (await db.execute(discounts_stmt)).scalar() or Decimal("0.00")

        return (items_profit - discounts).quantize(Decimal("0.01"))

    gross_profit_today = await calc_gross_profit(start_of_today, end_of_today)
    gross_profit_month = await calc_gross_profit(start_of_month, end_of_today)

    # 4. Total Sales Month
    sales_month_stmt = select(
        func.coalesce(func.sum(Sale.total_amount), Decimal("0.00"))
    ).where(Sale.sale_date >= start_of_month, Sale.sale_date <= end_of_today)
    total_sales_month = (await db.execute(sales_month_stmt)).scalar() or Decimal("0.00")
    total_sales_month = total_sales_month.quantize(Decimal("0.01"))

    # 5. Customer total market due & count
    cust_stats_stmt = select(
        func.coalesce(func.sum(Customer.current_due), Decimal("0.00")),
        func.count(Customer.id),
    )
    cust_res = (await db.execute(cust_stats_stmt)).first()
    total_market_due = cust_res[0].quantize(Decimal("0.01"))
    total_customers = cust_res[1]

    # 6. Low stock products
    stock_subq = (
        select(
            InventoryLot.product_id,
            func.coalesce(func.sum(StockInventory.quantity), Decimal("0.000")).label("total_stock"),
        )
        .join(StockInventory, StockInventory.lot_id == InventoryLot.id)
        .where(StockInventory.location == "DOKAN")
        .group_by(InventoryLot.product_id)
        .subquery()
    )
    low_stock_stmt = (
        select(
            Product.id,
            Product.product_code,
            Product.name_en,
            Product.name_bn,
            Product.min_stock_alert,
            func.coalesce(stock_subq.c.total_stock, Decimal("0.000")).label("current_stock"),
        )
        .outerjoin(stock_subq, Product.id == stock_subq.c.product_id)
        .where(func.coalesce(stock_subq.c.total_stock, Decimal("0.000")) <= Product.min_stock_alert)
    )
    low_stock_rows = (await db.execute(low_stock_stmt)).all()
    low_stock_products = [
        LowStockProductDto(
            product_id=r[0],
            product_code=r[1],
            name_en=r[2],
            name_bn=r[3],
            min_stock_alert=r[4],
            total_stock=r[5].quantize(Decimal("0.001")),
        )
        for r in low_stock_rows
    ]

    # 7. Expiring lot alerts (within 30 days)
    cutoff = today + timedelta(days=30)
    expiring_stmt = (
        select(InventoryLot)
        .where(InventoryLot.expiry_date <= cutoff)
        .options(selectinload(InventoryLot.product), selectinload(InventoryLot.stocks))
        .order_by(InventoryLot.expiry_date.asc())
    )
    expiring_lots_all = (await db.execute(expiring_stmt)).scalars().all()
    expiring_lots: list[ExpiringLotDto] = []
    for lot in expiring_lots_all:
        dokan_qty = sum((s.quantity for s in lot.stocks if s.location == "DOKAN"), Decimal("0.000"))
        if dokan_qty > Decimal("0.000"):
            days = (lot.expiry_date - today).days
            expiring_lots.append(
                ExpiringLotDto(
                    lot_id=lot.id,
                    product_code=lot.product.product_code if lot.product else "",
                    product_name_en=lot.product.name_en if lot.product else "",
                    product_name_bn=lot.product.name_bn if lot.product else "",
                    lot_number=lot.lot_number,
                    expiry_date=lot.expiry_date,
                    days_until_expiry=days,
                    quantity=dokan_qty.quantize(Decimal("0.001")),
                )
            )

    return DashboardSummaryDto(
        total_sales_today=total_sales_today,
        total_sales_month=total_sales_month,
        total_orders_today=total_orders_today,
        total_returns_today=total_returns_today,
        gross_profit_today=gross_profit_today,
        gross_profit_month=gross_profit_month,
        cash_in_drawer_today=cash_in_drawer,
        total_market_due=total_market_due,
        total_customers=total_customers,
        low_stock_count=len(low_stock_products),
        expiring_soon_count=len(expiring_lots),
        sales_growth=0.0,
        orders_growth=0.0,
        profit_growth=0.0,
        returns_growth=0.0,
        expiring_lots=expiring_lots,
        low_stock_products=low_stock_products,
    )

async def get_top_selling_products(
    db: AsyncSession, period: str = "month", limit: int = 10
) -> list[TopSellingProductDto]:
    today = date.today()
    if period == "today":
        start_dt = datetime.combine(today, time.min)
    elif period == "week":
        start_dt = datetime.combine(today - timedelta(days=7), time.min)
    elif period == "year":
        start_dt = datetime.combine(today.replace(month=1, day=1), time.min)
    else:  # default 'month'
        start_dt = datetime.combine(today.replace(day=1), time.min)

    stmt = (
        select(
            Product.id,
            Product.product_code,
            Product.name_en,
            Product.name_bn,
            Product.base_unit,
            func.coalesce(func.sum(SaleItem.total_quantity), Decimal("0.000")).label("qty"),
            func.coalesce(func.sum(SaleItem.subtotal), Decimal("0.00")).label("rev"),
        )
        .join(InventoryLot, InventoryLot.product_id == Product.id)
        .join(SaleItem, SaleItem.lot_id == InventoryLot.id)
        .join(Sale, SaleItem.sale_id == Sale.id)
        .where(Sale.sale_date >= start_dt)
        .group_by(Product.id, Product.product_code, Product.name_en, Product.name_bn, Product.base_unit)
        .order_by(desc("rev"))
        .limit(limit)
    )
    rows = (await db.execute(stmt)).all()
    total_rev_all = sum((r[6] for r in rows), Decimal("0.00"))

    res: list[TopSellingProductDto] = []
    for r in rows:
        share = float(r[6] / total_rev_all * 100) if total_rev_all > Decimal("0.00") else 0.0
        res.append(
            TopSellingProductDto(
                product_id=r[0],
                product_code=r[1],
                name_en=r[2],
                name_bn=r[3],
                unit=r[4],
                total_quantity=r[5].quantize(Decimal("0.001")),
                total_revenue=r[6].quantize(Decimal("0.01")),
                percentage_share=round(share, 1),
            )
        )
    return res

async def get_top_selling_products_paged(
    db: AsyncSession, period: str = "month", page: int = 0, size: int = 10
) -> PagedResponse[TopSellingProductDto]:
    all_items = await get_top_selling_products(db, period=period, limit=100)
    total_elements = len(all_items)
    total_pages = (total_elements + size - 1) // size if total_elements > 0 else 0
    start = page * size
    end = start + size
    paged_content = all_items[start:end]

    return PagedResponse(
        content=paged_content,
        page_number=page,
        page_size=size,
        total_elements=total_elements,
        total_pages=total_pages,
        first=(page == 0),
        last=(page >= total_pages - 1 or total_pages == 0),
    )
