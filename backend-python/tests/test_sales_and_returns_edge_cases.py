import uuid
from datetime import date, timedelta
from decimal import Decimal
import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text
from app.main import app, lifespan
from app.database import engine

async def create_fresh_lot(ac: AsyncClient, headers: dict, qty: float = 50.0, retail: float = 100.0) -> int:
    res = await ac.post(
        "/api/inventory/lots",
        json={
            "productId": 1,
            "lotNumber": f"LOT-TEST-{uuid.uuid4().hex[:6].upper()}",
            "quantity": qty,
            "purchaseCost": 50.0,
            "lotRetailPrice": retail,
            "lotWholesalePrice": retail * 0.9,
            "barcode": f"BAR-{uuid.uuid4().hex[:6].upper()}",
            "entryDate": "2026-09-26",
            "expiryDate": "2028-09-26",
        },
        headers=headers,
    )
    assert res.status_code == 201
    return res.json()["id"]

@pytest.mark.asyncio
async def test_sale_round_off_and_discount_boundaries():
    async with lifespan(app):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            login = await ac.post("/api/auth/login", json={"username": "owner", "password": "1234"})
            token = login.json()["token"]
            headers = {"Authorization": f"Bearer {token}"}

            lot_id = await create_fresh_lot(ac, headers, qty=50.0, retail=100.0)

            # 1. Round off > 50.0 rejected by schema (422)
            res_excess_round = await ac.post(
                "/api/sales",
                json={
                    "saleMode": "RETAIL",
                    "items": [{"lotId": lot_id, "totalQuantity": 1.0, "unitPrice": 100.0}],
                    "discount": 0.0,
                    "roundOff": 55.0,
                    "paymentMethod": "CASH",
                    "cashPaid": 45.0,
                },
                headers=headers,
            )
            assert res_excess_round.status_code == 422

            # 2. Round off < 0.0 rejected by schema (422)
            res_neg_round = await ac.post(
                "/api/sales",
                json={
                    "saleMode": "RETAIL",
                    "items": [{"lotId": lot_id, "totalQuantity": 1.0, "unitPrice": 100.0}],
                    "discount": 0.0,
                    "roundOff": -5.0,
                    "paymentMethod": "CASH",
                    "cashPaid": 105.0,
                },
                headers=headers,
            )
            assert res_neg_round.status_code == 422

            # 3. Valid round-off adjustment of 5.0 reduces net bill
            res_valid_round = await ac.post(
                "/api/sales",
                json={
                    "saleMode": "RETAIL",
                    "items": [{"lotId": lot_id, "totalQuantity": 1.0, "unitPrice": 100.0}],
                    "discount": 0.0,
                    "roundOff": 5.0,
                    "paymentMethod": "CASH",
                    "cashPaid": 95.0,
                },
                headers=headers,
            )
            assert res_valid_round.status_code == 201
            sale_data = res_valid_round.json()
            assert float(sale_data["totalAmount"]) == 95.0
            assert float(sale_data["roundOff"]) == 5.0

@pytest.mark.asyncio
async def test_sale_anonymous_due_forbidden():
    async with lifespan(app):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            login = await ac.post("/api/auth/login", json={"username": "owner", "password": "1234"})
            token = login.json()["token"]
            headers = {"Authorization": f"Bearer {token}"}

            lot_id = await create_fresh_lot(ac, headers, qty=10.0, retail=100.0)

            # Attempting sale with due to anonymous walk-in customer (no customerId) must fail with 400
            res_anon_due = await ac.post(
                "/api/sales",
                json={
                    "saleMode": "RETAIL",
                    "items": [{"lotId": lot_id, "totalQuantity": 1.0, "unitPrice": 100.0}],
                    "discount": 0.0,
                    "roundOff": 0.0,
                    "paymentMethod": "CASH",
                    "cashPaid": 50.0,  # 50 due on anonymous buyer
                },
                headers=headers,
            )
            assert res_anon_due.status_code == 400
            assert "Cannot have due amount for anonymous walk-in customer" in res_anon_due.json()["message"]

