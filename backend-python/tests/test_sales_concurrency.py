import pytest
from httpx import ASGITransport, AsyncClient
from app.main import app, lifespan

@pytest.mark.asyncio
async def test_sale_business_rules_validation():
    async with lifespan(app):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            login = await ac.post("/api/auth/login", json={"username": "owner", "password": "1234"})
            token = login.json()["token"]
            headers = {"Authorization": f"Bearer {token}"}

            stocks = (await ac.get("/api/inventory/stock?inStockOnly=true", headers=headers)).json()
            stock_item = next(s for s in stocks if float(s["quantity"]) >= 5.0 and (not s.get("expiryDate") or s["expiryDate"] >= "2026-09-26"))
            lot1_id = stock_item["lotId"]

            # 1. Reject sale exceeding available stock
            sale_excess = {
                "saleMode": "RETAIL",
                "items": [
                    {
                        "lotId": lot1_id,
                        "totalQuantity": 999999.0,
                        "unitPrice": 100.0,
                    }
                ],
                "paymentMethod": "CASH",
                "cashPaid": 100.0,
            }
            res_excess = await ac.post("/api/sales", json=sale_excess, headers=headers)
            assert res_excess.status_code == 400
            assert "exceeds available stock" in res_excess.json()["message"]

            # 2. Reject due for anonymous walk-in customer
            sale_walkin_due = {
                "customerId": None,
                "saleMode": "RETAIL",
                "items": [
                    {
                        "lotId": lot1_id,
                        "totalQuantity": 1.0,
                        "unitPrice": 100.0,
                    }
                ],
                "paymentMethod": "CASH",
                "cashPaid": 50.0,  # leaves 50 due
            }
            res_due = await ac.post("/api/sales", json=sale_walkin_due, headers=headers)
            assert res_due.status_code == 400
            assert "Cannot have due amount for anonymous walk-in" in res_due.json()["message"]
