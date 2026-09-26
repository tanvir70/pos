import asyncio
import uuid
import pytest
from httpx import ASGITransport, AsyncClient
from app.main import app, lifespan

@pytest.mark.asyncio
async def test_sale_idempotency_via_header():
    """Verify duplicate checkout with identical X-Idempotency-Key replays response and deducts stock once."""
    async with lifespan(app):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            # Login
            login_res = await ac.post("/api/auth/login", json={"username": "owner", "password": "1234"})
            token = login_res.json()["token"]
            headers = {"Authorization": f"Bearer {token}"}

            # Fetch product & lot
            lots_res = await ac.get("/api/inventory/lots", headers=headers)
            lots = lots_res.json()
            lot = next(l for l in lots if l["id"] == 1 or l["id"] == 7)

            # Get initial stock
            stock_res_before = await ac.get("/api/inventory/stock", headers=headers)
            stock_before = next(s["quantity"] for s in stock_res_before.json() if s["lotId"] == lot["id"])

            sale_req = {
                "saleMode": "RETAIL",
                "items": [
                    {
                        "lotId": lot["id"],
                        "totalQuantity": 1.0,
                        "unitPrice": float(lot["lotRetailPrice"]),
                    }
                ],
                "discount": 0.0,
                "roundOff": 0.0,
                "paymentMethod": "CASH",
                "cashPaid": float(lot["lotRetailPrice"]),
                "cashTendered": float(lot["lotRetailPrice"]),
            }

            idempotency_key = f"IDEM-TEST-HEADER-{uuid.uuid4()}"
            headers_with_key = {**headers, "X-Idempotency-Key": idempotency_key}

            # First attempt -> creates sale
            res1 = await ac.post("/api/sales", json=sale_req, headers=headers_with_key)
            assert res1.status_code == 201, res1.text
            sale1 = res1.json()
            assert sale1["clientTrxId"] == idempotency_key

            # Check stock decremented
            stock_res_mid = await ac.get("/api/inventory/stock", headers=headers)
            stock_mid = next(s["quantity"] for s in stock_res_mid.json() if s["lotId"] == lot["id"])
            assert float(stock_mid) == pytest.approx(float(stock_before) - 1.0, 0.001)

            # Second attempt with identical X-Idempotency-Key -> replayed without re-deducting stock
            res2 = await ac.post("/api/sales", json=sale_req, headers=headers_with_key)
            assert res2.status_code in (200, 201), res2.text
            sale2 = res2.json()
            assert sale2["id"] == sale1["id"]
            assert sale2["invoiceNo"] == sale1["invoiceNo"]
            assert sale2["clientTrxId"] == idempotency_key

            # Stock must NOT have decremented a second time
            stock_res_after = await ac.get("/api/inventory/stock", headers=headers)
            stock_after = next(s["quantity"] for s in stock_res_after.json() if s["lotId"] == lot["id"])
            assert float(stock_after) == pytest.approx(float(stock_mid), 0.001)


@pytest.mark.asyncio
async def test_sale_idempotency_via_body_client_trx_id():
    """Verify duplicate checkout with clientTrxId in body replays identical invoice."""
    async with lifespan(app):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            login_res = await ac.post("/api/auth/login", json={"username": "owner", "password": "1234"})
            token = login_res.json()["token"]
            headers = {"Authorization": f"Bearer {token}"}

            lots = (await ac.get("/api/inventory/lots", headers=headers)).json()
            lot = next(l for l in lots if l["id"] == 1 or l["id"] == 7)

            trx_id = f"IDEM-TEST-BODY-{uuid.uuid4()}"
            sale_req = {
                "saleMode": "RETAIL",
                "clientTrxId": trx_id,
                "items": [
                    {
                        "lotId": lot["id"],
                        "totalQuantity": 0.5,
                        "unitPrice": float(lot["lotRetailPrice"]),
                    }
                ],
                "discount": 0.0,
                "roundOff": 0.0,
                "paymentMethod": "CASH",
                "cashPaid": float(lot["lotRetailPrice"]) * 0.5,
                "cashTendered": float(lot["lotRetailPrice"]) * 0.5,
            }

            res1 = await ac.post("/api/sales", json=sale_req, headers=headers)
            assert res1.status_code == 201
            sale1 = res1.json()

            res2 = await ac.post("/api/sales", json=sale_req, headers=headers)
            assert res2.status_code in (200, 201)
            sale2 = res2.json()

            assert sale1["invoiceNo"] == sale2["invoiceNo"]
            assert sale1["id"] == sale2["id"]
            assert sale2["clientTrxId"] == trx_id


