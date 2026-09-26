import uuid
from datetime import date, timedelta
import pytest
from httpx import ASGITransport, AsyncClient
from app.main import app, lifespan

@pytest.mark.asyncio
async def test_lot_entry_validation_and_creation():
    async with lifespan(app):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            login = await ac.post("/api/auth/login", json={"username": "owner", "password": "1234"})
            token = login.json()["token"]
            headers = {"Authorization": f"Bearer {token}"}

            # 1. Non-existent product ID returns 404
            bad_prod_res = await ac.post(
                "/api/inventory/lots",
                json={
                    "productId": 999999,
                    "lotNumber": f"LOT-{uuid.uuid4().hex[:6]}",
                    "quantity": 10.0,
                    "purchaseCost": 50.0,
                    "lotRetailPrice": 70.0,
                    "lotWholesalePrice": 65.0,
                    "barcode": f"BAR-{uuid.uuid4().hex[:6]}",
                    "entryDate": "2026-09-26",
                    "expiryDate": "2028-09-26",
                },
                headers=headers,
            )
            assert bad_prod_res.status_code == 404
            assert "Product with ID 999999 not found" in bad_prod_res.json()["message"]

            # 2. Expiry date earlier than entry date must fail schema validation (422)
            past_expiry_res = await ac.post(
                "/api/inventory/lots",
                json={
                    "productId": 1,
                    "lotNumber": f"LOT-{uuid.uuid4().hex[:6]}",
                    "quantity": 10.0,
                    "purchaseCost": 50.0,
                    "lotRetailPrice": 70.0,
                    "lotWholesalePrice": 65.0,
                    "barcode": f"BAR-{uuid.uuid4().hex[:6]}",
                    "entryDate": "2026-09-26",
                    "expiryDate": "2025-01-01",
                },
                headers=headers,
            )
            assert past_expiry_res.status_code == 422

            # 3. Non-positive quantity must fail schema validation (422)
            zero_qty_res = await ac.post(
                "/api/inventory/lots",
                json={
                    "productId": 1,
                    "lotNumber": f"LOT-{uuid.uuid4().hex[:6]}",
                    "quantity": 0.0,
                    "purchaseCost": 50.0,
                    "lotRetailPrice": 70.0,
                    "lotWholesalePrice": 65.0,
                    "barcode": f"BAR-{uuid.uuid4().hex[:6]}",
                    "entryDate": "2026-09-26",
                    "expiryDate": "2028-09-26",
                },
                headers=headers,
            )
            assert zero_qty_res.status_code == 422

            # 4. Negative purchase cost must fail schema validation (422)
            neg_cost_res = await ac.post(
                "/api/inventory/lots",
                json={
                    "productId": 1,
                    "lotNumber": f"LOT-{uuid.uuid4().hex[:6]}",
                    "quantity": 10.0,
                    "purchaseCost": -10.0,
                    "lotRetailPrice": 70.0,
                    "lotWholesalePrice": 65.0,
                    "barcode": f"BAR-{uuid.uuid4().hex[:6]}",
                    "entryDate": "2026-09-26",
                    "expiryDate": "2028-09-26",
                },
                headers=headers,
            )
            assert neg_cost_res.status_code == 422

            # 5. Valid lot entry succeeds and initializes DOKAN stock
            lot_num = f"LOT-{uuid.uuid4().hex[:6].upper()}"
            bar_code = f"BAR-{uuid.uuid4().hex[:6].upper()}"
            valid_res = await ac.post(
                "/api/inventory/lots",
                json={
                    "productId": 1,
                    "lotNumber": lot_num,
                    "quantity": 25.0,
                    "purchaseCost": 120.0,
                    "lotRetailPrice": 160.0,
                    "lotWholesalePrice": 150.0,
                    "barcode": bar_code,
                    "entryDate": "2026-09-26",
                    "expiryDate": "2028-09-26",
                    "supplierName": "National Agro Supplies",
                    "challanNo": f"CH-{uuid.uuid4().hex[:6].upper()}",
                },
                headers=headers,
            )
            assert valid_res.status_code == 201
            lot_data = valid_res.json()
            assert lot_data["lotNumber"] == lot_num
            created_lot_id = lot_data["id"]

            # Verify stock in Dokan
            stocks_res = await ac.get("/api/inventory/stock", headers=headers)
            assert stocks_res.status_code == 200
            matched_stock = next((s for s in stocks_res.json() if s["lotId"] == created_lot_id), None)
            assert matched_stock is not None
            assert float(matched_stock["quantity"]) == 25.0

