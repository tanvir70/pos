"""
Setup Carton Multiplier Test Stock Script
Messers Rajib Enterprise POS & Inventory System

Arranges the inventory database specifically for testing carton multipliers:
- Sets stock in terms of CARTONS for all 118 catalog products:
  - Each lot receives 10 full cartons (10 * carton_multiplier base units).
- Configures comprehensive testing edge cases:
  1. Mixed Cartons + Loose:
     - 72598 (Virtako 10gm, m=40): LOT-01 has 10 Cartons + 5 Loose (405 packs).
     - 29568 (Shobicron 50ml, m=20): LOT-01 has 10 Cartons + 3 Loose (203 packs).
  2. Multi-Lot FEFO with Cartons:
     - 72598 adds LOT-02 with 5 Cartons (200 packs) expiring in 2029.
     - 29568 adds LOT-02 with 5 Cartons (100 packs) expiring in 2029.
  3. Single-unit products (m=1):
     - Equipment / Sprayers have 10 units.
  4. Fixes carton prices on test SKU 11111.
- Synchronizes StockInventory and StockMovement audit records.
"""

import asyncio
from datetime import date, datetime, timedelta
from decimal import Decimal
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from sqlalchemy import select, update
from app.database import async_session_maker
from app.models.inventory import InventoryLot, StockInventory, StockMovement
from app.models.product import Product
from app.schemas.inventory import LotEntryRequest
from app.services.inventory_service import record_lot_entry

CHALLAN_NO = "CH-CTN-SETUP"
SUPPLIER_NAME = "Syngenta Bangladesh Limited"

async def setup_carton_multiplier_stock():
    today = date.today()
    expiry_2yr = today + timedelta(days=730)
    expiry_3yr = today + timedelta(days=1095)

    async with async_session_maker() as session:
        # Fetch all products
        products_res = await session.execute(select(Product).order_by(Product.id.asc()))
        products = products_res.scalars().all()
        print(f"Loaded {len(products)} products from catalog.")

        total_base_units = Decimal("0.000")
        updated_lots_count = 0
        added_lots_count = 0

        for p in products:
            m = p.carton_multiplier or Decimal("1.000")

            # Fix test product prices if needed
            if p.product_code == "11111":
                if p.carton_wholesale_price is None:
                    p.carton_wholesale_price = p.standard_wholesale_price or Decimal("53.00")
                if p.carton_buying_price is None:
                    p.carton_buying_price = p.buying_price or Decimal("47.00")

            # Calculate desired quantity for LOT-01
            # Special test cases with loose packs
            if p.product_code == "72598":
                # Virtako 10gm (m=40): 10 Cartons + 5 Loose packs = 405 packs
                target_qty = (Decimal("10") * m) + Decimal("5.000")
            elif p.product_code == "29568":
                # Shobicron 50ml (m=20): 10 Cartons + 3 Loose packs = 203 packs
                target_qty = (Decimal("10") * m) + Decimal("3.000")
            else:
                # 10 full cartons
                target_qty = Decimal("10") * m

            # Find existing LOT-01
            lot_res = await session.execute(
                select(InventoryLot).where(
                    InventoryLot.product_id == p.id,
                    InventoryLot.lot_number == "LOT-01"
                )
            )
            lot1 = lot_res.scalar_one_or_none()

            if lot1:
                # Update StockInventory
                stock_res = await session.execute(
                    select(StockInventory).where(
                        StockInventory.lot_id == lot1.id,
                        StockInventory.location == "DOKAN"
                    )
                )
                stock1 = stock_res.scalar_one_or_none()
                if stock1:
                    stock1.quantity = target_qty
                else:
                    stock1 = StockInventory(lot_id=lot1.id, location="DOKAN", quantity=target_qty)
                    session.add(stock1)

                # Add StockMovement record
                movement = StockMovement(
                    product_id=p.id,
                    lot_id=lot1.id,
                    movement_time=datetime.now(),
                    movement_type="LOT_INWARD",
                    location="DOKAN",
                    quantity_change=target_qty,
                    balance_before=Decimal("0.000"),
                    balance_after=target_qty,
                    unit=p.base_unit,
                    reference_doc_no=CHALLAN_NO,
                    remarks=f"Carton Multiplier Setup: 10 Ctns ({target_qty} {p.base_unit})",
                    performed_by="System",
                )
                session.add(movement)
                updated_lots_count += 1
                total_base_units += target_qty
            else:
                # Create LOT-01 if it didn't exist
                buying_price = p.buying_price or p.standard_wholesale_price or Decimal("10.00")
                retail_price = p.standard_retail_price or (buying_price * Decimal("1.20")).quantize(Decimal("0.01"))
                wholesale_price = p.standard_wholesale_price or (buying_price * Decimal("1.10")).quantize(Decimal("0.01"))

                req = LotEntryRequest(
                    product_id=p.id,
                    lot_number="LOT-01",
                    entry_date=today,
                    expiry_date=expiry_2yr,
                    purchase_cost=buying_price,
                    lot_retail_price=retail_price,
                    lot_wholesale_price=wholesale_price,
                    quantity=target_qty,
                    location="DOKAN",
                    supplier_name=SUPPLIER_NAME,
                    challan_no=CHALLAN_NO,
                )
                await record_lot_entry(session, req)
                updated_lots_count += 1
                total_base_units += target_qty

            # Flagship products: Add LOT-02 with 5 Cartons expiring later (FEFO testing)
            if p.product_code in ("72598", "29568"):
                lot2_res = await session.execute(
                    select(InventoryLot.id).where(
                        InventoryLot.product_id == p.id,
                        InventoryLot.lot_number == "LOT-02"
                    )
                )
                lot2_existing = lot2_res.scalar_one_or_none()
                if not lot2_existing:
                    lot2_qty = Decimal("5") * m  # 5 cartons
                    buying_price = p.buying_price or p.standard_wholesale_price or Decimal("10.00")
                    retail_price = p.standard_retail_price or (buying_price * Decimal("1.20")).quantize(Decimal("0.01"))
                    wholesale_price = p.standard_wholesale_price or (buying_price * Decimal("1.10")).quantize(Decimal("0.01"))

                    req2 = LotEntryRequest(
                        product_id=p.id,
                        lot_number="LOT-02",
                        entry_date=today,
                        expiry_date=expiry_3yr,
                        purchase_cost=buying_price,
                        lot_retail_price=retail_price,
                        lot_wholesale_price=wholesale_price,
                        quantity=lot2_qty,
                        location="DOKAN",
                        supplier_name=SUPPLIER_NAME,
                        challan_no="CH-CTN-FEFO-02",
                    )
                    await record_lot_entry(session, req2)
                    added_lots_count += 1
                    total_base_units += lot2_qty

        await session.commit()
        print("\nCarton Multiplier Test Stock Setup Complete:")
        print(f"  Updated LOT-01 for: {updated_lots_count} products (10 cartons each)")
        print(f"  Added LOT-02 for: {added_lots_count} flagship products (5 cartons each for FEFO testing)")
        print(f"  Total base units in stock: {total_base_units}")

if __name__ == "__main__":
    asyncio.run(setup_carton_multiplier_stock())
