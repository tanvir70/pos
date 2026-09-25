from datetime import datetime
from decimal import Decimal
from fastapi import HTTPException, status
from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.inventory import (
    InventoryLot,
    StockAdjustment,
    StockInventory,
    StockMovement,
)
from app.models.product import Product
from app.schemas.base import PagedResponse
from app.schemas.inventory import (
    InventoryLotDto,
    LotEntryRequest,
    QuarantineDisposalRequest,
    QuarantineStockResponse,
    StockAdjustmentRequest,
    StockAdjustmentResponse,
    StockItemResponse,
    StockMovementDto,
    StockValuationSummaryDto,
)
from app.services.sequence_service import get_next_sequence

async def record_lot_entry(db: AsyncSession, request: LotEntryRequest) -> InventoryLotDto:
    # 1. Verify product exists
    product_res = await db.execute(select(Product).where(Product.id == request.product_id))
    product = product_res.scalar_one_or_none()
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Product with ID {request.product_id} not found",
        )

    # 2. Check barcode uniqueness
    existing_lot = (
        await db.execute(select(InventoryLot).where(InventoryLot.barcode == request.barcode.strip()))
    ).scalar_one_or_none()
    if existing_lot:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Barcode '{request.barcode}' is already in use by lot {existing_lot.lot_number}",
        )

    # 2b. Standardize sequential LOT-01 naming if lot_number is blank or DEFAULT
    import re
    lot_num = (request.lot_number or "").strip()
    if not lot_num or lot_num.upper() in ("DEFAULT", "INITIAL", ""):
        existing_lots_res = await db.execute(
            select(InventoryLot.lot_number).where(InventoryLot.product_id == request.product_id)
        )
        existing_lots = existing_lots_res.scalars().all()
        max_n = 0
        for ln in existing_lots:
            if not ln:
                continue
            m = re.match(r"^LOT-(\d+)$", ln.strip(), re.IGNORECASE)
            if m:
                try:
                    n = int(m.group(1))
                    if n > max_n:
                        max_n = n
                except ValueError:
                    pass
        lot_num = f"LOT-{str(max_n + 1).zfill(2)}"

    # 3. Create lot
    lot = InventoryLot(
        product_id=request.product_id,
        lot_number=lot_num,
        entry_date=request.entry_date,
        expiry_date=request.expiry_date,
        purchase_cost=request.purchase_cost,
        lot_retail_price=request.lot_retail_price,
        lot_wholesale_price=request.lot_wholesale_price,
        barcode=request.barcode.strip(),
        supplier_name=request.supplier_name,
        challan_no=request.challan_no,
    )
    db.add(lot)
    await db.flush()

    # 4. Create Stock in DOKAN
    stock = StockInventory(
        lot_id=lot.id,
        location=request.location or "DOKAN",
        quantity=request.quantity,
    )
    db.add(stock)

    # 5. Record movement
    movement = StockMovement(
        product_id=product.id,
        lot_id=lot.id,
        movement_time=datetime.now(),
        movement_type="LOT_INWARD",
        location=request.location or "DOKAN",
        quantity_change=request.quantity,
        balance_before=Decimal("0.000"),
        balance_after=request.quantity,
        unit=product.base_unit,
        reference_doc_no=request.challan_no,
        remarks=f"Inward received from {request.supplier_name or 'Supplier'}",
        performed_by="System",
    )
    db.add(movement)
    await db.flush()

    return InventoryLotDto(
        id=lot.id,
        product_id=lot.product_id,
        product_code=product.product_code,
        product_name_en=product.name_en,
        lot_number=lot.lot_number,
        entry_date=lot.entry_date,
        expiry_date=lot.expiry_date,
        purchase_cost=lot.purchase_cost,
        lot_retail_price=lot.lot_retail_price,
        lot_wholesale_price=lot.lot_wholesale_price,
        barcode=lot.barcode,
        supplier_name=lot.supplier_name,
        challan_no=lot.challan_no,
        created_at=lot.created_at,
    )

async def get_stock_overview(db: AsyncSession, in_stock_only: bool = False) -> list[StockItemResponse]:
    stmt = (
        select(InventoryLot)
        .options(selectinload(InventoryLot.product), selectinload(InventoryLot.stocks))
        .order_by(InventoryLot.expiry_date.asc())
    )
    lots = (await db.execute(stmt)).scalars().all()

    items: list[StockItemResponse] = []
    for lot in lots:
        p = lot.product
        dokan_qty = Decimal("0.000")
        quarantine_qty = Decimal("0.000")
        for s in lot.stocks:
            if s.location == "DOKAN":
                dokan_qty += s.quantity
            elif s.location == "QUARANTINE":
                quarantine_qty += s.quantity

        if in_stock_only and dokan_qty <= Decimal("0.000"):
            continue

        items.append(
            StockItemResponse(
                product_id=p.id,
                product_code=p.product_code,
                product_name_en=p.name_en,
                product_name_bn=p.name_bn,
                category=p.category,
                base_unit=p.base_unit,
                carton_multiplier=p.carton_multiplier,
                default_barcode=p.default_barcode,
                buying_price=p.buying_price,
                lot_id=lot.id,
                lot_number=lot.lot_number,
                entry_date=lot.entry_date,
                expiry_date=lot.expiry_date,
                purchase_cost=lot.purchase_cost,
                lot_retail_price=lot.lot_retail_price,
                lot_wholesale_price=lot.lot_wholesale_price,
                barcode=lot.barcode,
                quantity=dokan_qty,
                quarantine_quantity=quarantine_qty,
            )
        )
    return items

