import uuid
from datetime import datetime
from decimal import Decimal
import pytest
from httpx import ASGITransport, AsyncClient
from app.main import app, lifespan
from app.models.product import Product
from app.models.inventory import InventoryLot
from app.models.returns import SaleReturn, SaleReturnItem
from app.models.customer import Customer
from app.services.returns_service import to_return_response

# ==============================================================================
# 1. UNIT TESTS: TO_RETURN_RESPONSE
# ==============================================================================

def test_to_return_response_unit():
    p = Product(id=2, product_code="P2", name_en="Fungicide X", name_bn="ফাঞ্জিসাইড এক্স")
    lot = InventoryLot(id=20, lot_number="LOT-RET-20", barcode="BAR-20", product=p)
    it = SaleReturnItem(
        id=201,
        lot_id=20,
        lot=lot,
        quantity=Decimal("3.000"),
        refund_price=Decimal("150.00"),
        is_damaged=False,
        restock_location="DOKAN",
    )
    c = Customer(id=5, name="Farmer Kashem", phone="01799887766")
    ret = SaleReturn(
        id=701,
        return_no="RET-20260926-0000701",
        original_sale_id=10,
        customer_id=5,
        customer=c,
        return_date=datetime.now(),
        total_refund_amount=Decimal("450.00"),
        refund_type="CASH_REFUND",
        reason="Ordered too much",
        client_trx_id="RET-TRX-777",
        items=[it],
    )
    resp = to_return_response(ret)
    assert resp.id == 701
    assert resp.customer_name == "Farmer Kashem"
    assert resp.items[0].subtotal == Decimal("450.00")
    assert resp.items[0].restock_location == "DOKAN"

# ==============================================================================
# 2. INTEGRATION TESTS: RETURN WORKFLOW & BOUNDARIES
# ==============================================================================

