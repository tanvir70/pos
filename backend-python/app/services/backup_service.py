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

    is_sqlite = "sqlite" in settings.DATABASE_URL

    yield f"-- ============================================================================\n"
    yield f"-- Al-Amin POS & Inventory Management System - Database Backup\n"
    yield f"-- Generated at: {now_str} (Asia/Dhaka)\n"
    yield f"-- Target Host: cPanel / MySQL / MariaDB / SQLite\n"
    yield f"-- ============================================================================\n\n"

    # Dual foreign key toggle for universal compatibility (MySQL + SQLite)
    yield f"SET FOREIGN_KEY_CHECKS = 0;\n"
    if is_sqlite:
        yield f"PRAGMA foreign_keys = OFF;\n"
    yield f"\n"

    for table in BACKUP_TABLES:
        try:
            # 1. Export schema DDL so restore works on bare-metal / empty database
            if is_sqlite:
                try:
                    schema_res = await db.execute(text("SELECT sql FROM sqlite_master WHERE type='table' AND name = :t"), {"t": table})
                    schema_row = schema_res.fetchone()
                    if schema_row and schema_row[0]:
                        table_ddl = schema_row[0].strip()
                        if not table_ddl.upper().startswith("CREATE TABLE IF NOT EXISTS"):
                            table_ddl = "CREATE TABLE IF NOT EXISTS" + table_ddl[len("CREATE TABLE"):]
                        yield f"-- Schema DDL for: {table}\n"
                        yield f"{table_ddl};\n\n"
                except Exception:
                    pass
            else:
                try:
                    schema_res = await db.execute(text(f"SHOW CREATE TABLE `{table}`"))
                    schema_row = schema_res.fetchone()
                    if schema_row and len(schema_row) >= 2 and schema_row[1]:
                        yield f"-- Schema DDL for: {table}\n"
                        yield f"{schema_row[1]};\n\n"
                except Exception:
                    pass

            # 2. Export row data
            res = await db.execute(text(f"SELECT * FROM {table}"))
            rows = res.fetchall()
            if not rows:
                continue

            columns = list(res.keys())
            cols_str = ", ".join(f"`{col}`" for col in columns)

            yield f"-- Data for table: {table}\n"
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
    if is_sqlite:
        yield f"PRAGMA foreign_keys = ON;\n"
    yield f"-- ============================================================================\n"
    yield f"-- Backup Complete\n"
    yield f"-- ============================================================================\n"

def get_backup_filename() -> str:
    ts = datetime.now(ZoneInfo(settings.TIMEZONE)).strftime("%Y%m%d_%H%M%S")
    return f"pos_backup_{ts}.sql"