async def get_lots_by_product(
    db: AsyncSession, product_id: int | None = None, fefo: bool = True
) -> list[InventoryLotDto]:
    stmt = select(InventoryLot).options(selectinload(InventoryLot.product))
    if product_id:
        stmt = stmt.where(InventoryLot.product_id == product_id)
    if fefo:
        stmt = stmt.order_by(InventoryLot.expiry_date.asc())
    else:
        stmt = stmt.order_by(InventoryLot.id.desc())

    lots = (await db.execute(stmt)).scalars().all()
    return [
        InventoryLotDto(
            id=lot.id,
            product_id=lot.product_id,
            product_code=lot.product.product_code if lot.product else None,
            product_name_en=lot.product.name_en if lot.product else None,
            lot_number=lot.lot_number,
            entry_date=lot.entry_date,
            expiry_date=lot.expiry_date,
            purchase_cost=lot.purchase_cost,
            lot_retail_price=lot.lot_retail_price,
            lot_wholesale_price=lot.lot_wholesale_price,
            barcode=lot.barcode,
            supplier_name=lot.supplier_name,
            challan_no=lot.challan_no,
            created_at=lot.created_at,
        )
        for lot in lots
    ]

async def get_quarantine_stock_overview(db: AsyncSession) -> list[QuarantineStockResponse]:
    stmt = (
        select(StockInventory)
        .where(StockInventory.location == "QUARANTINE", StockInventory.quantity > Decimal("0.000"))
        .options(
            selectinload(StockInventory.lot).selectinload(InventoryLot.product)
        )
    )
    stocks = (await db.execute(stmt)).scalars().all()
    res: list[QuarantineStockResponse] = []
    for s in stocks:
        lot = s.lot
        p = lot.product
        loss = (s.quantity * lot.purchase_cost).quantize(Decimal("0.01"))
        res.append(
            QuarantineStockResponse(
                lot_id=lot.id,
                product_id=p.id,
                product_code=p.product_code,
                product_name_en=p.name_en,
                lot_number=lot.lot_number,
                expiry_date=lot.expiry_date,
                barcode=lot.barcode,
                quarantine_quantity=s.quantity,
                purchase_cost=lot.purchase_cost,
                estimated_loss=loss,
            )
        )
    return res

async def dispose_quarantine_stock(db: AsyncSession, req: QuarantineDisposalRequest) -> None:
    stmt = select(StockInventory).where(
        StockInventory.lot_id == req.lot_id, StockInventory.location == "QUARANTINE"
    ).options(selectinload(StockInventory.lot).selectinload(InventoryLot.product))
    stock = (await db.execute(stmt)).scalar_one_or_none()
    if not stock or stock.quantity < req.quantity:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Insufficient quarantine stock for disposal",
        )

    before = stock.quantity
    stock.quantity -= req.quantity
    after = stock.quantity

    lot = stock.lot
    p = lot.product
    loss = (req.quantity * lot.purchase_cost).quantize(Decimal("0.01"))

    # Generate 7-digit adjustment code
    adj_no = await get_next_sequence(db, "stock_adjustment")
    adj = StockAdjustment(
        adjustment_no=adj_no,
        adjustment_date=datetime.now(),
        product_id=p.id,
        lot_id=lot.id,
        adjustment_type="QUARANTINE_DISPOSAL",
        quantity=req.quantity,
        unit=p.base_unit,
        action_type="SCRAP_DISCARD",
        cost_price=lot.purchase_cost,
        total_loss_value=loss,
        reason=req.reason,
        performed_by=req.performed_by or "Admin",
    )
    db.add(adj)

    movement = StockMovement(
        product_id=p.id,
        lot_id=lot.id,
        movement_time=datetime.now(),
        movement_type="DAMAGE_WRITEOFF",
        location="QUARANTINE",
        quantity_change=-req.quantity,
        balance_before=before,
        balance_after=after,
        unit=p.base_unit,
        reference_doc_no=adj_no,
        remarks=f"Disposed: {req.reason}",
        performed_by=req.performed_by or "Admin",
    )
    db.add(movement)
    await db.flush()

