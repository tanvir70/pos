from datetime import date, datetime
from decimal import Decimal
from fastapi import HTTPException, status
from sqlalchemy import desc, func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core_logging import get_logger
from app.models.customer import Customer, CustomerLedger
from app.models.inventory import InventoryLot, StockInventory, StockMovement
from app.models.sale import Sale, SaleItem
from app.schemas.sale import (
    SaleItemDetailResponse,
    SaleRequest,
    SaleResponse,
)
from app.services.sequence_service import get_next_sequence

logger = get_logger("sales")

def to_sale_response(sale: Sale) -> SaleResponse:
    item_responses: list[SaleItemDetailResponse] = []
    total_profit = Decimal("0.00")

    for it in sale.items:
        lot = it.lot
        p = lot.product if lot else None
        line_profit = ((it.unit_price - it.unit_cost) * it.total_quantity).quantize(Decimal("0.01"))
        total_profit += line_profit

        item_responses.append(
            SaleItemDetailResponse(
                id=it.id,
                lot_id=it.lot_id,
                lot_number=(lot.lot_number or "") if lot else "",
                barcode=(lot.barcode or "") if lot else "",
                product_name_en=(p.name_en or "") if p else "",
                product_name_bn=(p.name_bn or "") if p else "",
                total_quantity=it.total_quantity,
                unit_price=it.unit_price,
                unit_cost=it.unit_cost,
                subtotal=it.subtotal,
                line_profit=line_profit,
            )
        )

    # Net gross profit after invoice discount
    total_profit = (total_profit - sale.discount).quantize(Decimal("0.01"))

    c = sale.customer
    return SaleResponse(
        id=sale.id,
        invoice_no=sale.invoice_no,
        sale_date=sale.sale_date,
        customer_id=sale.customer_id,
        customer_name=c.name if c else None,
        customer_phone=c.phone if c else None,
        sale_mode=sale.sale_mode,
        subtotal=sale.subtotal,
        discount=sale.discount,
        round_off=sale.round_off,
        total_amount=sale.total_amount,
        payment_method=sale.payment_method,
        cash_paid=sale.cash_paid or Decimal("0.00"),
        cash_tendered=sale.cash_tendered or Decimal("0.00"),
        change_amount=sale.change_amount or Decimal("0.00"),
        digital_paid=sale.digital_paid or Decimal("0.00"),
        digital_medium=sale.digital_medium,
        digital_trx_id=sale.digital_trx_id,
        due_amount=sale.due_amount or Decimal("0.00"),
        cashier_name=sale.cashier_name,
        client_trx_id=sale.client_trx_id,
        total_profit=total_profit,
        items=item_responses,
    )

