from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas.base import PagedResponse
from app.schemas.dashboard import DashboardSummaryDto, TopSellingProductDto
from app.services import dashboard_service

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])

@router.get("/summary", response_model=DashboardSummaryDto)
async def get_summary(db: AsyncSession = Depends(get_db)) -> DashboardSummaryDto:
    return await dashboard_service.get_dashboard_summary(db)

@router.get("/top-selling")
async def get_top_selling(
    period: str = Query(default="month"),
    page: int | None = Query(default=None),
    size: int | None = Query(default=None),
    limit: int | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
):
    if page is not None or size is not None:
        return await dashboard_service.get_top_selling_products_paged(
            db, period=period, page=page or 0, size=size or 10
        )
    if limit is not None:
        return await dashboard_service.get_top_selling_products(db, period=period, limit=limit)
    return await dashboard_service.get_top_selling_products_paged(db, period=period, page=0, size=10)
