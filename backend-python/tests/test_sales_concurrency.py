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

            lots_res = await ac.get("/api/inventory/lots", headers=headers)
            lot1 = lots_res.json()[0]

            # 1. Reject sale exceeding available stock
            sale_excess = {
                "saleMode": "RETAIL",
                "items": [
                    {
                        "lotId": lot1["id"],
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
                        "lotId": lot1["id"],
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
