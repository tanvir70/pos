from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
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
