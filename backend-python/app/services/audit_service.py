from datetime import datetime
from decimal import Decimal
from zoneinfo import ZoneInfo
from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config import get_settings
from app.core_logging import get_logger
from app.models.customer import Customer, CustomerLedger
from app.models.inventory import InventoryLot, StockInventory
from app.models.returns import SaleReturn
from app.models.sale import Sale, SaleItem
from app.schemas.audit import (
    CustomerLedgerAnomaly,
    FinancialAuditReport,
    InventoryAnomaly,
    InvoiceAnomaly,
    ReconciliationResult,
    ReturnAnomaly,
)

logger = get_logger("audit")
settings = get_settings()

async def audit_financial_integrity(db: AsyncSession) -> FinancialAuditReport:
    """Exhaustive mathematical and ledger invariant audit across sales, customers, inventory, and returns."""
    now_str = datetime.now(ZoneInfo(settings.TIMEZONE)).isoformat()

    invoice_anomalies: list[InvoiceAnomaly] = []
    ledger_anomalies: list[CustomerLedgerAnomaly] = []
    inventory_anomalies: list[InventoryAnomaly] = []
    return_anomalies: list[ReturnAnomaly] = []

    # 1. Audit Invoices for Mathematical Identity
    sales_stmt = select(Sale).options(selectinload(Sale.items))
    sales_res = await db.execute(sales_stmt)
    sales = sales_res.scalars().all()

    for s in sales:
        items_subtotal = sum(
            (it.unit_price * it.total_quantity).quantize(Decimal("0.01")) for it in s.items
        )
        expected_total = (s.subtotal - s.discount - s.round_off).quantize(Decimal("0.01"))
        settled_balance = (s.cash_paid + s.digital_paid + s.due_amount).quantize(Decimal("0.01"))

        issue_reasons: list[str] = []
        if abs(items_subtotal - s.subtotal) > Decimal("0.01"):
            issue_reasons.append(
                f"Items sum ({items_subtotal}) does not match invoice subtotal ({s.subtotal})"
            )
        if abs(expected_total - s.total_amount) > Decimal("0.01"):
            issue_reasons.append(
                f"Discount/Roundoff math error: expected {expected_total}, got {s.total_amount}"
            )
        if abs(settled_balance - s.total_amount) > Decimal("0.01"):
            issue_reasons.append(
                f"Payment equation mismatch: cash+digital+due ({settled_balance}) != total ({s.total_amount})"
            )

        if issue_reasons:
            invoice_anomalies.append(
                InvoiceAnomaly(
                    sale_id=s.id,
                    invoice_no=s.invoice_no,
                    issue="; ".join(issue_reasons),
                    subtotal=s.subtotal,
                    discount=s.discount,
                    round_off=s.round_off,
                    total_amount=s.total_amount,
                    cash_paid=s.cash_paid,
                    digital_paid=s.digital_paid,
                    due_amount=s.due_amount,
                    calculated_balance=settled_balance,
                )
            )

    # 2. Audit Customer Ledgers vs Stored current_due
    cust_stmt = select(Customer)
    customers = (await db.execute(cust_stmt)).scalars().all()

    for c in customers:
        debits_stmt = (
            select(func.coalesce(func.sum(CustomerLedger.debit), Decimal("0.00")))
            .where(CustomerLedger.customer_id == c.id)
        )
        credits_stmt = (
            select(func.coalesce(func.sum(CustomerLedger.credit), Decimal("0.00")))
            .where(CustomerLedger.customer_id == c.id)
        )
        total_debits = (await db.execute(debits_stmt)).scalar() or Decimal("0.00")
        total_credits = (await db.execute(credits_stmt)).scalar() or Decimal("0.00")
        ledger_due = (total_debits - total_credits).quantize(Decimal("0.01"))
        stored_due = (c.current_due or Decimal("0.00")).quantize(Decimal("0.01"))

        variance = (stored_due - ledger_due).quantize(Decimal("0.01"))
        if abs(variance) > Decimal("0.01"):
            ledger_anomalies.append(
                CustomerLedgerAnomaly(
                    customer_id=c.id,
                    customer_name=c.name,
                    stored_due=stored_due,
                    ledger_due=ledger_due,
                    variance=variance,
                    total_debits=total_debits,
                    total_credits=total_credits,
                )
            )

    # 3. Audit Inventory Quantities for Negative / Orphaned State
    stocks_stmt = select(StockInventory).options(selectinload(StockInventory.lot))
    stocks = (await db.execute(stocks_stmt)).scalars().all()

    for stk in stocks:
        qty = stk.quantity.quantize(Decimal("0.001"))
        if qty < Decimal("0.000"):
            inventory_anomalies.append(
                InventoryAnomaly(
                    lot_id=stk.lot_id,
                    lot_number=stk.lot.lot_number if stk.lot else "Unknown",
                    location=stk.location,
                    quantity=qty,
                    issue="Negative stock detected in location",
                )
            )

    # 4. Audit Returns Cumulative Bounds
    returns_stmt = select(SaleReturn).options(selectinload(SaleReturn.original_sale))
    returns = (await db.execute(returns_stmt)).scalars().all()

    for ret in returns:
        if ret.original_sale_id and ret.original_sale:
            orig = ret.original_sale
            prev_refund_stmt = (
                select(func.coalesce(func.sum(SaleReturn.total_refund_amount), Decimal("0.00")))
                .where(SaleReturn.original_sale_id == orig.id)
            )
            cum_refunds = (await db.execute(prev_refund_stmt)).scalar() or Decimal("0.00")
            if cum_refunds > orig.total_amount:
                return_anomalies.append(
                    ReturnAnomaly(
                        return_id=ret.id,
                        return_no=ret.return_no,
                        original_sale_id=orig.id,
                        refund_amount=ret.total_refund_amount,
                        original_sale_total=orig.total_amount,
                        cumulative_refunds=cum_refunds,
                        issue="Cumulative refunds exceed original sale invoice total",
                    )
                )

    has_anomalies = bool(
        invoice_anomalies or ledger_anomalies or inventory_anomalies or return_anomalies
    )

    return FinancialAuditReport(
        status="DISCREPANCIES_DETECTED" if has_anomalies else "HEALTHY",
        audit_timestamp=now_str,
        total_sales_checked=len(sales),
        total_customers_checked=len(customers),
        total_lots_checked=len(stocks),
        total_returns_checked=len(returns),
        invoice_anomalies=invoice_anomalies,
        ledger_anomalies=ledger_anomalies,
        inventory_anomalies=inventory_anomalies,
        return_anomalies=return_anomalies,
    )

