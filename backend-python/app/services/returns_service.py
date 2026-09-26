from datetime import datetime
from decimal import Decimal
from fastapi import HTTPException, status
from sqlalchemy import desc, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core_logging import get_logger
from app.models.customer import Customer, CustomerLedger
from app.models.inventory import InventoryLot, StockInventory, StockMovement
from app.models.returns import SaleReturn, SaleReturnItem
from app.models.sale import Sale, SaleItem
from app.schemas.returns import (
    SaleReturnItemDto,
    SaleReturnRequest,
    SaleReturnResponse,
)
from app.services.sequence_service import get_next_sequence

logger = get_logger("returns")

def to_return_response(ret: SaleReturn) -> SaleReturnResponse:
    items_dto: list[SaleReturnItemDto] = []
    for it in ret.items:
        lot = it.lot
        p = lot.product if lot else None
        subtotal = (it.refund_price * it.quantity).quantize(Decimal("0.01"))
        items_dto.append(
            SaleReturnItemDto(
                id=it.id,
                lot_id=it.lot_id,
                lot_number=lot.lot_number if lot else "",
                barcode=lot.barcode if lot else "",
                product_name_en=p.name_en if p else "",
                product_name_bn=p.name_bn if p else "",
                quantity=it.quantity,
                refund_price=it.refund_price,
                is_damaged=it.is_damaged,
                restock_location=it.restock_location,
                subtotal=subtotal,
            )
        )

    c = ret.customer
    return SaleReturnResponse(
        id=ret.id,
        return_no=ret.return_no,
        original_sale_id=ret.original_sale_id,
        customer_id=ret.customer_id,
        customer_name=c.name if c else None,
        customer_phone=c.phone if c else None,
        return_date=ret.return_date,
        total_refund_amount=ret.total_refund_amount,
        refund_type=ret.refund_type,
        reason=ret.reason,
        client_trx_id=ret.client_trx_id,
        items=items_dto,
    )

