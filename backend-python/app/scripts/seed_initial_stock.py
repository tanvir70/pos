"""
Seed Initial Stock Script
Messers Rajib Enterprise POS & Inventory System

Initializes 10 base units of stock for every product in the database:
- Creates LOT-01 for each product that currently has no stock/lots.
- Assigns scannable Code 128 sticker barcode (<product_code>-01).
- Sets purchase_cost, lot_retail_price, lot_wholesale_price from product master prices.
- Sets entry_date to today and expiry_date to 2 years in future (Pesticide Ordinance compliant).
- Places 10.000 units into DOKAN counter location.
- Records LOT_INWARD audit movement in stock_movement.
"""

import asyncio
from datetime import date, timedelta
from decimal import Decimal
import os
import sys

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from sqlalchemy import select
from app.database import async_session_maker
from app.models.inventory import InventoryLot
from app.models.product import Product
from app.schemas.inventory import LotEntryRequest
from app.services.inventory_service import record_lot_entry

INITIAL_QUANTITY = Decimal("10.000")
INITIAL_LOT_NUMBER = "LOT-01"
CHALLAN_NO = "CH-INIT-20261002"
SUPPLIER_NAME = "Syngenta Bangladesh Limited"

async def seed_initial_stock():
    today = date.today()
    expiry_date = today + timedelta(days=730)  # 2 years

    async with async_session_maker() as session:
        # Fetch all active products
        products_res = await session.execute(select(Product).order_by(Product.id.asc()))
        products = products_res.scalars().all()

        print(f"Total products in catalog: {len(products)}")
        created_count = 0
        skipped_count = 0

        for product in products:
            # Check if product already has an existing lot
            existing_lot_res = await session.execute(
                select(InventoryLot.id).where(InventoryLot.product_id == product.id)
            )
            existing_lot = existing_lot_res.scalar_one_or_none()
            if existing_lot:
                skipped_count += 1
                continue

            buying_price = product.buying_price or product.standard_wholesale_price or Decimal("10.00")
            retail_price = product.standard_retail_price or (buying_price * Decimal("1.20")).quantize(Decimal("0.01"))
            wholesale_price = product.standard_wholesale_price or (buying_price * Decimal("1.10")).quantize(Decimal("0.01"))

            request = LotEntryRequest(
                product_id=product.id,
                lot_number=INITIAL_LOT_NUMBER,
                entry_date=today,
                expiry_date=expiry_date,
                purchase_cost=buying_price,
                lot_retail_price=retail_price,
                lot_wholesale_price=wholesale_price,
                quantity=INITIAL_QUANTITY,
                location="DOKAN",
                supplier_name=SUPPLIER_NAME,
                challan_no=CHALLAN_NO,
            )

            await record_lot_entry(session, request)
            created_count += 1

        await session.commit()
        print(f"\nInitial Stock Seeding Summary:")
        print(f"  Initialized lots: {created_count} products (10 units each)")
        print(f"  Skipped (already has lots): {skipped_count} products")
        print(f"  Total units added: {created_count * int(INITIAL_QUANTITY)} units")

if __name__ == "__main__":
    asyncio.run(seed_initial_stock())
