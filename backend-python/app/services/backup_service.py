from datetime import datetime
from zoneinfo import ZoneInfo
from fastapi.responses import StreamingResponse
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from app.config import get_settings

settings = get_settings()

BACKUP_TABLES = [
    "document_sequences",
    "app_user",
    "product",
    "inventory_lot",
    "stock_inventory",
    "customer",
    "customer_ledger",
    "sale",
    "sale_item",
    "sale_return",
    "sale_return_item",
    "stock_movement",
    "stock_adjustment",
]

async def stream_sql_backup(db: AsyncSession):
    now_str = datetime.now(ZoneInfo(settings.TIMEZONE)).strftime("%Y-%m-%d %H:%M:%S")

    yield f"-- ============================================================================\n"
    yield f"-- Al-Amin POS & Inventory Management System - Database Backup\n"
    yield f"-- Generated at: {now_str} (Asia/Dhaka)\n"
    yield f"-- Target Host: cPanel / MySQL / MariaDB / SQLite\n"
    yield f"-- ============================================================================\n\n"
    yield f"SET FOREIGN_KEY_CHECKS = 0;\n\n"

    for table in BACKUP_TABLES:
        try:
            res = await db.execute(text(f"SELECT * FROM {table}"))
            rows = res.fetchall()
            if not rows:
                continue

            columns = list(res.keys())
            cols_str = ", ".join(f"`{col}`" for col in columns)

            yield f"-- Table: {table}\n"
            for row in rows:
                val_parts = []
                for val in row:
                    if val is None:
                        val_parts.append("NULL")
                    elif isinstance(val, (int, float)):
                        val_parts.append(str(val))
                    elif isinstance(val, bool):
                        val_parts.append("1" if val else "0")
                    else:
                        escaped = str(val).replace("\\", "\\\\").replace("'", "\\'")
                        val_parts.append(f"'{escaped}'")
                vals_str = ", ".join(val_parts)
                yield f"INSERT INTO `{table}` ({cols_str}) VALUES ({vals_str});\n"
            yield f"\n"
        except Exception:
            # Table might not exist yet or empty
            continue

    yield f"SET FOREIGN_KEY_CHECKS = 1;\n"
    yield f"-- ============================================================================\n"
    yield f"-- Backup Complete\n"
    yield f"-- ============================================================================\n"

def get_backup_filename() -> str:
    ts = datetime.now(ZoneInfo(settings.TIMEZONE)).strftime("%Y%m%d_%H%M%S")
    return f"pos_backup_{ts}.sql"