async def process_sale(
    db: AsyncSession, req: SaleRequest, client_trx_id: str | None = None
) -> SaleResponse:
    effective_key = (req.client_trx_id or client_trx_id or "").strip() or None
    if effective_key:
        existing_stmt = (
            select(Sale)
            .where(Sale.client_trx_id == effective_key)
            .options(
                selectinload(Sale.customer),
                selectinload(Sale.items).selectinload(SaleItem.lot).selectinload(InventoryLot.product),
            )
        )
        existing_res = await db.execute(existing_stmt)
        existing_sale = existing_res.scalar_one_or_none()
        if existing_sale:
            logger.info(
                "Idempotent replay for sale with client_trx_id=%s (invoice=%s)",
                effective_key,
                existing_sale.invoice_no,
            )
            return to_sale_response(existing_sale)

    if not req.items:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Sale must have at least one item"
        )

    customer: Customer | None = None
    if req.customer_id:
        c_res = await db.execute(select(Customer).where(Customer.id == req.customer_id))
        customer = c_res.scalar_one_or_none()
        if not customer:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Customer not found with id: {req.customer_id}",
            )

    # 1. Generate 7-digit invoice number: INV-YYYYMMDD-XXXXXXX
    invoice_no = await get_next_sequence(db, "sale_invoice")

    subtotal = Decimal("0.00")
    sale_items: list[SaleItem] = []

    for it_req in req.items:
        lot_res = await db.execute(
            select(InventoryLot)
            .where(InventoryLot.id == it_req.lot_id)
            .options(selectinload(InventoryLot.product))
        )
        lot = lot_res.scalar_one_or_none()
        if not lot:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Lot not found with id: {it_req.lot_id}",
            )

        # Pesticide Ordinance 1971: Cannot sell expired lots
        if lot.expiry_date and lot.expiry_date < date.today():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot sell expired lot {lot.lot_number} (expired on {lot.expiry_date}). Agrochemical regulatory violation under Pesticide Ordinance 1971.",
            )

        total_qty = it_req.total_quantity.quantize(Decimal("0.001"))
        if total_qty <= Decimal("0.000"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Total quantity must be greater than zero for lot {lot.lot_number}",
            )

        # Deduct from DOKAN stock
        stock_res = await db.execute(
            select(StockInventory).where(
                StockInventory.lot_id == lot.id, StockInventory.location == "DOKAN"
            )
        )
        dokan_stock = stock_res.scalar_one_or_none()
        if not dokan_stock:
            dokan_stock = StockInventory(lot_id=lot.id, location="DOKAN", quantity=Decimal("0.000"))
            db.add(dokan_stock)

        before_stock = dokan_stock.quantity.quantize(Decimal("0.001"))
        if before_stock < total_qty:
            prod_name = lot.product.name_en if lot.product else "product"
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Requested quantity ({total_qty}) exceeds available stock ({before_stock}) for {prod_name} / lot {lot.lot_number}",
            )

        after_stock = (before_stock - total_qty).quantize(Decimal("0.001"))
        dokan_stock.quantity = after_stock

        # Immutable StockMovement entry
        movement = StockMovement(
            product_id=lot.product_id,
            lot_id=lot.id,
            movement_time=datetime.now(),
            movement_type="SALE",
            location="DOKAN",
            quantity_change=-total_qty,
            balance_before=before_stock,
            balance_after=after_stock,
            unit=lot.product.base_unit if lot.product else "Unit",
            reference_doc_no=invoice_no,
            remarks=f"POS Sale: {customer.name if customer else 'Walk-in Retail'}",
            performed_by=req.cashier_name or "Cashier",
        )
        db.add(movement)

        # Snapshot unitCost
        unit_cost = lot.purchase_cost.quantize(Decimal("0.01"))
        unit_price = it_req.unit_price.quantize(Decimal("0.01"))
        item_subtotal = (unit_price * total_qty).quantize(Decimal("0.01"))
        subtotal += item_subtotal

        sale_item = SaleItem(
            lot_id=lot.id,
            total_quantity=total_qty,
            unit_price=unit_price,
            unit_cost=unit_cost,
            subtotal=item_subtotal,
        )
        sale_items.append(sale_item)

    discount = req.discount.quantize(Decimal("0.01"))
    if discount < Decimal("0.00"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Discount cannot be negative",
        )
    if discount > subtotal:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Discount ({discount}) cannot exceed invoice subtotal ({subtotal})",
        )

    round_off = req.round_off.quantize(Decimal("0.01"))
    if round_off < Decimal("0.00") or round_off > Decimal("50.00"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Round-off must be between 0.00 and 50.00 BDT",
        )

    total_amount = (subtotal - discount - round_off).quantize(Decimal("0.01"))
    if total_amount < Decimal("0.00"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Discount and round-off cannot exceed subtotal ({subtotal})",
        )

    cash_paid = max(Decimal("0.00"), req.cash_paid.quantize(Decimal("0.01")))
    cash_tendered = (
        max(Decimal("0.00"), req.cash_tendered.quantize(Decimal("0.01")))
        if req.cash_tendered > Decimal("0.00")
        else cash_paid
    )
    if cash_tendered < cash_paid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cash tendered ({cash_tendered}) cannot be less than cash paid ({cash_paid})",
        )

    change_amount = Decimal("0.00")
    if cash_tendered > cash_paid:
        change_amount = (cash_tendered - cash_paid).quantize(Decimal("0.01"))

    digital_paid = max(Decimal("0.00"), req.digital_paid.quantize(Decimal("0.01")))
    total_paid = cash_paid + digital_paid
    due_amount = max(Decimal("0.00"), total_amount - total_paid).quantize(Decimal("0.01"))

    if due_amount > Decimal("0.00") and not customer:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot have due amount for anonymous walk-in customer",
        )

    sale = Sale(
        invoice_no=invoice_no,
        sale_date=datetime.now(),
        customer_id=customer.id if customer else None,
        sale_mode=req.sale_mode.upper(),
        subtotal=subtotal,
        discount=discount,
        round_off=round_off,
        total_amount=total_amount,
        payment_method=req.payment_method.upper(),
        cash_paid=cash_paid,
        cash_tendered=cash_tendered,
        change_amount=change_amount,
        digital_paid=digital_paid,
        digital_medium=req.digital_medium,
        digital_trx_id=req.digital_trx_id,
        due_amount=due_amount,
        cashier_name=req.cashier_name,
        client_trx_id=effective_key,
    )
    db.add(sale)
    try:
        await db.flush()
    except IntegrityError as ex:
        if effective_key:
            await db.rollback()
            logger.warning(
                "Race collision detected on client_trx_id=%s. Fetching already committed sale.",
                effective_key,
            )
            stmt = (
                select(Sale)
                .where(Sale.client_trx_id == effective_key)
                .options(
                    selectinload(Sale.customer),
                    selectinload(Sale.items).selectinload(SaleItem.lot).selectinload(InventoryLot.product),
                )
            )
            existing_sale = (await db.execute(stmt)).scalar_one_or_none()
            if existing_sale:
                return to_sale_response(existing_sale)
        raise

    for it in sale_items:
        it.sale_id = sale.id
        db.add(it)

    if customer:
        customer.total_purchases = ((customer.total_purchases or Decimal("0.00")) + total_amount).quantize(Decimal("0.01"))
        if due_amount > Decimal("0.00"):
            customer.current_due = ((customer.current_due or Decimal("0.00")) + due_amount).quantize(Decimal("0.01"))
            ledger = CustomerLedger(
                customer_id=customer.id,
                transaction_date=datetime.now(),
                transaction_type="INVOICE_BILL",
                debit=due_amount,
                credit=Decimal("0.00"),
                balance_after=customer.current_due,
                sale_id=sale.id,
                notes=f"Invoice bill {sale.invoice_no} credit balance",
            )
            db.add(ledger)

    await db.flush()
    # Refresh to load relationships
    stmt = (
        select(Sale)
        .where(Sale.id == sale.id)
        .options(
            selectinload(Sale.customer),
            selectinload(Sale.items).selectinload(SaleItem.lot).selectinload(InventoryLot.product),
        )
    )
    loaded_sale = (await db.execute(stmt)).scalar_one()
    resp = to_sale_response(loaded_sale)
    logger.info(
        "Sale completed: invoice=%s, total=%s, paid=%s, due=%s, customer=%s",
        resp.invoice_no,
        resp.total_amount,
        (resp.cash_paid + resp.digital_paid),
        resp.due_amount,
        resp.customer_name or "Walk-in",
    )
    return resp

