from fastapi import APIRouter, Depends, Header, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas.returns import SaleReturnRequest, SaleReturnResponse
from app.services import returns_service

router = APIRouter(prefix="/api/returns", tags=["returns"])

@router.post("", response_model=SaleReturnResponse, status_code=status.HTTP_201_CREATED)
async def create_return(
    body: SaleReturnRequest,
    db: AsyncSession = Depends(get_db),
    x_idempotency_key: str | None = Header(default=None, alias="X-Idempotency-Key"),
) -> SaleReturnResponse:
    return await returns_service.process_return(db, body, client_trx_id=x_idempotency_key)

@router.get("/{return_id}", response_model=SaleReturnResponse)
async def get_return(
    return_id: int,
    db: AsyncSession = Depends(get_db),
) -> SaleReturnResponse:
    return await returns_service.get_return_by_id(db, return_id)

@router.get("", response_model=list[SaleReturnResponse])
async def list_recent_returns(
    limit: int = Query(default=20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
) -> list[SaleReturnResponse]:
    return await returns_service.get_recent_returns(db, limit)