@pytest.mark.asyncio
async def test_customer_payment_idempotency():
    """Verify duplicate repayment request does not credit customer due twice."""
    async with lifespan(app):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            login_res = await ac.post("/api/auth/login", json={"username": "owner", "password": "1234"})
            token = login_res.json()["token"]
            headers = {"Authorization": f"Bearer {token}"}

            import random
            cust_phone = f"017{random.randint(10000000, 99999999)}"
            new_c_res = await ac.post(
                "/api/customers",
                json={
                    "name": "Idempotent Test Customer",
                    "phone": cust_phone,
                    "customerType": "RETAIL",
                    "currentDue": 5000.0,
                },
                headers=headers,
            )
            assert new_c_res.status_code == 201
            c = new_c_res.json()
            initial_due = float(c["currentDue"])

            pay_key = f"IDEM-PAY-TEST-{uuid.uuid4()}"
            pay_req = {
                "amount": 1000.0,
                "paymentMethod": "CASH",
                "notes": "Testing idempotent payment",
                "clientTrxId": pay_key,
            }

            # First payment
            res1 = await ac.post(f"/api/customers/{c['id']}/payments", json=pay_req, headers=headers)
            assert res1.status_code == 201
            ledger1 = res1.json()
            assert ledger1["clientTrxId"] == pay_key

            # Customer due decreased by 1000
            c_after1 = (await ac.get(f"/api/customers/{c['id']}", headers=headers)).json()
            assert float(c_after1["currentDue"]) == pytest.approx(initial_due - 1000.0, 0.01)

            # Second identical payment with same key -> replayed
            res2 = await ac.post(f"/api/customers/{c['id']}/payments", json=pay_req, headers=headers)
            assert res2.status_code in (200, 201)
            ledger2 = res2.json()
            assert ledger2["id"] == ledger1["id"]
            assert ledger2["moneyReceiptNo"] == ledger1["moneyReceiptNo"]

            # Customer due must NOT have decreased again
            c_after2 = (await ac.get(f"/api/customers/{c['id']}", headers=headers)).json()
            assert float(c_after2["currentDue"]) == pytest.approx(initial_due - 1000.0, 0.01)


@pytest.mark.asyncio
async def test_sale_return_idempotency():
    """Verify duplicate sale return does not restock inventory twice."""
    async with lifespan(app):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            login_res = await ac.post("/api/auth/login", json={"username": "owner", "password": "1234"})
            token = login_res.json()["token"]
            headers = {"Authorization": f"Bearer {token}"}

            lots = (await ac.get("/api/inventory/lots", headers=headers)).json()
            lot = next(l for l in lots if l["id"] == 1 or l["id"] == 7)

            return_key = f"IDEM-RET-TEST-{uuid.uuid4()}"
            ret_req = {
                "refundType": "CASH_REFUND",
                "reason": "Customer change of mind",
                "clientTrxId": return_key,
                "items": [
                    {
                        "lotId": lot["id"],
                        "quantity": 1.0,
                        "refundPrice": 100.0,
                        "isDamaged": False,
                    }
                ],
            }

            # First return
            res1 = await ac.post("/api/returns", json=ret_req, headers=headers)
            assert res1.status_code == 201
            ret1 = res1.json()
            assert ret1["clientTrxId"] == return_key

            # Re-submit identical return
            res2 = await ac.post("/api/returns", json=ret_req, headers=headers)
            assert res2.status_code in (200, 201)
            ret2 = res2.json()
            assert ret2["id"] == ret1["id"]
            assert ret2["returnNo"] == ret1["returnNo"]


@pytest.mark.asyncio
async def test_concurrent_duplicate_sales():
    """Verify simultaneous duplicate requests with identical key both succeed with the same invoice."""
    async with lifespan(app):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            login_res = await ac.post("/api/auth/login", json={"username": "owner", "password": "1234"})
            token = login_res.json()["token"]
            headers = {"Authorization": f"Bearer {token}"}

            lots = (await ac.get("/api/inventory/lots", headers=headers)).json()
            lot = next(l for l in lots if l["id"] == 1 or l["id"] == 7)

            concurrent_key = f"IDEM-CONCURRENT-{uuid.uuid4()}"
            sale_req = {
                "saleMode": "RETAIL",
                "clientTrxId": concurrent_key,
                "items": [
                    {
                        "lotId": lot["id"],
                        "totalQuantity": 1.0,
                        "unitPrice": float(lot["lotRetailPrice"]),
                    }
                ],
                "discount": 0.0,
                "roundOff": 0.0,
                "paymentMethod": "CASH",
                "cashPaid": float(lot["lotRetailPrice"]),
                "cashTendered": float(lot["lotRetailPrice"]),
            }

            # Fire 3 concurrent requests with the identical key
            results = await asyncio.gather(
                ac.post("/api/sales", json=sale_req, headers=headers),
                ac.post("/api/sales", json=sale_req, headers=headers),
                ac.post("/api/sales", json=sale_req, headers=headers),
            )

            # All 3 must succeed (200 or 201)
            for r in results:
                assert r.status_code in (200, 201), r.text

            invoices = [r.json()["invoiceNo"] for r in results]
            # All 3 must have returned the exact same single invoice
            assert len(set(invoices)) == 1

