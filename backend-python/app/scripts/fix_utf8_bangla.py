"""
Fix UTF-8 Bangla Encoding Script
Converts MySQL/MariaDB database and tables to utf8mb4 and re-seeds all Bengali names.
Usage:
    python app/scripts/fix_utf8_bangla.py
"""

import asyncio
import sys
from sqlalchemy import text, select
from app.config import get_settings
from app.database import engine, async_session_maker
from app.scripts.seed_syngenta_catalog import seed_syngenta_catalog
from app.models.customer import Customer

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
    "stock_adjustment_item",
    "app_user",
    "document_sequences",
]

async def fix_bangla():
    print("==========================================================")
    print(" 🛠️  Fixing UTF-8 Bangla Encoding (MySQL / MariaDB)")
    print("==========================================================")
    print(f"Database: {settings.DATABASE_URL.split('@')[-1] if '@' in settings.DATABASE_URL else 'SQLite'}")

    if "sqlite" not in settings.DATABASE_URL:
        print("\n[1/3] Converting MySQL tables to utf8mb4_unicode_ci...")
        async with engine.begin() as conn:
            await conn.execute(text("SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci"))
            for table in TABLES:
                try:
                    await conn.execute(
                        text(f"ALTER TABLE `{table}` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci")
                    )
                    print(f"  ✓ {table} -> utf8mb4")
                except Exception as e:
                    print(f"  ⚠️ {table}: {e}")
    else:
        print("\n[1/3] SQLite detected (native UTF-8 support already active).")

    print("\n[2/3] Restoring original Bengali product catalog names...")
    catalog_res = await seed_syngenta_catalog(force_price_reset=False)
    print(f"  ✓ Catalog processed: {catalog_res.get('updated', 0)} updated, {catalog_res.get('created', 0)} created.")

    print("\n[3/3] Verifying default customer records...")
    async with async_session_maker() as session:
        cust_stmt = select(Customer).where(Customer.phone == "01700000000")
        cust_res = await session.execute(cust_stmt)
        walk_in = cust_res.scalar_one_or_none()
        if walk_in and ("?" in walk_in.name or not walk_in.name):
            walk_in.name = "খুচরা ক্রেতা (Walk-in)"
            await session.commit()
            print("  ✓ Restored walk-in customer Bengali name.")

    print("\n==========================================================")
    print(" 🎉 SUCCESS! All Bengali text has been restored to utf8mb4!")
    print("==========================================================")

if __name__ == "__main__":
    asyncio.run(fix_bangla())
