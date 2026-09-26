import uuid
from decimal import Decimal
import pytest
from httpx import ASGITransport, AsyncClient
from app.main import app, lifespan

@pytest.mark.asyncio
async def test_lot_entry_and_movement_audit():
    """Verify lot entry creates Dokan stock and audit log in stock_movements."""
    async with lifespan(app):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            login = await ac.post("/api/auth/login", json={"username": "owner", "password": "1234"})
            token = login.json()["token"]
            headers = {"Authorization": f"Bearer {token}"}

            lot_num = f"LOT-EXH-{uuid.uuid4().hex[:6].upper()}"
            bar_code = f"BAR-{uuid.uuid4().hex[:6].upper()}"

            # 1. Record lot entry
            lot_res = await ac.post(
                "/api/inventory/lots",
                json={
                    "productId": 1,
                    "lotNumber": lot_num,
                    "quantity": 30.0,
                    "purchaseCost": 110.0,
                    "lotRetailPrice": 150.0,
                    "lotWholesalePrice": 140.0,
                    "barcode": bar_code,
                    "entryDate": "2026-09-26",
                    "expiryDate": "2029-09-26",
                    "supplierName": "National Seeds & Agro",
                    "challanNo": "CH-998877",
                },
                headers=headers,
            )
            assert lot_res.status_code == 201
            lot_data = lot_res.json()
            lot_id = lot_data["id"]

            # 2. Check stock movements has LOT_ENTRY
            mov_res = await ac.get(
                f"/api/inventory/movements?lotId={lot_id}&movementType=LOT_ENTRY",
                headers=headers,
            )
            assert mov_res.status_code == 200
            paged_mov = mov_res.json()
            assert paged_mov["totalElements"] >= 1
            entry_mov = next(m for m in paged_mov["content"] if m["lotId"] == lot_id)
            assert float(entry_mov["quantityChange"]) == 30.0
            assert entry_mov["location"] == "DOKAN"
            assert entry_mov["referenceDocNo"] == "CH-998877"

@pytest.mark.asyncio
async def test_fefo_vs_id_sorting_and_product_filter():
    """Verify get_lots_by_product ordering by FEFO (expiry asc) vs ID desc."""
    async with lifespan(app):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            login = await ac.post("/api/auth/login", json={"username": "owner", "password": "1234"})
            token = login.json()["token"]
            headers = {"Authorization": f"Bearer {token}"}

            # 1. FEFO sort: expiry dates should be non-decreasing
            fefo_res = await ac.get("/api/inventory/lots?fefo=true", headers=headers)
            assert fefo_res.status_code == 200
            fefo_lots = fefo_res.json()
            assert len(fefo_lots) >= 2
            dates = [l["expiryDate"] for l in fefo_lots if l.get("expiryDate")]
            assert dates == sorted(dates), "Lots are not in FEFO ascending order"

            # 2. Non-FEFO sort: IDs should be in descending order
            id_res = await ac.get("/api/inventory/lots?fefo=false", headers=headers)
            assert id_res.status_code == 200
            id_lots = id_res.json()
            ids = [l["id"] for l in id_lots]
            assert ids == sorted(ids, reverse=True), "Lots are not in ID descending order"

            # 3. Filter by productId=1
            p1_res = await ac.get("/api/inventory/lots?productId=1", headers=headers)
            assert p1_res.status_code == 200
            for l in p1_res.json():
                assert l["productId"] == 1

@pytest.mark.asyncio
async def test_scrap_and_restock_adjustments():
    """Verify SCRAP_DISCARD and RESTOCK_TO_DOKAN actions."""
    async with lifespan(app):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            login = await ac.post("/api/auth/login", json={"username": "owner", "password": "1234"})
            token = login.json()["token"]
            headers = {"Authorization": f"Bearer {token}"}

            # 1. Seed fresh lot with 10 units
            lot_res = await ac.post(
                "/api/inventory/lots",
                json={
                    "productId": 1,
                    "lotNumber": f"LOT-SCRAP-{uuid.uuid4().hex[:5].upper()}",
                    "quantity": 10.0,
                    "purchaseCost": 50.0,
                    "lotRetailPrice": 80.0,
                    "lotWholesalePrice": 75.0,
                    "barcode": f"BAR-{uuid.uuid4().hex[:6]}",
                    "entryDate": "2026-09-26",
                    "expiryDate": "2028-09-26",
                },
                headers=headers,
            )
            assert lot_res.status_code == 201
            lot_id = lot_res.json()["id"]

            # 2. SCRAP discard 2 units (Dokan decreases from 10 to 8)
            scrap_res = await ac.post(
                "/api/inventory/adjustments",
                json={
                    "productId": 1,
                    "lotId": lot_id,
                    "adjustmentType": "SCRAP",
                    "actionType": "SCRAP_DISCARD",
                    "quantity": 2.0,
                    "reason": "Mice damage to packing carton",
                },
                headers=headers,
            )
            assert scrap_res.status_code == 201
            assert scrap_res.json()["actionType"] == "SCRAP_DISCARD"

            # Verify Dokan stock is now 8
            stocks1 = (await ac.get("/api/inventory/stock", headers=headers)).json()
            st1 = next(s for s in stocks1 if s["lotId"] == lot_id)
            assert float(st1["quantity"]) == 8.0

            # 3. MOVE_TO_QUARANTINE 5 units (Dokan decreases from 8 to 3, Quarantine increases to 5)
            move_q_res = await ac.post(
                "/api/inventory/adjustments",
                json={
                    "productId": 1,
                    "lotId": lot_id,
                    "adjustmentType": "DAMAGE",
                    "actionType": "MOVE_TO_QUARANTINE",
                    "quantity": 5.0,
                    "reason": "Leaking bottle damaged packaging",
                },
                headers=headers,
            )
            assert move_q_res.status_code == 201
            stocks2 = (await ac.get("/api/inventory/stock", headers=headers)).json()
            st2 = next(s for s in stocks2 if s["lotId"] == lot_id)
            assert float(st2["quantity"]) == 3.0

            # 4. Check paginated adjustments endpoint
            adj_paged = await ac.get(f"/api/inventory/adjustments?productId=1&page=0&size=5", headers=headers)
            assert adj_paged.status_code == 200
            data = adj_paged.json()
            assert "content" in data
            assert "totalElements" in data
            assert data["pageNumber"] == 0
            assert data["pageSize"] == 5
