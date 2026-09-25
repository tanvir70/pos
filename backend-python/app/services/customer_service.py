from datetime import datetime
from decimal import Decimal
from fastapi import HTTPException, status
from sqlalchemy import desc, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core_logging import get_logger
from app.models.customer import Customer, CustomerLedger
from app.schemas.customer import (
    CustomerDto,
    CustomerLedgerDto,
    CustomerPaymentRequest,
    CustomerRequest,
)
from app.services.sequence_service import get_next_sequence

logger = get_logger("customer")

def to_customer_dto(c: Customer) -> CustomerDto:
    return CustomerDto(
        id=c.id,
        name=c.name,
        father_name=c.father_name,
        business_name=c.business_name,
        phone=c.phone,
        whatsapp_number=c.whatsapp_number,
        email=c.email,
        village_address=c.village_address,
        land_area=c.land_area,
        customer_type=c.customer_type,
        total_purchases=c.total_purchases,
        current_due=c.current_due,
        mfs_type=c.mfs_type,
        mfs_number=c.mfs_number,
        bank_name=c.bank_name,
        bank_branch=c.bank_branch,
        bank_account_no=c.bank_account_no,
        created_at=c.created_at,
    )

def to_ledger_dto(l: CustomerLedger) -> CustomerLedgerDto:
    return CustomerLedgerDto(
        id=l.id,
        customer_id=l.customer_id,
        transaction_date=l.transaction_date,
        transaction_type=l.transaction_type,
        debit=l.debit,
        credit=l.credit,
        balance_after=l.balance_after,
        money_receipt_no=l.money_receipt_no,
        sale_id=l.sale_id,
        notes=l.notes,
        client_trx_id=l.client_trx_id,
    )

async def create_customer(db: AsyncSession, req: CustomerRequest) -> CustomerDto:
    # Check duplicate phone
    existing = (
        await db.execute(select(Customer).where(Customer.phone == req.phone.strip()))
    ).scalar_one_or_none()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Customer with phone '{req.phone}' already exists",
        )

    initial_due = Decimal("0.00")
    if req.current_due is not None:
        initial_due = req.current_due
    elif req.initial_due is not None:
        initial_due = req.initial_due

    customer = Customer(
        name=req.name.strip(),
        father_name=req.father_name,
        business_name=req.business_name,
        phone=req.phone.strip(),
        whatsapp_number=req.whatsapp_number.strip() if req.whatsapp_number else req.phone.strip(),
        email=req.email,
        village_address=req.village_address,
        land_area=req.land_area,
        customer_type=(req.customer_type or "RETAIL").upper(),
        total_purchases=Decimal("0.00"),
        current_due=initial_due,
        mfs_type=req.mfs_type,
        mfs_number=req.mfs_number,
        bank_name=req.bank_name,
        bank_branch=req.bank_branch,
        bank_account_no=req.bank_account_no,
    )
    db.add(customer)
    await db.flush()

    if initial_due > Decimal("0.00"):
        ledger = CustomerLedger(
            customer_id=customer.id,
            transaction_date=datetime.now(),
            transaction_type="INVOICE_BILL",
            debit=initial_due,
            credit=Decimal("0.00"),
            balance_after=initial_due,
            notes="Opening due balance on customer registration",
        )
        db.add(ledger)
        await db.flush()

    return to_customer_dto(customer)

async def update_customer(db: AsyncSession, customer_id: int, req: CustomerRequest) -> CustomerDto:
    c = (await db.execute(select(Customer).where(Customer.id == customer_id))).scalar_one_or_none()
    if not c:
        raise HTTPException(status_code=404, detail=f"Customer with id {customer_id} not found")

    if req.phone and req.phone.strip() != c.phone:
        existing = (
            await db.execute(
                select(Customer).where(Customer.phone == req.phone.strip(), Customer.id != customer_id)
            )
        ).scalar_one_or_none()
        if existing:
            raise HTTPException(
                status_code=400, detail=f"Customer with phone '{req.phone}' already exists"
            )
        c.phone = req.phone.strip()

    c.name = req.name.strip()
    if req.father_name is not None:
        c.father_name = req.father_name
    if req.business_name is not None:
        c.business_name = req.business_name
    if req.whatsapp_number is not None:
        c.whatsapp_number = req.whatsapp_number.strip()
    if req.email is not None:
        c.email = req.email
    if req.village_address is not None:
        c.village_address = req.village_address
    if req.land_area is not None:
        c.land_area = req.land_area
    if req.customer_type is not None:
        c.customer_type = req.customer_type.upper()
    if req.mfs_type is not None:
        c.mfs_type = req.mfs_type
    if req.mfs_number is not None:
        c.mfs_number = req.mfs_number
    if req.bank_name is not None:
        c.bank_name = req.bank_name
    if req.bank_branch is not None:
        c.bank_branch = req.bank_branch
    if req.bank_account_no is not None:
        c.bank_account_no = req.bank_account_no

    await db.flush()
    return to_customer_dto(c)

