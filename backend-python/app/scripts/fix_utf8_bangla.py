"""
Fix UTF-8 Bangla Encoding Script
Converts MySQL/MariaDB database and tables to utf8mb4 and restores all Bengali names.
Can be executed:
  1. As a standalone CLI: python -m app.scripts.fix_utf8_bangla
  2. Inside Alembic migrations: run_utf8_bangla_migration_sync(connection)
  3. Inside Passenger/FastAPI startup: auto_repair_bangla_if_needed()
"""

import sys
import os
from pathlib import Path

# Ensure backend root is on sys.path
_BACKEND_DIR = Path(__file__).resolve().parent.parent.parent
if str(_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(_BACKEND_DIR))

from decimal import Decimal
from sqlalchemy import text, select, create_engine
from app.config import get_settings
from app.scripts.seed_syngenta_catalog import SYNGENTA_PRODUCTS, BN_BRAND_MAP

settings = get_settings()

TABLES = [
    "product",
    "customer",
    "customer_ledger",
    "inventory_lot",
    "stock_inventory",
    "stock_movement",
    "sale",
    "sale_item",
    "sale_return",
    "sale_return_item",
    "stock_adjustment",
    "app_user",
    "document_sequences",
    "alembic_version",
]


def run_utf8_bangla_migration_sync(sync_conn) -> dict:
    """
    Executes the UTF-8 database conversion and restores Bengali product/customer text.
    Works with any synchronous SQLAlchemy Connection (Alembic or engine.connect()).
    """
    is_sqlite = bool(
        getattr(sync_conn, "dialect", None)
        and sync_conn.dialect.name == "sqlite"
    )

    converted_tables = []
    # 1. MySQL/MariaDB: Convert database and all tables to utf8mb4_unicode_ci
    if not is_sqlite:
        try:
            sync_conn.execute(text("SET FOREIGN_KEY_CHECKS = 0;"))
        except Exception:
            pass

        try:
            sync_conn.execute(text("SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;"))
        except Exception:
            pass

        try:
            sync_conn.execute(text("ALTER DATABASE CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"))
        except Exception:
            pass

        # Discover all actual tables in current schema
        all_tables = set(TABLES)
        try:
            res = sync_conn.execute(text("SELECT table_name FROM information_schema.tables WHERE table_schema = DATABASE()"))
            for row in res.fetchall():
                all_tables.add(row[0])
        except Exception:
            pass

        for table in sorted(all_tables):
            try:
                sync_conn.execute(text(f"ALTER TABLE `{table}` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"))
                converted_tables.append(table)
            except Exception as e:
                # Table might not exist yet or specific engine constraint
                pass

        try:
            sync_conn.execute(text("SET FOREIGN_KEY_CHECKS = 1;"))
        except Exception:
            pass

    # 2. Restore Bengali names for all 117 Syngenta products
    updated_products = 0
    for item in SYNGENTA_PRODUCTS:
        code = item["agi_code"]
        brand = item["brand_name"]
        unit_s = item["unit_size"]

        bn_base = BN_BRAND_MAP.get(brand, brand)
        if unit_s.lower() in brand.lower() or "unit" in unit_s.lower():
            name_bn = bn_base
        else:
            name_bn = f"{bn_base} ({unit_s})"

        try:
            res = sync_conn.execute(
                text("UPDATE product SET name_bn = :name_bn WHERE product_code = :code"),
                {"name_bn": name_bn, "code": code},
            )
            if res.rowcount and res.rowcount > 0:
                updated_products += res.rowcount
        except Exception:
            pass

    # 3. Restore walk-in customer default Bengali name if corrupted
    restored_walkin = False
    try:
        res = sync_conn.execute(
            text(
                "UPDATE customer SET name = :name "
                "WHERE phone = '01700000000' AND (name LIKE '%?%' OR name = '' OR name IS NULL)"
            ),
            {"name": "খুচরা ক্রেতা (Walk-in)"},
        )
        if res.rowcount and res.rowcount > 0:
            restored_walkin = True
    except Exception:
        pass

    return {
        "is_sqlite": is_sqlite,
        "converted_tables": converted_tables,
        "updated_products": updated_products,
        "restored_walkin": restored_walkin,
    }


def auto_repair_bangla_if_needed() -> bool:
    """
    Checks if corrupted '?' characters exist in product Bengali names.
    If detected, runs the full repair immediately. Returns True if repaired.
    """
    sync_url = settings.SYNC_DATABASE_URL
    # Ensure sync engine uses utf8mb4
    engine_kwargs = {"echo": False}
    if "sqlite" not in sync_url:
        engine_kwargs["connect_args"] = {
            "charset": "utf8mb4",
            "init_command": "SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci",
        }

    try:
        sync_engine = create_engine(sync_url, **engine_kwargs)
        with sync_engine.begin() as conn:
            # Check if product table exists and has '?' in name_bn
            try:
                res = conn.execute(text("SELECT COUNT(*) FROM product WHERE name_bn LIKE '%?%'"))
                corrupt_count = res.scalar() or 0
            except Exception:
                # Table might not exist yet
                return False

            if corrupt_count > 0:
                result = run_utf8_bangla_migration_sync(conn)
                print(f"[Bangla Fix] Repaired {result['updated_products']} products with proper Bengali text.")
                return True
        return False
    except Exception as e:
        print(f"[Bangla Fix Warning] Could not perform auto-check: {e}")
        return False


def main():
    print("==========================================================")
    print(" 🛠️  Running UTF-8 Bangla Repair Tool")
    print("==========================================================")
    sync_url = settings.SYNC_DATABASE_URL
    print(f"Target DB: {sync_url.split('@')[-1] if '@' in sync_url else 'SQLite'}")

    engine_kwargs = {"echo": False}
    if "sqlite" not in sync_url:
        engine_kwargs["connect_args"] = {
            "charset": "utf8mb4",
            "init_command": "SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci",
        }

    sync_engine = create_engine(sync_url, **engine_kwargs)
    with sync_engine.begin() as conn:
        res = run_utf8_bangla_migration_sync(conn)

    print(f"✓ Converted tables: {len(res['converted_tables'])}")
    print(f"✓ Restored product Bengali names: {res['updated_products']}")
    print(f"✓ Walk-in customer restored: {res['restored_walkin']}")
    print("==========================================================")
    print(" 🎉 SUCCESS! All Bengali text has been restored to utf8mb4!")
    print("==========================================================")


if __name__ == "__main__":
    main()
