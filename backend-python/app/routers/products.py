from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.constants.units import UNIT_GROUPS
from app.database import get_db
from app.models.product import Product
from app.schemas.inventory import InventoryLotDto
from app.schemas.product import ProductCreateDto, ProductDto, ProductUpdateDto

router = APIRouter(prefix="/api/products", tags=["products"])

def to_product_dto(p: Product, initial_lot: InventoryLotDto | None = None) -> ProductDto:
    return ProductDto(
        id=p.id,
        product_code=p.product_code,
        name_en=p.name_en,
        name_bn=p.name_bn,
        company_name=p.company_name,
        category=p.category,
        base_unit=p.base_unit,
        pack_size=p.pack_size,
        unit_size=p.unit_size,
        carton_multiplier=p.carton_multiplier,
        default_barcode=p.default_barcode,
        standard_retail_price=p.standard_retail_price,
        standard_wholesale_price=p.standard_wholesale_price,
        buying_price=p.buying_price,
        carton_wholesale_price=p.carton_wholesale_price,
        carton_buying_price=p.carton_buying_price,
        min_stock_alert=p.min_stock_alert,
        image_path=p.image_path,
        created_at=p.created_at,
        initial_lot=initial_lot,
    )

@router.get("", response_model=list[ProductDto])
async def list_products(
    query: str | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
) -> list[ProductDto]:
    stmt = select(Product)
    if query and query.strip():
        q = f"%{query.strip()}%"
        stmt = stmt.where(
            or_(
                Product.name_en.ilike(q),
                Product.name_bn.ilike(q),
                Product.product_code.ilike(q),
            )
        )
    stmt = stmt.order_by(Product.name_en.asc())
    result = await db.execute(stmt)
    products = result.scalars().all()
    return [to_product_dto(p) for p in products]

@router.get("/units")
def get_supported_units():
    """
    Returns the canonical units of measure grouped by category (liquid, weight, container).
    Single source of truth for POS and Inventory UI.
    """
    return UNIT_GROUPS

@router.get("/{product_id}", response_model=ProductDto)
async def get_product_by_id(
    product_id: int,
    db: AsyncSession = Depends(get_db),
) -> ProductDto:
    stmt = select(Product).where(Product.id == product_id)
    res = await db.execute(stmt)
    p = res.scalar_one_or_none()
    if not p:
        raise HTTPException(status_code=404, detail=f"Product with id {product_id} not found")
    return to_product_dto(p)