@pytest.mark.asyncio
async def test_stock_adjustments_and_boundaries():
    async with lifespan(app):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            login = await ac.post("/api/auth/login", json={"username": "owner", "password": "1234"})
            token = login.json()["token"]
            headers = {"Authorization": f"Bearer {token}"}

            # Create fresh lot with 10 units
            lot_res = await ac.post(
                "/api/inventory/lots",
                json={
                    "productId": 1,
                    "lotNumber": f"LOT-ADJ-{uuid.uuid4().hex[:5].upper()}",
                    "quantity": 10.0,
                    "purchaseCost": 80.0,
                    "lotRetailPrice": 100.0,
                    "lotWholesalePrice": 90.0,
                    "barcode": f"BAR-{uuid.uuid4().hex[:6]}",
                    "entryDate": "2026-09-26",
                    "expiryDate": "2028-09-26",
                },
                headers=headers,
            )
            assert lot_res.status_code == 201
            lot_id = lot_res.json()["id"]

            # 1. Negative adjustment quantity rejected by schema (422)
            neg_adj_res = await ac.post(
                "/api/inventory/adjustments",
                json={
                    "productId": 1,
                    "lotId": lot_id,
                    "adjustmentType": "DAMAGE",
                    "quantity": -5.0,
                    "reason": "Test negative",
                },
                headers=headers,
            )
            assert neg_adj_res.status_code == 422

            # 2. Empty reason rejected by schema (422)
            empty_reason_res = await ac.post(
                "/api/inventory/adjustments",
                json={
                    "productId": 1,
                    "lotId": lot_id,
                    "adjustmentType": "DAMAGE",
                    "quantity": 2.0,
                    "reason": "   ",
                },
                headers=headers,
            )
            assert empty_reason_res.status_code == 422

            # 3. Reducing stock by more than available stock raises 400
            excess_down_res = await ac.post(
                "/api/inventory/adjustments",
                json={
                    "productId": 1,
                    "lotId": lot_id,
                    "adjustmentType": "SCRAP",
                    "actionType": "SCRAP_DISCARD",
                    "quantity": 20.0,
                    "reason": "Audited shrinkage excess",
                },
                headers=headers,
            )
            assert excess_down_res.status_code == 400
            assert "Insufficient stock in Dokan" in excess_down_res.json()["message"]

            # 4. Valid stock reduction to damage (DAMAGE 3 units moves to quarantine)
            damage_res = await ac.post(
                "/api/inventory/adjustments",
                json={
                    "productId": 1,
                    "lotId": lot_id,
                    "adjustmentType": "DAMAGE",
                    "actionType": "MOVE_TO_QUARANTINE",
                    "quantity": 3.0,
                    "reason": "Damaged container leak",
                },
                headers=headers,
            )
            assert damage_res.status_code == 201
            assert float(damage_res.json()["quantity"]) == 3.0
            assert damage_res.json()["actionType"] == "MOVE_TO_QUARANTINE"

            # Verify quarantine stock now contains 3 units
            q_res = await ac.get("/api/inventory/quarantine", headers=headers)
            assert q_res.status_code == 200
            q_item = next((q for q in q_res.json() if q["lotId"] == lot_id), None)
            assert q_item is not None
            assert float(q_item["quarantineQuantity"]) == 3.0

@pytest.mark.asyncio
async def test_quarantine_disposal_and_valuation():
    async with lifespan(app):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            login = await ac.post("/api/auth/login", json={"username": "owner", "password": "1234"})
            token = login.json()["token"]
            headers = {"Authorization": f"Bearer {token}"}

            # Create lot and damage 2 units
            lot_res = await ac.post(
                "/api/inventory/lots",
                json={
                    "productId": 1,
                    "lotNumber": f"LOT-DISP-{uuid.uuid4().hex[:5].upper()}",
                    "quantity": 5.0,
                    "purchaseCost": 50.0,
                    "lotRetailPrice": 80.0,
                    "lotWholesalePrice": 75.0,
                    "barcode": f"BAR-{uuid.uuid4().hex[:6]}",
                    "entryDate": "2026-09-26",
                    "expiryDate": "2028-09-26",
                },
                headers=headers,
            )
            lot_id = lot_res.json()["id"]

            await ac.post(
                "/api/inventory/adjustments",
                json={
                    "productId": 1,
                    "lotId": lot_id,
                    "adjustmentType": "DAMAGE",
                    "actionType": "MOVE_TO_QUARANTINE",
                    "quantity": 2.0,
                    "reason": "Broken neck",
                },
                headers=headers,
            )

            # 1. Disposal quantity <= 0 rejected (422)
            neg_disp_res = await ac.post(
                "/api/inventory/quarantine/dispose",
                json={"lotId": lot_id, "quantity": 0.0, "reason": "Neutralize"},
                headers=headers,
            )
            assert neg_disp_res.status_code == 422

            # 2. Disposal exceeding quarantine stock raises 400
            excess_disp_res = await ac.post(
                "/api/inventory/quarantine/dispose",
                json={"lotId": lot_id, "quantity": 10.0, "reason": "Neutralize"},
                headers=headers,
            )
            assert excess_disp_res.status_code == 400
            assert "Insufficient quarantine stock" in excess_disp_res.json()["message"]

            # 3. Valid disposal of 1 unit
            disp_res = await ac.post(
                "/api/inventory/quarantine/dispose",
                json={"lotId": lot_id, "quantity": 1.0, "reason": "Neutralized according to safety protocol"},
                headers=headers,
            )
            assert disp_res.status_code == 200

            # 4. Valuation summary endpoint returns non-negative numbers
            val_res = await ac.get("/api/inventory/valuation", headers=headers)
            assert val_res.status_code == 200
            val_data = val_res.json()
            assert float(val_data["totalCostValuation"]) >= 0.0
            assert float(val_data["totalRetailValuation"]) >= 0.0
            assert int(val_data["totalLots"]) >= 1