async def search_customers(
    db: AsyncSession, query: str | None = None, customer_type: str | None = None
) -> list[CustomerDto]:
    stmt = select(Customer)
    if query and query.strip():
        q = f"%{query.strip()}%"
        stmt = stmt.where(
            or_(
                Customer.name.ilike(q),
                Customer.phone.ilike(q),
                Customer.business_name.ilike(q),
            )
        )
    if customer_type and customer_type.strip():
        stmt = stmt.where(Customer.customer_type == customer_type.strip().upper())

    stmt = stmt.order_by(Customer.name.asc())
    results = (await db.execute(stmt)).scalars().all()
    return [to_customer_dto(c) for c in results]

async def get_customer_by_id(db: AsyncSession, customer_id: int) -> CustomerDto:
    c = (await db.execute(select(Customer).where(Customer.id == customer_id))).scalar_one_or_none()
    if not c:
        raise HTTPException(status_code=404, detail=f"Customer with id {customer_id} not found")
    return to_customer_dto(c)

async def get_customer_ledger(db: AsyncSession, customer_id: int) -> list[CustomerLedgerDto]:
    c = (await db.execute(select(Customer).where(Customer.id == customer_id))).scalar_one_or_none()
    if not c:
        raise HTTPException(status_code=404, detail=f"Customer with id {customer_id} not found")

    stmt = (
        select(CustomerLedger)
        .where(CustomerLedger.customer_id == customer_id)
        .order_by(desc(CustomerLedger.transaction_date), desc(CustomerLedger.id))
    )
    entries = (await db.execute(stmt)).scalars().all()
    return [to_ledger_dto(e) for e in entries]

async def record_customer_payment(
    db: AsyncSession, customer_id: int, req: CustomerPaymentRequest, client_trx_id: str | None = None
) -> CustomerLedgerDto:
    effective_key = (req.client_trx_id or client_trx_id or "").strip() or None
    if effective_key:
        existing_stmt = select(CustomerLedger).where(
            CustomerLedger.customer_id == customer_id,
            CustomerLedger.client_trx_id == effective_key,
        )
        existing_res = await db.execute(existing_stmt)
        existing_entry = existing_res.scalar_one_or_none()
        if existing_entry:
            logger.info(
                "Idempotent replay for customer payment: key=%s, ledger_id=%s",
                effective_key,
                existing_entry.id,
            )
            return to_ledger_dto(existing_entry)

    c = (await db.execute(select(Customer).where(Customer.id == customer_id))).scalar_one_or_none()
    if not c:
        raise HTTPException(status_code=404, detail=f"Customer with id {customer_id} not found")

    amount = req.amount
    new_due = c.current_due - amount
    c.current_due = new_due

    method = (req.payment_method or "CASH").upper()
    if method in ("BKASH", "NAGAD", "ROCKET"):
        trx_type = "MFS_PAYMENT"
    elif "BANK" in method:
        trx_type = "BANK_TRANSFER"
    else:
        trx_type = "CASH_PAYMENT"

    # 7-digit due receipt number
    receipt_no = req.money_receipt_no
    if not receipt_no or not receipt_no.strip():
        receipt_no = await get_next_sequence(db, "due_invoice")

    ledger = CustomerLedger(
        customer_id=c.id,
        transaction_date=datetime.now(),
        transaction_type=trx_type,
        debit=Decimal("0.00"),
        credit=amount,
        balance_after=new_due,
        money_receipt_no=receipt_no,
        notes=req.notes,
        client_trx_id=effective_key,
    )
    db.add(ledger)
    try:
        await db.flush()
    except IntegrityError as ex:
        if effective_key:
            await db.rollback()
            logger.warning(
                "Race collision detected on customer payment client_trx_id=%s. Replaying committed entry.",
                effective_key,
            )
            existing_entry = (
                await db.execute(
                    select(CustomerLedger).where(
                        CustomerLedger.customer_id == customer_id,
                        CustomerLedger.client_trx_id == effective_key,
                    )
                )
            ).scalar_one_or_none()
            if existing_entry:
                return to_ledger_dto(existing_entry)
        raise

    return to_ledger_dto(ledger)
