from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas.sale import SaleRequest, SaleResponse
from app.services import sale_service

router = APIRouter(prefix="/api/sales", tags=["sales"])

@router.post("", response_model=SaleResponse, status_code=status.HTTP_201_CREATED)
async def create_sale(
    body: SaleRequest,
    db: AsyncSession = Depends(get_db),
) -> SaleResponse:
    return await sale_service.process_sale(db, body)

@router.get("/{sale_id}", response_model=SaleResponse)
async def get_sale(
    sale_id: int,
    db: AsyncSession = Depends(get_db),
) -> SaleResponse:
    return await sale_service.get_sale_by_id(db, sale_id)

@router.get("/invoice/{invoice_no}", response_model=SaleResponse)
async def get_sale_by_invoice(
    invoice_no: str,
    db: AsyncSession = Depends(get_db),
) -> SaleResponse:
    return await sale_service.get_sale_by_invoice(db, invoice_no)

@router.get("")
async def list_sales(
    page: int | None = Query(default=None),
    size: int | None = Query(default=None),
    period: str | None = Query(default=None),
    sale_mode: str | None = Query(default=None, alias="saleMode"),
    limit: int | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
):
    if page is not None or size is not None or period is not None or sale_mode is not None:
        return await sale_service.get_sales_paged(
            db,
            page=page or 0,
            size=size or 10,
            period=period,
            sale_mode=sale_mode,
        )
    max_limit = limit if (limit is not None and limit > 0) else 50
    return await sale_service.get_recent_sales(db, max_limit)
