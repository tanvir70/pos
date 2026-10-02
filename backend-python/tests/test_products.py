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

@pytest.mark.asyncio
async def test_product_creation_with_atomic_initial_stock():
    async with lifespan(app):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            login = await ac.post("/api/auth/login", json={"username": "owner", "password": "1234"})
            headers = {"Authorization": f"Bearer {login.json()['token']}"}

            code = "ATOMIC-TEST-01"
            payload = {
                "productCode": code,
                "nameEn": "Virtako Atomic Inward",
                "nameBn": "ভিরটাকো",
                "companyName": "Syngenta Bangladesh Limited",
                "category": "Insecticide",
                "baseUnit": "Packet",
                "cartonMultiplier": 20.0,
                "standardRetailPrice": 60.0,
                "buyingPrice": 47.0,
                "initialStock": {
                    "quantity": 130.0,
                    "cartons": 6.0,
                    "looseUnits": 10.0,
                    "purchaseCost": 47.0,
                    "lotRetailPrice": 60.0,
                    "lotWholesalePrice": 53.0,
                },
            }
            res = await ac.post("/api/products", json=payload, headers=headers)
            assert res.status_code == 201
            body = res.json()
            assert body["productCode"] == code
            assert body["initialLot"] is not None
            assert body["initialLot"]["lotNumber"] == "LOT-01"
            assert body["initialLot"]["barcode"] == f"{code}-01"

            # Check stock overview reflects DOKAN inventory
            stock_res = await ac.get("/api/inventory/stock", headers=headers)
            assert stock_res.status_code == 200
            matched = next((s for s in stock_res.json() if s["productCode"] == code), None)
            assert matched is not None
            assert float(matched["quantity"]) == 130.0

            # Cleanup
            prod_id = body["id"]
            await ac.delete(f"/api/products/{prod_id}", headers=headers)

@pytest.mark.asyncio
async def test_atomic_rollback_on_invalid_initial_stock():
    async with lifespan(app):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            login = await ac.post("/api/auth/login", json={"username": "owner", "password": "1234"})
            headers = {"Authorization": f"Bearer {login.json()['token']}"}

            code = "ATOMIC-FAIL-01"
            # Invalid: expiry date is earlier than entry date
            payload = {
                "productCode": code,
                "nameEn": "Fail Inward",
                "nameBn": "ফেল",
                "category": "Insecticide",
                "baseUnit": "Bottle",
                "cartonMultiplier": 1.0,
                "standardRetailPrice": 100.0,
                "initialStock": {
                    "quantity": 50.0,
                    "entryDate": "2026-10-02",
                    "expiryDate": "2020-01-01",  # Past date before entry date!
                },
            }
            res = await ac.post("/api/products", json=payload, headers=headers)
            # Should fail validation (400 or 422)
            assert res.status_code in (400, 422)

            # Invariant check: product must NOT exist in the database (rolled back!)
            search_res = await ac.get(f"/api/products?query={code}", headers=headers)
            assert len(search_res.json()) == 0

@pytest.mark.asyncio
async def test_get_supported_units_and_normalization():
    async with lifespan(app):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            login = await ac.post("/api/auth/login", json={"username": "owner", "password": "1234"})
            headers = {"Authorization": f"Bearer {login.json()['token']}"}

            # 1. Supported units meta endpoint
            res = await ac.get("/api/products/units", headers=headers)
            assert res.status_code == 200
            groups = res.json()
            assert len(groups) == 3
            group_ids = [g["groupId"] for g in groups]
            assert "liquid" in group_ids
            assert "weight" in group_ids
            assert "container" in group_ids

            # 2. Tolerant normalization: 'bottle' -> 'Bottle'
            p1 = {
                "productCode": "UNIT-NORM-01",
                "nameEn": "Norm Bottle",
                "nameBn": "বোতল",
                "category": "Insecticide",
                "baseUnit": "bottle",
                "cartonMultiplier": 10.0,
                "standardRetailPrice": 100.0,
            }
            res1 = await ac.post("/api/products", json=p1, headers=headers)
            assert res1.status_code == 201
            assert res1.json()["baseUnit"] == "Bottle"
            await ac.delete(f"/api/products/{res1.json()['id']}", headers=headers)

            # 3. Tolerant normalization: 'PACK' -> 'Packet'
            p2 = {
                "productCode": "UNIT-NORM-02",
                "nameEn": "Norm Packet",
                "nameBn": "প্যাকেট",
                "category": "Fungicide",
                "baseUnit": "PACK",
                "cartonMultiplier": 20.0,
                "standardRetailPrice": 200.0,
            }
            res2 = await ac.post("/api/products", json=p2, headers=headers)
            assert res2.status_code == 201
            assert res2.json()["baseUnit"] == "Packet"
            await ac.delete(f"/api/products/{res2.json()['id']}", headers=headers)

            # 4. Rejection of invalid unit string
            p_invalid = {
                "productCode": "UNIT-FAIL-01",
                "nameEn": "Invalid Unit",
                "nameBn": "ভুল",
                "category": "Insecticide",
                "baseUnit": "random_garbage_unit",
                "cartonMultiplier": 1.0,
                "standardRetailPrice": 50.0,
            }
            res_invalid = await ac.post("/api/products", json=p_invalid, headers=headers)
            assert res_invalid.status_code == 422
            assert "Invalid unit" in str(res_invalid.json())

