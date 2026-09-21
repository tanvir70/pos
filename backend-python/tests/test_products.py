import pytest
from httpx import ASGITransport, AsyncClient
from app.main import app, lifespan

@pytest.mark.asyncio
async def test_product_crud_and_search():
    async with lifespan(app):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            # Login
            login = await ac.post("/api/auth/login", json={"username": "owner", "password": "1234"})
            token = login.json()["token"]
            headers = {"Authorization": f"Bearer {token}"}

            # List products
            res = await ac.get("/api/products", headers=headers)
            assert res.status_code == 200
            initial_count = len(res.json())

            # Create product
            new_prod = {
                "productCode": "TEST-CHM-01",
                "nameEn": "Test Agrochemical",
                "nameBn": "টেস্ট কেমিক্যাল",
                "companyName": "Test Chem Ltd",
                "category": "Insecticide",
                "baseUnit": "Bottle",
                "cartonMultiplier": 10.0,
                "standardRetailPrice": 150.0,
            }
            create_res = await ac.post("/api/products", json=new_prod, headers=headers)
            assert create_res.status_code == 201
            prod_id = create_res.json()["id"]
            assert create_res.json()["productCode"] == "TEST-CHM-01"

            # Search product
            search_res = await ac.get("/api/products?query=Test", headers=headers)
            assert search_res.status_code == 200
            assert any(p["productCode"] == "TEST-CHM-01" for p in search_res.json())

            # Update product
            update_res = await ac.put(
                f"/api/products/{prod_id}",
                json={"standardRetailPrice": 160.0},
                headers=headers,
            )
            assert update_res.status_code == 200
            assert float(update_res.json()["standardRetailPrice"]) == 160.0

            # Delete product
            del_res = await ac.delete(f"/api/products/{prod_id}", headers=headers)
            assert del_res.status_code == 200
