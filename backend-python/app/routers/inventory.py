from typing import Any
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
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
from app.services import inventory_service

router = APIRouter(prefix="/api/inventory", tags=["inventory"])

@router.post("/lots", response_model=InventoryLotDto, status_code=status.HTTP_201_CREATED)
async def record_lot_entry(
    body: LotEntryRequest,
    db: AsyncSession = Depends(get_db),
) -> InventoryLotDto:
    return await inventory_service.record_lot_entry(db, body)

@router.get("/stock", response_model=list[StockItemResponse])
async def get_stock_overview(
    in_stock_only: bool = Query(default=False, alias="inStockOnly"),
    db: AsyncSession = Depends(get_db),
) -> list[StockItemResponse]:
    return await inventory_service.get_stock_overview(db, in_stock_only)

@router.get("/lots", response_model=list[InventoryLotDto])
async def get_lots(
    product_id: int | None = Query(default=None, alias="productId"),
    fefo: bool = Query(default=True),
    db: AsyncSession = Depends(get_db),
) -> list[InventoryLotDto]:
    return await inventory_service.get_lots_by_product(db, product_id, fefo)

@router.get("/quarantine", response_model=list[QuarantineStockResponse])
async def get_quarantine_stock_overview(
    db: AsyncSession = Depends(get_db),
) -> list[QuarantineStockResponse]:
    return await inventory_service.get_quarantine_stock_overview(db)

@router.post("/quarantine/dispose")
async def dispose_quarantine_stock(
    body: QuarantineDisposalRequest,
    db: AsyncSession = Depends(get_db),
) -> dict[str, str]:
    await inventory_service.dispose_quarantine_stock(db, body)
    return {"message": "Quarantine stock disposed successfully"}

@router.post("/adjustments", response_model=StockAdjustmentResponse, status_code=status.HTTP_201_CREATED)
async def record_stock_adjustment(
    body: StockAdjustmentRequest,
    db: AsyncSession = Depends(get_db),
) -> StockAdjustmentResponse:
    return await inventory_service.record_stock_adjustment(db, body)

@router.get("/adjustments", response_model=PagedResponse[StockAdjustmentResponse])
async def get_stock_adjustments(
    product_id: int | None = Query(default=None, alias="productId"),
    page: int = Query(default=0, ge=0),
    size: int = Query(default=15, ge=1),
    db: AsyncSession = Depends(get_db),
) -> PagedResponse[StockAdjustmentResponse]:
    return await inventory_service.get_stock_adjustments(db, product_id, page, size)

@router.get("/movements", response_model=PagedResponse[StockMovementDto])
async def get_stock_movements(
    product_id: int | None = Query(default=None, alias="productId"),
    lot_id: int | None = Query(default=None, alias="lotId"),
    page: int = Query(default=0, ge=0),
    size: int = Query(default=20, ge=1),
    db: AsyncSession = Depends(get_db),
) -> PagedResponse[StockMovementDto]:
    return await inventory_service.get_stock_movements(db, product_id, lot_id, page, size)

@router.get("/valuation", response_model=StockValuationSummaryDto)
async def get_stock_valuation(
    db: AsyncSession = Depends(get_db),
) -> StockValuationSummaryDto:
    return await inventory_service.get_stock_valuation(db)