@pytest.mark.asyncio
async def test_sale_expired_lot_forbidden():
    async with lifespan(app):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            login = await ac.post("/api/auth/login", json={"username": "owner", "password": "1234"})
            token = login.json()["token"]
            headers = {"Authorization": f"Bearer {token}"}

            # Seed an expired lot directly in the DB
            expired_lot_num = f"EXP-{uuid.uuid4().hex[:6].upper()}"
            exp_lot_id = None
            try:
                async with engine.begin() as conn:
                    await conn.execute(
                        text(
                            """
                            INSERT INTO inventory_lot (
                                version, product_id, lot_number, entry_date, expiry_date,
                                purchase_cost, lot_retail_price, lot_wholesale_price, barcode, created_at
                            ) VALUES (
                                0, 1, :lot_num, '2023-01-01', '2024-01-01',
                                50.0, 100.0, 90.0, :barcode, CURRENT_TIMESTAMP
                            )
                            """
                        ),
                        {"lot_num": expired_lot_num, "barcode": f"BAR-{expired_lot_num}"},
                    )
                    lot_row = (
                        await conn.execute(
                            text("SELECT id FROM inventory_lot WHERE lot_number = :lot_num"),
                            {"lot_num": expired_lot_num},
                        )
                    ).fetchone()
                    exp_lot_id = lot_row[0]
                    await conn.execute(
                        text(
                            "INSERT INTO stock_inventory (version, lot_id, location, quantity) VALUES (0, :lot_id, 'DOKAN', 10.0)"
                        ),
                        {"lot_id": exp_lot_id},
                    )

                # Attempt to sell expired lot
                res = await ac.post(
                    "/api/sales",
                    json={
                        "saleMode": "RETAIL",
                        "items": [{"lotId": exp_lot_id, "totalQuantity": 1.0, "unitPrice": 100.0}],
                        "discount": 0.0,
                        "paymentMethod": "CASH",
                        "cashPaid": 100.0,
                    },
                    headers=headers,
                )
                assert res.status_code == 400
                assert "Pesticide Ordinance 1971" in res.json()["message"]
            finally:
                if exp_lot_id:
                    async with engine.begin() as conn:
                        await conn.execute(text("DELETE FROM stock_inventory WHERE lot_id = :id"), {"id": exp_lot_id})
                        await conn.execute(text("DELETE FROM inventory_lot WHERE id = :id"), {"id": exp_lot_id})

@pytest.mark.asyncio
async def test_sale_insufficient_stock():
    async with lifespan(app):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            login = await ac.post("/api/auth/login", json={"username": "owner", "password": "1234"})
            token = login.json()["token"]
            headers = {"Authorization": f"Bearer {token}"}

            lot_id = await create_fresh_lot(ac, headers, qty=5.0, retail=100.0)

            # Attempt to buy astronomical quantity (999999.0)
            res = await ac.post(
                "/api/sales",
                json={
                    "saleMode": "RETAIL",
                    "items": [{"lotId": lot_id, "totalQuantity": 999999.0, "unitPrice": 100.0}],
                    "discount": 0.0,
                    "paymentMethod": "CASH",
                    "cashPaid": 100.0,
                },
                headers=headers,
            )
            assert res.status_code == 400
            assert "exceeds available stock" in res.json()["message"]

@pytest.mark.asyncio
async def test_customer_payment_repayment_rules():
    async with lifespan(app):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            login = await ac.post("/api/auth/login", json={"username": "owner", "password": "1234"})
            token = login.json()["token"]
            headers = {"Authorization": f"Bearer {token}"}

            # 1. Customer with initial due 200.0
            phone_suffix = str(uuid.uuid4().int)[:8]
            cust_res = await ac.post(
                "/api/customers",
                json={"name": "Debt Test Customer", "phone": f"017{phone_suffix}", "initialDue": 200.0},
                headers=headers,
            )
            assert cust_res.status_code == 201
            cust_id = cust_res.json()["id"]

            # 2. Payment exceeding current due (e.g. 250 > 200) rejected with 400
            res_excess = await ac.post(
                f"/api/customers/{cust_id}/payments",
                json={"amount": 250.0, "paymentMethod": "CASH"},
                headers=headers,
            )
            assert res_excess.status_code == 400
            assert "cannot exceed current outstanding due" in res_excess.json()["message"]

            # 3. Non-positive payment rejected by schema (422)
            res_zero = await ac.post(
                f"/api/customers/{cust_id}/payments",
                json={"amount": 0.0, "paymentMethod": "CASH"},
                headers=headers,
            )
            assert res_zero.status_code == 422

            # 4. Valid payment of 100.0
            res_pay = await ac.post(
                f"/api/customers/{cust_id}/payments",
                json={"amount": 100.0, "paymentMethod": "CASH", "notes": "Half payment"},
                headers=headers,
            )
            assert res_pay.status_code == 201
            ledger_entry = res_pay.json()
            assert float(ledger_entry["credit"]) == 100.0
            assert float(ledger_entry["balanceAfter"]) == 100.0
            assert ledger_entry["moneyReceiptNo"].startswith("DUE-")

            # 5. Clear remaining 100.0
            res_pay_rest = await ac.post(
                f"/api/customers/{cust_id}/payments",
                json={"amount": 100.0, "paymentMethod": "CASH"},
                headers=headers,
            )
            assert res_pay_rest.status_code == 201
            assert float(res_pay_rest.json()["balanceAfter"]) == 0.0

            # 6. Payment when due is 0.0 raises 400
            res_zero_due = await ac.post(
                f"/api/customers/{cust_id}/payments",
                json={"amount": 50.0, "paymentMethod": "CASH"},
                headers=headers,
            )
            assert res_zero_due.status_code == 400
            assert "Customer has no outstanding due to collect" in res_zero_due.json()["message"]

