import uuid
from decimal import Decimal
import pytest
from httpx import ASGITransport, AsyncClient
from app.main import app, lifespan

@pytest.mark.asyncio
async def test_sale_validation_rules():
    async with lifespan(app):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            login = await ac.post("/api/auth/login", json={"username": "owner", "password": "1234"})
            token = login.json()["token"]
            headers = {"Authorization": f"Bearer {token}"}

            lots = (await ac.get("/api/inventory/lots", headers=headers)).json()
            lot = next((l for l in lots if l["id"] == 7 or float(l["lotRetailPrice"]) > 0), lots[0])

            # 1. Negative discount rejected by schema
            neg_disc_req = {
                "saleMode": "RETAIL",
                "items": [{"lotId": lot["id"], "totalQuantity": 1.0, "unitPrice": 100.0}],
                "discount": -10.0,
                "paymentMethod": "CASH",
                "cashPaid": 100.0,
            }
            res = await ac.post("/api/sales", json=neg_disc_req, headers=headers)
            assert res.status_code == 422

            # 2. Discount exceeding subtotal rejected
            excess_disc_req = {
                "saleMode": "RETAIL",
                "items": [{"lotId": lot["id"], "totalQuantity": 1.0, "unitPrice": 100.0}],
                "discount": 150.0,
                "paymentMethod": "CASH",
                "cashPaid": 0.0,
            }
            res = await ac.post("/api/sales", json=excess_disc_req, headers=headers)
            assert res.status_code == 400
            assert "cannot exceed invoice subtotal" in res.json()["message"]

            # 3. Cash tendered less than cash paid rejected
            bad_tender_req = {
                "saleMode": "RETAIL",
                "items": [{"lotId": lot["id"], "totalQuantity": 1.0, "unitPrice": 100.0}],
                "discount": 0.0,
                "paymentMethod": "CASH",
                "cashPaid": 100.0,
                "cashTendered": 50.0,
            }
            res = await ac.post("/api/sales", json=bad_tender_req, headers=headers)
            assert res.status_code == 400
            assert "cannot be less than cash paid" in res.json()["message"]

@pytest.mark.asyncio
async def test_returns_cumulative_check_and_trap_b_negative_due():
    async with lifespan(app):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            login = await ac.post("/api/auth/login", json={"username": "owner", "password": "1234"})
            token = login.json()["token"]
            headers = {"Authorization": f"Bearer {token}"}

            # Create dedicated customer for this test
            phone_suffix = str(uuid.uuid4().int)[:8]
            cust_res = await ac.post(
                "/api/customers",
                json={
                    "name": "Audit Test Customer",
                    "phone": f"017{phone_suffix}",
                    "initialDue": 500.0,
                },
                headers=headers,
            )
            assert cust_res.status_code == 201
            customer = cust_res.json()
            cust_id = customer["id"]

            lots = (await ac.get("/api/inventory/lots", headers=headers)).json()
            lot = next((l for l in lots if l["id"] == 7), lots[0])

            # Perform a sale of 5 units to this customer (5 * 100 = 500)
            sale_res = await ac.post(
                "/api/sales",
                json={
                    "customerId": cust_id,
                    "saleMode": "RETAIL",
                    "items": [{"lotId": lot["id"], "totalQuantity": 5.0, "unitPrice": 100.0}],
                    "discount": 0.0,
                    "paymentMethod": "CASH",
                    "cashPaid": 500.0,
                },
                headers=headers,
            )
            assert sale_res.status_code == 201
            sale = sale_res.json()

            # First return: 1 unit with CASH_REFUND -> succeeds
            ret1 = await ac.post(
                "/api/returns",
                json={
                    "originalSaleId": sale["id"],
                    "customerId": cust_id,
                    "refundType": "CASH_REFUND",
                    "items": [{"lotId": lot["id"], "quantity": 1.0, "refundPrice": 100.0}],
                },
                headers=headers,
            )
            assert ret1.status_code == 201

            # Second return attempt: 5 units (cumulative 1 + 5 = 6 > 5 originally bought) -> must be rejected
            ret2 = await ac.post(
                "/api/returns",
                json={
                    "originalSaleId": sale["id"],
                    "customerId": cust_id,
                    "refundType": "CASH_REFUND",
                    "items": [{"lotId": lot["id"], "quantity": 5.0, "refundPrice": 100.0}],
                },
                headers=headers,
            )
            assert ret2.status_code == 400
            assert "Already returned" in ret2.json()["message"]

            # Trap B test: Customer has initial due 100.
            # Direct return of 1 unit @ 300 with DUE_ADJUSTMENT on customer with 100 due:
            cust2_res = await ac.post(
                "/api/customers",
                json={
                    "name": "Trap B Overflow Customer",
                    "phone": f"018{phone_suffix}",
                    "initialDue": 100.0,
                },
                headers=headers,
            )
            assert cust2_res.status_code == 201
            cust2 = cust2_res.json()
            cust2_id = cust2["id"]

            ret_trap_b = await ac.post(
                "/api/returns",
                json={
                    "customerId": cust2_id,
                    "refundType": "DUE_ADJUSTMENT",
                    "items": [{"lotId": lot["id"], "quantity": 1.0, "refundPrice": 300.0}],
                },
                headers=headers,
            )
            assert ret_trap_b.status_code == 201

            # Check customer profile: currentDue should now be 100 - 300 = -200.00
            cust_check = (await ac.get(f"/api/customers/{cust2_id}", headers=headers)).json()
            assert float(cust_check["currentDue"]) == -200.0