@pytest.mark.asyncio
async def test_returns_damaged_vs_undamaged_routing():
    """Verify undamaged returns restock to DOKAN while damaged returns restock to QUARANTINE."""
    async with lifespan(app):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            login = await ac.post("/api/auth/login", json={"username": "owner", "password": "1234"})
            token = login.json()["token"]
            headers = {"Authorization": f"Bearer {token}"}

            # 1. Create fresh lot with 20 units
            lot_res = await ac.post(
                "/api/inventory/lots",
                json={
                    "productId": 1,
                    "lotNumber": f"LOT-RET-ROUT-{uuid.uuid4().hex[:5].upper()}",
                    "quantity": 20.0,
                    "purchaseCost": 60.0,
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

            # 2. Process sale of 4 units (Dokan goes from 20 to 16)
            sale_res = await ac.post(
                "/api/sales",
                json={
                    "saleMode": "RETAIL",
                    "items": [{"lotId": lot_id, "totalQuantity": 4.0, "unitPrice": 100.0}],
                    "discount": 0.0,
                    "paymentMethod": "CASH",
                    "cashPaid": 400.0,
                },
                headers=headers,
            )
            assert sale_res.status_code == 201
            sale = sale_res.json()
            sale_id = sale["id"]

            # 3. Return 1 unit undamaged -> Restocks to DOKAN (Dokan goes from 16 to 17)
            ret_undamaged = await ac.post(
                "/api/returns",
                json={
                    "originalSaleId": sale_id,
                    "refundType": "CASH_REFUND",
                    "items": [{"lotId": lot_id, "quantity": 1.0, "refundPrice": 100.0, "isDamaged": False}],
                },
                headers=headers,
            )
            assert ret_undamaged.status_code == 201
            assert ret_undamaged.json()["items"][0]["restockLocation"] == "DOKAN"

            stocks1 = (await ac.get("/api/inventory/stock", headers=headers)).json()
            st1 = next(s for s in stocks1 if s["lotId"] == lot_id)
            assert float(st1["quantity"]) == 17.0

            # 4. Return 1 unit DAMAGED -> Restocks to QUARANTINE (Quarantine becomes 1.0)
            ret_damaged = await ac.post(
                "/api/returns",
                json={
                    "originalSaleId": sale_id,
                    "refundType": "CASH_REFUND",
                    "items": [{"lotId": lot_id, "quantity": 1.0, "refundPrice": 100.0, "isDamaged": True}],
                },
                headers=headers,
            )
            assert ret_damaged.status_code == 201
            assert ret_damaged.json()["items"][0]["restockLocation"] == "QUARANTINE"

            q_res = (await ac.get("/api/inventory/quarantine", headers=headers)).json()
            q_item = next(q for q in q_res if q["lotId"] == lot_id)
            assert float(q_item["quarantineQuantity"]) == 1.0

@pytest.mark.asyncio
async def test_returns_quantity_and_price_boundaries():
    """Verify rejections when return quantity or refund price exceeds original sale terms."""
    async with lifespan(app):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            login = await ac.post("/api/auth/login", json={"username": "owner", "password": "1234"})
            token = login.json()["token"]
            headers = {"Authorization": f"Bearer {token}"}

            # 1. Fresh lot
            lot_res = await ac.post(
                "/api/inventory/lots",
                json={
                    "productId": 1,
                    "lotNumber": f"LOT-RET-BOUND-{uuid.uuid4().hex[:5].upper()}",
                    "quantity": 10.0,
                    "purchaseCost": 50.0,
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

            # 2. Sale of 2 units @ 100
            sale_res = await ac.post(
                "/api/sales",
                json={
                    "saleMode": "RETAIL",
                    "items": [{"lotId": lot_id, "totalQuantity": 2.0, "unitPrice": 100.0}],
                    "discount": 0.0,
                    "paymentMethod": "CASH",
                    "cashPaid": 200.0,
                },
                headers=headers,
            )
            assert sale_res.status_code == 201
            sale_id = sale_res.json()["id"]

            # 3. Non-existent sale ID returns 404
            bad_sale_res = await ac.post(
                "/api/returns",
                json={
                    "originalSaleId": 999999,
                    "refundType": "CASH_REFUND",
                    "items": [{"lotId": lot_id, "quantity": 1.0, "refundPrice": 100.0}],
                },
                headers=headers,
            )
            assert bad_sale_res.status_code == 404

            # 4. Return quantity (5.0) exceeds original purchased quantity (2.0) -> 400
            excess_qty_res = await ac.post(
                "/api/returns",
                json={
                    "originalSaleId": sale_id,
                    "refundType": "CASH_REFUND",
                    "items": [{"lotId": lot_id, "quantity": 5.0, "refundPrice": 100.0}],
                },
                headers=headers,
            )
            assert excess_qty_res.status_code == 400
            assert "purchased on invoice" in excess_qty_res.json()["message"]

            # 5. Refund total (250.0) exceeds original sale total amount (200.0) -> 400
            excess_price_res = await ac.post(
                "/api/returns",
                json={
                    "originalSaleId": sale_id,
                    "refundType": "CASH_REFUND",
                    "items": [{"lotId": lot_id, "quantity": 1.0, "refundPrice": 250.0}],
                },
                headers=headers,
            )
            assert excess_price_res.status_code == 400
            assert "exceeds remaining refundable amount" in excess_price_res.json()["message"]

            # 6. Lookups: get_return_by_id (200 vs 404) and get_recent_returns
            valid_ret = await ac.post(
                "/api/returns",
                json={
                    "originalSaleId": sale_id,
                    "refundType": "CASH_REFUND",
                    "items": [{"lotId": lot_id, "quantity": 1.0, "refundPrice": 100.0}],
                },
                headers=headers,
            )
            assert valid_ret.status_code == 201
            ret_id = valid_ret.json()["id"]

            get_ret = await ac.get(f"/api/returns/{ret_id}", headers=headers)
            assert get_ret.status_code == 200

            bad_ret = await ac.get("/api/returns/999999", headers=headers)
            assert bad_ret.status_code == 404

            recent_rets = await ac.get("/api/returns", headers=headers)
            assert recent_rets.status_code == 200
            assert len(recent_rets.json()) >= 1

@pytest.mark.asyncio
async def test_returns_multiple_items_in_single_voucher():
    """Verify returning multiple items from an invoice in a single return voucher."""
    async with lifespan(app):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            login = await ac.post("/api/auth/login", json={"username": "owner", "password": "1234"})
            token = login.json()["token"]
            headers = {"Authorization": f"Bearer {token}"}

            # 1. Create two lots
            lot1_res = await ac.post(
                "/api/inventory/lots",
                json={
                    "productId": 1,
                    "lotNumber": f"LOT-MULTI-A-{uuid.uuid4().hex[:5].upper()}",
                    "quantity": 10.0,
                    "purchaseCost": 50.0,
                    "lotRetailPrice": 100.0,
                    "lotWholesalePrice": 90.0,
                    "barcode": f"BAR-{uuid.uuid4().hex[:6]}",
                    "entryDate": "2026-09-26",
                    "expiryDate": "2028-09-26",
                },
                headers=headers,
            )
            assert lot1_res.status_code == 201
            lot1_id = lot1_res.json()["id"]

            lot2_res = await ac.post(
                "/api/inventory/lots",
                json={
                    "productId": 2,
                    "lotNumber": f"LOT-MULTI-B-{uuid.uuid4().hex[:5].upper()}",
                    "quantity": 15.0,
                    "purchaseCost": 30.0,
                    "lotRetailPrice": 60.0,
                    "lotWholesalePrice": 55.0,
                    "barcode": f"BAR-{uuid.uuid4().hex[:6]}",
                    "entryDate": "2026-09-26",
                    "expiryDate": "2028-09-26",
                },
                headers=headers,
            )
            assert lot2_res.status_code == 201
            lot2_id = lot2_res.json()["id"]

            # 2. Make sale with both lots: 2 of lot1 @ 100, 3 of lot2 @ 60 -> total 380
            sale_res = await ac.post(
                "/api/sales",
                json={
                    "saleMode": "RETAIL",
                    "items": [
                        {"lotId": lot1_id, "totalQuantity": 2.0, "unitPrice": 100.0},
                        {"lotId": lot2_id, "totalQuantity": 3.0, "unitPrice": 60.0},
                    ],
                    "discount": 0.0,
                    "paymentMethod": "CASH",
                    "cashPaid": 380.0,
                },
                headers=headers,
            )
            assert sale_res.status_code == 201
            sale = sale_res.json()
            sale_id = sale["id"]

            # 3. Process multi-item return: 1 unit of lot1 @ 100, 2 units of lot2 @ 60 -> total refund 220
            ret_res = await ac.post(
                "/api/returns",
                json={
                    "originalSaleId": sale_id,
                    "refundType": "CASH_REFUND",
                    "reason": "Customer returning unneeded seasonal chemicals",
                    "items": [
                        {"lotId": lot1_id, "quantity": 1.0, "refundPrice": 100.0, "isDamaged": False},
                        {"lotId": lot2_id, "quantity": 2.0, "refundPrice": 60.0, "isDamaged": False},
                    ],
                },
                headers=headers,
            )
            assert ret_res.status_code == 201
            ret = ret_res.json()
            assert ret["returnNo"].startswith("RET-")
            assert len(ret["items"]) == 2
            assert float(ret["totalRefundAmount"]) == 220.0

            # Verify both items in voucher response
            item_lots = {it["lotId"]: it for it in ret["items"]}
            assert float(item_lots[lot1_id]["quantity"]) == 1.0
            assert float(item_lots[lot1_id]["refundPrice"]) == 100.0
            assert float(item_lots[lot2_id]["quantity"]) == 2.0
            assert float(item_lots[lot2_id]["refundPrice"]) == 60.0
