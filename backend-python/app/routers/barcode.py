from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.inventory import InventoryLot
from app.services.barcode_service import generate_code128_png

router = APIRouter(prefix="/api", tags=["barcode"])

@router.get("/barcode/{barcode}", responses={200: {"content": {"image/png": {}}}})
async def get_barcode_image(
    barcode: str,
    width: int = Query(default=300, ge=50, le=1000),
    height: int = Query(default=100, ge=30, le=500),
) -> Response:
    png_bytes = generate_code128_png(barcode.strip(), width=width, height=height)
    return Response(
        content=png_bytes,
        media_type="image/png",
        headers={"Cache-Control": "public, max-age=86400"},
    )

@router.get("/lots/{lot_id}/barcode-image", responses={200: {"content": {"image/png": {}}}})
async def get_lot_barcode_image(
    lot_id: int,
    width: int = Query(default=300, ge=50, le=1000),
    height: int = Query(default=100, ge=30, le=500),
    db: AsyncSession = Depends(get_db),
) -> Response:
    stmt = select(InventoryLot).where(InventoryLot.id == lot_id)
    res = await db.execute(stmt)
    lot = res.scalar_one_or_none()
    if not lot:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=f"Lot not found with id: {lot_id}"
        )

    png_bytes = generate_code128_png(lot.barcode.strip(), width=width, height=height)
    return Response(
        content=png_bytes,
        media_type="image/png",
        headers={"Cache-Control": "public, max-age=86400"},
    )