async def get_sale_by_id(db: AsyncSession, sale_id: int) -> SaleResponse:
    stmt = (
        select(Sale)
        .where(Sale.id == sale_id)
        .options(
            selectinload(Sale.customer),
            selectinload(Sale.items).selectinload(SaleItem.lot).selectinload(InventoryLot.product),
        )
    )
    sale = (await db.execute(stmt)).scalar_one_or_none()
    if not sale:
        raise HTTPException(status_code=404, detail=f"Sale not found with id: {sale_id}")
    return to_sale_response(sale)

async def get_sale_by_invoice(db: AsyncSession, invoice_no: str) -> SaleResponse:
    raw = invoice_no.strip()
    clean = raw.lstrip("#").strip()
    if not clean:
        raise HTTPException(status_code=404, detail="Invoice number cannot be empty")

    options = (
        selectinload(Sale.customer),
        selectinload(Sale.items).selectinload(SaleItem.lot).selectinload(InventoryLot.product),
    )

    # 1. Exact match on raw or clean
    stmt = (
        select(Sale)
        .where(or_(Sale.invoice_no == raw, Sale.invoice_no == clean))
        .options(*options)
    )
    sale = (await db.execute(stmt)).scalar_one_or_none()

    # 2. Suffix / partial match (e.g. searching '217' matches 'INV-20260926-0000217')
    if not sale:
        suffix_stmt = (
            select(Sale)
            .where(
                or_(
                    Sale.invoice_no.ilike(f"%{clean}"),
                    Sale.invoice_no.ilike(f"%-{clean.zfill(7)}"),
                    Sale.invoice_no.ilike(f"%{clean}%"),
                )
            )
            .options(*options)
            .order_by(desc(Sale.sale_date), desc(Sale.id))
        )
        sale = (await db.execute(suffix_stmt)).scalars().first()

    if not sale:
        raise HTTPException(status_code=404, detail=f"Sale not found with invoice: {invoice_no}")
    return to_sale_response(sale)