async def reconcile_customer_ledger(db: AsyncSession, customer_id: int) -> ReconciliationResult:
    """Self-healing audit tool: recalculates true ledger balance and synchronizes customer debt."""
    c = (await db.execute(select(Customer).where(Customer.id == customer_id))).scalar_one_or_none()
    if not c:
        raise HTTPException(status_code=404, detail=f"Customer with ID {customer_id} not found")

    debits_stmt = (
        select(func.coalesce(func.sum(CustomerLedger.debit), Decimal("0.00")))
        .where(CustomerLedger.customer_id == customer_id)
    )
    credits_stmt = (
        select(func.coalesce(func.sum(CustomerLedger.credit), Decimal("0.00")))
        .where(CustomerLedger.customer_id == customer_id)
    )
    total_debits = (await db.execute(debits_stmt)).scalar() or Decimal("0.00")
    total_credits = (await db.execute(credits_stmt)).scalar() or Decimal("0.00")
    ledger_due = (total_debits - total_credits).quantize(Decimal("0.01"))
    prev_due = (c.current_due or Decimal("0.00")).quantize(Decimal("0.01"))

    variance = (ledger_due - prev_due).quantize(Decimal("0.01"))

    if abs(variance) < Decimal("0.01"):
        return ReconciliationResult(
            customer_id=c.id,
            customer_name=c.name,
            previous_due=prev_due,
            reconciled_due=prev_due,
            adjustment_applied=Decimal("0.00"),
            status="ALREADY_RECONCILED",
            notes="Customer ledger debits and credits match stored due perfectly.",
        )

    # Apply reconciliation adjustment to synchronize customer current_due with ledger truth
    c.current_due = ledger_due
    c.version = (c.version or 0) + 1

    # Record reconciliation audit journal entry for compliance history without distorting true ledger balance
    adjustment_entry = CustomerLedger(
        customer_id=c.id,
        transaction_date=datetime.now(),
        transaction_type="AUDIT_RECONCILIATION",
        debit=Decimal("0.00"),
        credit=Decimal("0.00"),
        balance_after=ledger_due,
        notes=f"Automated financial reconciliation: synced cached due from {prev_due} to true ledger balance {ledger_due} (drift was {variance})",
    )
    db.add(adjustment_entry)
    await db.flush()

    logger.info(
        "Reconciled customer #%s (%s): previous=%s, new=%s, delta=%s",
        c.id,
        c.name,
        prev_due,
        ledger_due,
        variance,
    )

    return ReconciliationResult(
        customer_id=c.id,
        customer_name=c.name,
        previous_due=prev_due,
        reconciled_due=ledger_due,
        adjustment_applied=variance,
        status="RECONCILED",
        notes=f"Synchronized customer due to {ledger_due} with audit journal entry.",
    )