@router.post("", response_model=ProductDto, status_code=status.HTTP_201_CREATED)
async def create_product(
    body: ProductCreateDto,
    db: AsyncSession = Depends(get_db),
) -> ProductDto:
    existing_stmt = select(Product).where(Product.product_code == body.product_code.strip())
    existing = (await db.execute(existing_stmt)).scalar_one_or_none()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Product with code '{body.product_code}' already exists",
        )

    buying_price = body.buying_price
    standard_wholesale_price = body.standard_wholesale_price
    if standard_wholesale_price is None and body.standard_retail_price is not None:
        standard_wholesale_price = (body.standard_retail_price * Decimal("0.95")).quantize(Decimal("0.01"))
    if buying_price is None and standard_wholesale_price is not None:
        buying_price = standard_wholesale_price

    p = Product(
        product_code=body.product_code.strip(),
        name_en=body.name_en.strip(),
        name_bn=body.name_bn.strip(),
        company_name=body.company_name or "Agro Chem",
        category=body.category.strip(),
        base_unit=body.base_unit.strip(),
        pack_size=body.pack_size,
        unit_size=body.unit_size,
        carton_multiplier=body.carton_multiplier,
        default_barcode=body.default_barcode or body.product_code.strip(),
        standard_retail_price=body.standard_retail_price,
        standard_wholesale_price=standard_wholesale_price,
        buying_price=buying_price,
        carton_wholesale_price=body.carton_wholesale_price,
        carton_buying_price=body.carton_buying_price,
        min_stock_alert=body.min_stock_alert,
        image_path=body.image_path,
    )
    db.add(p)
    await db.flush()

    initial_lot_dto: InventoryLotDto | None = None
    if body.initial_stock and body.initial_stock.quantity > Decimal("0.000"):
        from datetime import date, timedelta
        from pydantic import ValidationError
        from app.schemas.inventory import LotEntryRequest
        from app.services import inventory_service

        today = date.today()
        exp_date = body.initial_stock.expiry_date or (today + timedelta(days=730))
        cost = body.initial_stock.purchase_cost or buying_price or Decimal("1.00")
        ret_price = body.initial_stock.lot_retail_price or p.standard_retail_price or Decimal("1.00")
        ws_price = body.initial_stock.lot_wholesale_price or standard_wholesale_price or ret_price

        clean_code = p.product_code.strip() or str(p.id)
        clean_bc = body.initial_stock.barcode or f"{clean_code}-01"

        try:
            lot_entry = LotEntryRequest(
                product_id=p.id,
                lot_number=body.initial_stock.lot_number or "LOT-01",
                entry_date=body.initial_stock.entry_date or today,
                expiry_date=exp_date,
                purchase_cost=cost,
                lot_retail_price=ret_price,
                lot_wholesale_price=ws_price,
                barcode=clean_bc,
                quantity=body.initial_stock.quantity,
                location="DOKAN",
                supplier_name=body.initial_stock.supplier_name or p.company_name or "Syngenta Bangladesh Limited",
                challan_no=body.initial_stock.challan_no or f"CH-INIT-{p.product_code}",
            )
            initial_lot_dto = await inventory_service.record_lot_entry(db, lot_entry)
        except (ValidationError, ValueError) as val_err:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Initial stock lot validation failed: {val_err}",
            )

    return to_product_dto(p, initial_lot_dto)

@router.put("/{product_id}", response_model=ProductDto)
async def update_product(
    product_id: int,
    body: ProductUpdateDto,
    db: AsyncSession = Depends(get_db),
) -> ProductDto:
    stmt = select(Product).where(Product.id == product_id)
    res = await db.execute(stmt)
    p = res.scalar_one_or_none()
    if not p:
        raise HTTPException(status_code=404, detail=f"Product with id {product_id} not found")

    if body.name_en is not None:
        p.name_en = body.name_en.strip()
    if body.name_bn is not None:
        p.name_bn = body.name_bn.strip()
    if body.company_name is not None:
        p.company_name = body.company_name.strip()
    if body.category is not None:
        p.category = body.category.strip()
    if body.base_unit is not None:
        p.base_unit = body.base_unit.strip()
    if body.pack_size is not None:
        p.pack_size = body.pack_size
    if body.unit_size is not None:
        p.unit_size = body.unit_size
    if body.carton_multiplier is not None:
        p.carton_multiplier = body.carton_multiplier
    if body.default_barcode is not None:
        p.default_barcode = body.default_barcode
    if body.standard_retail_price is not None:
        p.standard_retail_price = body.standard_retail_price
    if body.standard_wholesale_price is not None:
        p.standard_wholesale_price = body.standard_wholesale_price
    if body.buying_price is not None:
        p.buying_price = body.buying_price
    if body.carton_wholesale_price is not None:
        p.carton_wholesale_price = body.carton_wholesale_price
    if body.carton_buying_price is not None:
        p.carton_buying_price = body.carton_buying_price
    if body.min_stock_alert is not None:
        p.min_stock_alert = body.min_stock_alert
    if body.image_path is not None:
        p.image_path = body.image_path

    await db.flush()
    return to_product_dto(p)

@router.delete("/{product_id}")
async def delete_product(
    product_id: int,
    db: AsyncSession = Depends(get_db),
) -> dict:
    stmt = select(Product).where(Product.id == product_id)
    res = await db.execute(stmt)
    p = res.scalar_one_or_none()
    if not p:
        raise HTTPException(status_code=404, detail=f"Product with id {product_id} not found")
    await db.delete(p)
    return {"message": "Product deleted successfully"}