async def record_stock_adjustment(
    db: AsyncSession, req: StockAdjustmentRequest
) -> StockAdjustmentResponse:
    # 1. Fetch Product and Lot
    prod = (await db.execute(select(Product).where(Product.id == req.product_id))).scalar_one_or_none()
    if not prod:
        raise HTTPException(status_code=404, detail="Product not found")

    lot = (await db.execute(select(InventoryLot).where(InventoryLot.id == req.lot_id))).scalar_one_or_none()
    if not lot:
        raise HTTPException(status_code=404, detail="Lot not found")

    # 2. Deduct from DOKAN
    stmt = select(StockInventory).where(
        StockInventory.lot_id == lot.id, StockInventory.location == "DOKAN"
    )
    dokan_stock = (await db.execute(stmt)).scalar_one_or_none()
    if not dokan_stock or dokan_stock.quantity < req.quantity:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Insufficient stock in Dokan for adjustment",
        )

    before_dokan = dokan_stock.quantity
    dokan_stock.quantity -= req.quantity
    after_dokan = dokan_stock.quantity

    # 3. Handle move to quarantine if specified
    if req.action_type == "MOVE_TO_QUARANTINE":
        q_stmt = select(StockInventory).where(
            StockInventory.lot_id == lot.id, StockInventory.location == "QUARANTINE"
        )
        q_stock = (await db.execute(q_stmt)).scalar_one_or_none()
        if not q_stock:
            q_stock = StockInventory(lot_id=lot.id, location="QUARANTINE", quantity=Decimal("0.000"))
            db.add(q_stock)
        before_q = q_stock.quantity
        q_stock.quantity += req.quantity
        after_q = q_stock.quantity

    # 4. Generate adjustment record (7 digits)
    adj_no = await get_next_sequence(db, "stock_adjustment")
    total_loss = (req.quantity * lot.purchase_cost).quantize(Decimal("0.01"))

    adj = StockAdjustment(
        adjustment_no=adj_no,
        adjustment_date=datetime.now(),
        product_id=prod.id,
        lot_id=lot.id,
        adjustment_type=req.adjustment_type,
        quantity=req.quantity,
        unit=prod.base_unit,
        action_type=req.action_type,
        cost_price=lot.purchase_cost,
        total_loss_value=total_loss,
        reason=req.reason,
        performed_by=req.performed_by or "Admin",
    )
    db.add(adj)

    # 5. Record movement(s)
    mov1 = StockMovement(
        product_id=prod.id,
        lot_id=lot.id,
        movement_time=datetime.now(),
        movement_type="ADJUSTMENT",
        location="DOKAN",
        quantity_change=-req.quantity,
        balance_before=before_dokan,
        balance_after=after_dokan,
        unit=prod.base_unit,
        reference_doc_no=adj_no,
        remarks=f"Adjustment: {req.reason}",
        performed_by=req.performed_by or "Admin",
    )
    db.add(mov1)

    if req.action_type == "MOVE_TO_QUARANTINE":
        mov2 = StockMovement(
            product_id=prod.id,
            lot_id=lot.id,
            movement_time=datetime.now(),
            movement_type="QUARANTINE_IN",
            location="QUARANTINE",
            quantity_change=req.quantity,
            balance_before=before_q,
            balance_after=after_q,
            unit=prod.base_unit,
            reference_doc_no=adj_no,
            remarks=f"Moved to quarantine: {req.reason}",
            performed_by=req.performed_by or "Admin",
        )
        db.add(mov2)

    await db.flush()

    return StockAdjustmentResponse(
        id=adj.id,
        adjustment_no=adj.adjustment_no,
        adjustment_date=adj.adjustment_date,
        product_id=prod.id,
        product_name=prod.name_en,
        lot_id=lot.id,
        lot_number=lot.lot_number,
        adjustment_type=adj.adjustment_type,
        quantity=adj.quantity,
        unit=adj.unit,
        action_type=adj.action_type,
        cost_price=adj.cost_price,
        total_loss_value=adj.total_loss_value,
        reason=adj.reason,
        performed_by=adj.performed_by,
    )