async def search_sales_by_query(
    db: AsyncSession, query: str, limit: int = 10
) -> list[SaleResponse]:
    raw = query.strip()
    clean = raw.lstrip("#").strip()
    if not clean:
        return []

    max_limit = min(max(1, limit), 50)
    options = (
        selectinload(Sale.customer),
        selectinload(Sale.items).selectinload(SaleItem.lot).selectinload(InventoryLot.product),
    )

    stmt = (
        select(Sale)
        .outerjoin(Sale.customer)
        .where(
            or_(
                Sale.invoice_no.ilike(f"%{clean}%"),
                Customer.name.ilike(f"%{clean}%"),
                Customer.phone.ilike(f"%{clean}%"),
            )
        )
        .options(*options)
        .order_by(desc(Sale.sale_date), desc(Sale.id))
        .limit(max_limit)
    )
    sales = (await db.execute(stmt)).scalars().all()
    return [to_sale_response(s) for s in sales]

async def get_recent_sales(db: AsyncSession, limit: int = 50) -> list[SaleResponse]:
    stmt = (
        select(Sale)
        .options(
            selectinload(Sale.customer),
            selectinload(Sale.items).selectinload(SaleItem.lot).selectinload(InventoryLot.product),
        )
        .order_by(desc(Sale.sale_date))
        .limit(limit)
    )
    sales = (await db.execute(stmt)).scalars().all()
    return [to_sale_response(s) for s in sales]

async def get_sales_paged(
    db: AsyncSession,
    page: int = 0,
    size: int = 10,
    period: str | None = None,
    sale_mode: str | None = None,
):
    from datetime import timedelta
    from app.schemas.base import PagedResponse

    page_index = max(0, page)
    page_size = size if (size > 0 and size <= 100) else 10

    now = datetime.now()
    start_date = None
    if period:
        p = period.lower().strip()
        if p == "today":
            start_date = datetime.combine(now.date(), datetime.min.time())
        elif p == "week":
            start_date = datetime.combine((now - timedelta(days=7)).date(), datetime.min.time())
        elif p == "month":
            start_date = datetime.combine((now - timedelta(days=30)).date(), datetime.min.time())

    filters = []
    if sale_mode and sale_mode.strip() and sale_mode.upper() != "ALL":
        filters.append(Sale.sale_mode == sale_mode.strip().upper())
    if start_date:
        filters.append(Sale.sale_date >= start_date)

    # Count total
    count_stmt = select(func.count(Sale.id))
    if filters:
        count_stmt = count_stmt.where(*filters)
    total_elements = (await db.execute(count_stmt)).scalar() or 0

    # Fetch page
    stmt = (
        select(Sale)
        .options(
            selectinload(Sale.customer),
            selectinload(Sale.items).selectinload(SaleItem.lot).selectinload(InventoryLot.product),
        )
        .order_by(desc(Sale.sale_date))
    )
    if filters:
        stmt = stmt.where(*filters)
    stmt = stmt.offset(page_index * page_size).limit(page_size)

    sales = (await db.execute(stmt)).scalars().all()
    content = [to_sale_response(s) for s in sales]
    total_pages = max(1, (total_elements + page_size - 1) // page_size) if total_elements > 0 else 0

    return PagedResponse[SaleResponse](
        content=content,
        page_number=page_index,
        page_size=page_size,
        total_elements=total_elements,
        total_pages=total_pages,
        first=(page_index == 0),
        last=(page_index >= total_pages - 1 or total_pages == 0),
    )

async def get_customer_purchases(db: AsyncSession, customer_id: int) -> list[SaleResponse]:
    stmt = (
        select(Sale)
        .where(Sale.customer_id == customer_id)
        .options(
            selectinload(Sale.customer),
            selectinload(Sale.items).selectinload(SaleItem.lot).selectinload(InventoryLot.product),
        )
        .order_by(desc(Sale.sale_date))
    )
    sales = (await db.execute(stmt)).scalars().all()
    return [to_sale_response(s) for s in sales]
