from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas.audit import FinancialAuditReport, ReconciliationResult
from app.services.audit_service import audit_financial_integrity, reconcile_customer_ledger
from app.services.backup_service import get_backup_filename, stream_sql_backup

router = APIRouter(prefix="/api/backup", tags=["backup"])

@router.get("/download")
async def download_backup(db: AsyncSession = Depends(get_db)):
    filename = get_backup_filename()
    return StreamingResponse(
        stream_sql_backup(db),
        media_type="application/sql",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )

@router.get("/financial-audit", response_model=FinancialAuditReport)
async def get_financial_audit(db: AsyncSession = Depends(get_db)) -> FinancialAuditReport:
    """Run an automated mathematical and accounting integrity audit across all sales, ledgers, and inventory."""
    return await audit_financial_integrity(db)

@router.post("/reconcile-customer/{customer_id}", response_model=ReconciliationResult)
async def reconcile_customer(
    customer_id: int, db: AsyncSession = Depends(get_db)
) -> ReconciliationResult:
    """Self-healing ledger reconciliation: audit journal entry and synchronize customer debt."""
    return await reconcile_customer_ledger(db, customer_id)