async def get_stock_adjustments(
    db: AsyncSession, product_id: int | None = None, page: int = 0, size: int = 15
) -> PagedResponse[StockAdjustmentResponse]:
    stmt = (
        select(StockAdjustment)
        .options(selectinload(StockAdjustment.product), selectinload(StockAdjustment.lot))
        .order_by(desc(StockAdjustment.adjustment_date))
    )
    count_stmt = select(func.count(StockAdjustment.id))
    if product_id:
        stmt = stmt.where(StockAdjustment.product_id == product_id)
        count_stmt = count_stmt.where(StockAdjustment.product_id == product_id)

    total_elements = (await db.execute(count_stmt)).scalar() or 0
    total_pages = (total_elements + size - 1) // size if total_elements > 0 else 0

    results = (await db.execute(stmt.offset(page * size).limit(size))).scalars().all()

    content = [
        StockAdjustmentResponse(
            id=a.id,
            adjustment_no=a.adjustment_no,
            adjustment_date=a.adjustment_date,
            product_id=a.product_id,
            product_name=a.product.name_en if a.product else "",
            lot_id=a.lot_id,
            lot_number=a.lot.lot_number if a.lot else "",
            adjustment_type=a.adjustment_type,
            quantity=a.quantity,
            unit=a.unit,
            action_type=a.action_type,
            cost_price=a.cost_price,
            total_loss_value=a.total_loss_value,
            reason=a.reason,
            performed_by=a.performed_by,
        )
        for a in results
    ]

    return PagedResponse(
        content=content,
        page_number=page,
        page_size=size,
        total_elements=total_elements,
        total_pages=total_pages,
        first=(page == 0),
        last=(page >= total_pages - 1 or total_pages == 0),
    )

async def get_stock_movements(
    db: AsyncSession,
    product_id: int | None = None,
    lot_id: int | None = None,
    page: int = 0,
    size: int = 20,
    start_date: str | None = None,
    end_date: str | None = None,
) -> PagedResponse[StockMovementDto]:
    stmt = (
        select(StockMovement)
        .options(selectinload(StockMovement.product), selectinload(StockMovement.lot))
        .order_by(desc(StockMovement.movement_time))
    )
    count_stmt = select(func.count(StockMovement.id))
    if product_id:
        stmt = stmt.where(StockMovement.product_id == product_id)
        count_stmt = count_stmt.where(StockMovement.product_id == product_id)
    if lot_id:
        stmt = stmt.where(StockMovement.lot_id == lot_id)
        count_stmt = count_stmt.where(StockMovement.lot_id == lot_id)
    if start_date:
        try:
            sd = datetime.fromisoformat(start_date)
            stmt = stmt.where(StockMovement.movement_time >= sd)
            count_stmt = count_stmt.where(StockMovement.movement_time >= sd)
        except Exception:
            pass
    if end_date:
        try:
            ed = datetime.fromisoformat(end_date)
            if len(end_date) <= 10:
                ed = ed.replace(hour=23, minute=59, second=59)
            stmt = stmt.where(StockMovement.movement_time <= ed)
            count_stmt = count_stmt.where(StockMovement.movement_time <= ed)
        except Exception:
            pass

    total_elements = (await db.execute(count_stmt)).scalar() or 0
    total_pages = (total_elements + size - 1) // size if total_elements > 0 else 0

    results = (await db.execute(stmt.offset(page * size).limit(size))).scalars().all()

    content = [
        StockMovementDto(
            id=m.id,
            product_id=m.product_id,
            product_name_en=m.product.name_en if m.product else None,
            lot_id=m.lot_id,
            lot_number=m.lot.lot_number if m.lot else None,
            movement_time=m.movement_time,
            movement_type=m.movement_type,
            location=m.location,
            quantity_change=m.quantity_change,
            balance_before=m.balance_before,
            balance_after=m.balance_after,
            unit=m.unit,
            reference_doc_no=m.reference_doc_no,
            remarks=m.remarks,
            performed_by=m.performed_by,
        )
        for m in results
    ]

    return PagedResponse(
        content=content,
        page_number=page,
        page_size=size,
        total_elements=total_elements,
        total_pages=total_pages,
        first=(page == 0),
        last=(page >= total_pages - 1 or total_pages == 0),
    )

async def get_stock_valuation(db: AsyncSession) -> StockValuationSummaryDto:
    # 1. Total products
    total_prods = (await db.execute(select(func.count(Product.id)))).scalar() or 0

    # 2. Query all lots with dokan stock
    stmt = (
        select(InventoryLot)
        .options(selectinload(InventoryLot.stocks))
    )
    lots = (await db.execute(stmt)).scalars().all()

    total_lots = len(lots)
    total_units = Decimal("0.000")
    total_cost = Decimal("0.00")
    total_retail = Decimal("0.00")

    for lot in lots:
        for s in lot.stocks:
            if s.location == "DOKAN" and s.quantity > Decimal("0.000"):
                total_units += s.quantity
                total_cost += (s.quantity * lot.purchase_cost).quantize(Decimal("0.01"))
                total_retail += (s.quantity * lot.lot_retail_price).quantize(Decimal("0.01"))

    gross_margin = total_retail - total_cost

    return StockValuationSummaryDto(
        total_products=total_prods,
        total_lots=total_lots,
        total_stock_units=total_units,
        total_cost_valuation=total_cost,
        total_retail_valuation=total_retail,
        potential_gross_margin=gross_margin,
    )