@pytest.mark.asyncio
async def test_customer_search_wildcard_escaping():
    async with lifespan(app):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            login = await ac.post("/api/auth/login", json={"username": "owner", "password": "1234"})
            token = login.json()["token"]
            headers = {"Authorization": f"Bearer {token}"}

            # Searching for literal '%' should only match customers whose name/phone contains '%'
            res_pct = await ac.get("/api/customers?query=%25", headers=headers)
            assert res_pct.status_code == 200
            # None of our test or seed customers have '%' in their name, so this must return empty list
            assert len(res_pct.json()) == 0

            # Searching for literal '_' should only match customers containing '_'
            res_und = await ac.get("/api/customers?query=_", headers=headers)
            assert res_und.status_code == 200
            assert len(res_und.json()) == 0

@pytest.mark.asyncio
async def test_returns_expired_lot_auto_quarantine():
    async with lifespan(app):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            login = await ac.post("/api/auth/login", json={"username": "owner", "password": "1234"})
            token = login.json()["token"]
            headers = {"Authorization": f"Bearer {token}"}

            # Seed an expired lot
            exp_lot_num = f"RET-EXP-{uuid.uuid4().hex[:5].upper()}"
            exp_lot_id = None
            try:
                async with engine.begin() as conn:
                    await conn.execute(
                        text(
                            """
                            INSERT INTO inventory_lot (
                                version, product_id, lot_number, entry_date, expiry_date,
                                purchase_cost, lot_retail_price, lot_wholesale_price, barcode, created_at
                            ) VALUES (
                                0, 1, :lot_num, '2023-01-01', '2024-01-01',
                                50.0, 100.0, 90.0, :barcode, CURRENT_TIMESTAMP
                            )
                            """
                        ),
                        {"lot_num": exp_lot_num, "barcode": f"BAR-{exp_lot_num}"},
                    )
                    lot_row = (
                        await conn.execute(
                            text("SELECT id FROM inventory_lot WHERE lot_number = :lot_num"),
                            {"lot_num": exp_lot_num},
                        )
                    ).fetchone()
                    exp_lot_id = lot_row[0]

                # Return this expired lot with isDamaged=False
                ret_res = await ac.post(
                    "/api/returns",
                    json={
                        "refundType": "CASH_REFUND",
                        "reason": "Customer found past expiry date at home",
                        "items": [
                            {
                                "lotId": exp_lot_id,
                                "quantity": 2.0,
                                "refundPrice": 100.0,
                                "isDamaged": False,  # Client claimed not physically damaged
                                "restockLocation": "DOKAN",  # Client requested Dokan restock
                            }
                        ],
                    },
                    headers=headers,
                )
                assert ret_res.status_code == 201
                ret_data = ret_res.json()
                # Under Pesticide Ordinance 1971, system MUST force QUARANTINE regardless of client parameters
                assert ret_data["items"][0]["restockLocation"] == "QUARANTINE"
            finally:
                if exp_lot_id:
                    async with engine.begin() as conn:
                        await conn.execute(text("DELETE FROM sale_return_item WHERE lot_id = :id"), {"id": exp_lot_id})
                        await conn.execute(text("DELETE FROM stock_inventory WHERE lot_id = :id"), {"id": exp_lot_id})
                        await conn.execute(text("DELETE FROM inventory_lot WHERE id = :id"), {"id": exp_lot_id})

@pytest.mark.asyncio
async def test_returns_cumulative_monetary_refund_cap():
    async with lifespan(app):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            login = await ac.post("/api/auth/login", json={"username": "owner", "password": "1234"})
            token = login.json()["token"]
            headers = {"Authorization": f"Bearer {token}"}

            lot_id = await create_fresh_lot(ac, headers, qty=10.0, retail=100.0)

            # Create sale with discount: 2 units @ 100 = 200, discount = 50 -> total bill = 150
            sale_res = await ac.post(
                "/api/sales",
                json={
                    "saleMode": "RETAIL",
                    "items": [{"lotId": lot_id, "totalQuantity": 2.0, "unitPrice": 100.0}],
                    "discount": 50.0,
                    "paymentMethod": "CASH",
                    "cashPaid": 150.0,
                },
                headers=headers,
            )
            assert sale_res.status_code == 201
            sale = sale_res.json()
            assert float(sale["totalAmount"]) == 150.0

            # Attempt to return 2 units @ full 100.0 rate = 200 refund (> 150 total amount paid) -> must fail
            excess_refund_res = await ac.post(
                "/api/returns",
                json={
                    "originalSaleId": sale["id"],
                    "refundType": "CASH_REFUND",
                    "items": [{"lotId": lot_id, "quantity": 2.0, "refundPrice": 100.0}],
                },
                headers=headers,
            )
            assert excess_refund_res.status_code == 400
            assert "exceeds remaining refundable amount" in excess_refund_res.json()["message"]

@pytest.mark.asyncio
async def test_sqlite_pragmas_active():
    async with engine.connect() as conn:
        fk_val = (await conn.execute(text("PRAGMA foreign_keys;"))).scalar()
        assert fk_val == 1, "PRAGMA foreign_keys must be 1 (ON)"

        wal_val = (await conn.execute(text("PRAGMA journal_mode;"))).scalar()
        assert str(wal_val).lower() == "wal", "PRAGMA journal_mode must be WAL"
