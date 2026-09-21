from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas.customer import (
    CustomerDto,
    CustomerLedgerDto,
    CustomerPaymentRequest,
    CustomerRequest,
)
from app.schemas.sale import SaleResponse
from app.services import customer_service, sale_service
from app.services.sequence_service import get_next_sequence


router = APIRouter(prefix="/api/customers", tags=["customers"])

@router.get("/next-due-invoice-no")
async def get_next_due_invoice_no(db: AsyncSession = Depends(get_db)) -> dict[str, str]:
    # 7-digit due invoice sequence
    due_no = await get_next_sequence(db, "due_invoice")
    return {"dueInvoiceNo": due_no}

@router.post("", response_model=CustomerDto, status_code=status.HTTP_201_CREATED)
async def create_customer(
    body: CustomerRequest,
    db: AsyncSession = Depends(get_db),
) -> CustomerDto:
    return await customer_service.create_customer(db, body)

@router.get("", response_model=list[CustomerDto])
async def search_customers(
    query: str | None = Query(default=None),
    type: str | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
) -> list[CustomerDto]:
    return await customer_service.search_customers(db, query, type)

@router.get("/{customer_id}", response_model=CustomerDto)
async def get_customer(
    customer_id: int,
    db: AsyncSession = Depends(get_db),
) -> CustomerDto:
    return await customer_service.get_customer_by_id(db, customer_id)

@router.put("/{customer_id}", response_model=CustomerDto)
async def update_customer(
    customer_id: int,
    body: CustomerRequest,
    db: AsyncSession = Depends(get_db),
) -> CustomerDto:
    return await customer_service.update_customer(db, customer_id, body)

@router.get("/{customer_id}/ledger", response_model=list[CustomerLedgerDto])
async def get_customer_ledger(
    customer_id: int,
    db: AsyncSession = Depends(get_db),
) -> list[CustomerLedgerDto]:
    return await customer_service.get_customer_ledger(db, customer_id)

@router.get("/{customer_id}/purchases", response_model=list[SaleResponse])
async def get_customer_purchases(
    customer_id: int,
    db: AsyncSession = Depends(get_db),
) -> list[SaleResponse]:
    return await sale_service.get_customer_purchases(db, customer_id)

@router.post("/{customer_id}/payments", response_model=CustomerLedgerDto, status_code=status.HTTP_201_CREATED)
async def record_payment(
    customer_id: int,
    body: CustomerPaymentRequest,
    db: AsyncSession = Depends(get_db),
) -> CustomerLedgerDto:
    return await customer_service.record_customer_payment(db, customer_id, body)

