from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.product import Product
from app.schemas.product import ProductCreateDto, ProductDto, ProductUpdateDto

router = APIRouter(prefix="/api/products", tags=["products"])

def to_product_dto(p: Product) -> ProductDto:
    return ProductDto(
        id=p.id,
        product_code=p.product_code,
        name_en=p.name_en,
        name_bn=p.name_bn,
        company_name=p.company_name,
        category=p.category,
        base_unit=p.base_unit,
        carton_multiplier=p.carton_multiplier,
        default_barcode=p.default_barcode,
        standard_retail_price=p.standard_retail_price,
        standard_wholesale_price=p.standard_wholesale_price,
        buying_price=p.buying_price,
        min_stock_alert=p.min_stock_alert,
        image_path=p.image_path,
        created_at=p.created_at,
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
        carton_multiplier=body.carton_multiplier,
        default_barcode=body.default_barcode or body.product_code.strip(),
        standard_retail_price=body.standard_retail_price,
        standard_wholesale_price=standard_wholesale_price,
        buying_price=buying_price,
        min_stock_alert=body.min_stock_alert,
        image_path=body.image_path,
    )
    db.add(p)
    await db.flush()
    return to_product_dto(p)

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