async def process_return(
    db: AsyncSession, req: SaleReturnRequest, client_trx_id: str | None = None
) -> SaleReturnResponse:
    effective_key = (req.client_trx_id or client_trx_id or "").strip() or None
    if effective_key:
        existing_stmt = (
            select(SaleReturn)
            .where(SaleReturn.client_trx_id == effective_key)
            .options(
                selectinload(SaleReturn.customer),
                selectinload(SaleReturn.items).selectinload(SaleReturnItem.lot).selectinload(InventoryLot.product),
            )
        )
        existing_res = await db.execute(existing_stmt)
        existing_return = existing_res.scalar_one_or_none()
        if existing_return:
            logger.info(
                "Idempotent replay for return with client_trx_id=%s (return_no=%s)",
                effective_key,
                existing_return.return_no,
            )
            return to_return_response(existing_return)

    if not req.items:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Sale return must have at least one item"
        )

    refund_type = req.refund_type.strip().upper()
    if refund_type not in ("CASH_REFUND", "DUE_ADJUSTMENT"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid refund type '{refund_type}'. Expected CASH_REFUND or DUE_ADJUSTMENT",
        )

    original_sale: Sale | None = None
    if req.original_sale_id:
        s_res = await db.execute(
            select(Sale)
            .where(Sale.id == req.original_sale_id)
            .options(selectinload(Sale.items), selectinload(Sale.customer))
        )
        original_sale = s_res.scalar_one_or_none()
        if not original_sale:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Original sale with ID {req.original_sale_id} not found",
            )

    customer: Customer | None = None
    if req.customer_id:
        c_res = await db.execute(select(Customer).where(Customer.id == req.customer_id))
        customer = c_res.scalar_one_or_none()
        if not customer:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Customer with ID {req.customer_id} not found",
            )
    elif original_sale and original_sale.customer_id:
        customer = original_sale.customer

    if refund_type == "DUE_ADJUSTMENT" and not customer:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Customer is required for DUE_ADJUSTMENT refund",
        )

    # 7-digit return number: RET-YYYYMMDD-XXXXXXX
    return_no = await get_next_sequence(db, "sale_return")

    total_refund = Decimal("0.00")
    return_items: list[SaleReturnItem] = []

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
                detail=f"Lot not found with ID {it_req.lot_id}",
            )

        qty = it_req.quantity.quantize(Decimal("0.001"))
        refund_price = it_req.refund_price.quantize(Decimal("0.01"))

        # If linked to original sale and refund_price not specified, use original price
        if original_sale and refund_price == Decimal("0.00"):
            for orig_it in original_sale.items:
                if orig_it.lot_id == lot.id:
                    refund_price = orig_it.unit_price
                    break

        line_subtotal = (qty * refund_price).quantize(Decimal("0.01"))
        total_refund += line_subtotal

        # Location routing: Damaged chemicals go to QUARANTINE
        location = "QUARANTINE" if it_req.is_damaged else (it_req.restock_location or "DOKAN").upper()

        stock_res = await db.execute(
            select(StockInventory).where(
                StockInventory.lot_id == lot.id, StockInventory.location == location
            )
        )
        stock = stock_res.scalar_one_or_none()
        if not stock:
            stock = StockInventory(lot_id=lot.id, location=location, quantity=Decimal("0.000"))
            db.add(stock)

        before_stock = stock.quantity.quantize(Decimal("0.001"))
        after_stock = (before_stock + qty).quantize(Decimal("0.001"))
        stock.quantity = after_stock

        movement_type = "RETURN_QUARANTINED" if it_req.is_damaged else "RETURN_RESTOCKED"
        movement = StockMovement(
            product_id=lot.product_id,
            lot_id=lot.id,
            movement_time=datetime.now(),
            movement_type=movement_type,
            location=location,
            quantity_change=qty,
            balance_before=before_stock,
            balance_after=after_stock,
            unit=lot.product.base_unit if lot.product else "Unit",
            reference_doc_no=return_no,
            remarks=f"Customer return ({movement_type}) from {customer.name if customer else 'Walk-in'}",
            performed_by="Cashier",
        )
        db.add(movement)

        ret_item = SaleReturnItem(
            lot_id=lot.id,
            quantity=qty,
            refund_price=refund_price,
            is_damaged=it_req.is_damaged,
            restock_location=location,
        )
        return_items.append(ret_item)

    sale_return = SaleReturn(
        return_no=return_no,
        original_sale_id=original_sale.id if original_sale else None,
        customer_id=customer.id if customer else None,
        return_date=datetime.now(),
        total_refund_amount=total_refund,
        refund_type=refund_type,
        reason=req.reason,
        client_trx_id=effective_key,
    )
    db.add(sale_return)
    try:
        await db.flush()
    except IntegrityError as ex:
        if effective_key:
            await db.rollback()
            logger.warning(
                "Race collision detected on return client_trx_id=%s. Fetching already committed return.",
                effective_key,
            )
            stmt = (
                select(SaleReturn)
                .where(SaleReturn.client_trx_id == effective_key)
                .options(
                    selectinload(SaleReturn.customer),
                    selectinload(SaleReturn.items).selectinload(SaleReturnItem.lot).selectinload(InventoryLot.product),
                )
            )
            existing_return = (await db.execute(stmt)).scalar_one_or_none()
            if existing_return:
                return to_return_response(existing_return)
        raise

    for it in return_items:
        it.sale_return_id = sale_return.id
        db.add(it)

    # If DUE_ADJUSTMENT, deduct due and write ledger entry (due can never be negative)
    if refund_type == "DUE_ADJUSTMENT" and customer:
        customer.current_due = max(Decimal("0.00"), (customer.current_due - total_refund).quantize(Decimal("0.01")))
        ledger = CustomerLedger(
            customer_id=customer.id,
            transaction_date=datetime.now(),
            transaction_type="RETURN_REFUND",
            debit=Decimal("0.00"),
            credit=total_refund,
            balance_after=customer.current_due,
            money_receipt_no=return_no,
            sale_id=original_sale.id if original_sale else None,
            notes=f"Return refund adjustment {return_no}",
        )
        db.add(ledger)

    await db.flush()
    stmt = (
        select(SaleReturn)
        .where(SaleReturn.id == sale_return.id)
        .options(
            selectinload(SaleReturn.customer),
            selectinload(SaleReturn.items).selectinload(SaleReturnItem.lot).selectinload(InventoryLot.product),
        )
    )
    loaded = (await db.execute(stmt)).scalar_one()
    return to_return_response(loaded)

async def get_return_by_id(db: AsyncSession, return_id: int) -> SaleReturnResponse:
    stmt = (
        select(SaleReturn)
        .where(SaleReturn.id == return_id)
        .options(
            selectinload(SaleReturn.customer),
            selectinload(SaleReturn.items).selectinload(SaleReturnItem.lot).selectinload(InventoryLot.product),
        )
    )
    ret = (await db.execute(stmt)).scalar_one_or_none()
    if not ret:
        raise HTTPException(status_code=404, detail=f"Sale return not found with id: {return_id}")
    return to_return_response(ret)

async def get_recent_returns(db: AsyncSession, limit: int = 20) -> list[SaleReturnResponse]:
    stmt = (
        select(SaleReturn)
        .options(
            selectinload(SaleReturn.customer),
            selectinload(SaleReturn.items).selectinload(SaleReturnItem.lot).selectinload(InventoryLot.product),
        )
        .order_by(desc(SaleReturn.return_date))
        .limit(limit)
    )
    returns = (await db.execute(stmt)).scalars().all()
    return [to_return_response(r) for r in returns]
