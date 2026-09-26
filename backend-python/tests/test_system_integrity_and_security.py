import uuid
import pytest
from httpx import ASGITransport, AsyncClient
from app.main import app, lifespan

@pytest.mark.asyncio
async def test_barcode_service_and_endpoints():
    async with lifespan(app):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            login = await ac.post("/api/auth/login", json={"username": "owner", "password": "1234"})
            token = login.json()["token"]
            headers = {"Authorization": f"Bearer {token}"}

            # 1. Valid barcode generation returns image/png
            res = await ac.get("/api/barcode/SYN-AMI-202601")
            assert res.status_code == 200
            assert res.headers["content-type"] == "image/png"
            assert "max-age=86400" in res.headers.get("cache-control", "")
            # Valid PNG magic bytes header
            assert res.content.startswith(b"\x89PNG\r\n\x1a\n")

            # 2. Custom dimensions
            res_dim = await ac.get("/api/barcode/TEST-CODE128?width=400&height=120")
            assert res_dim.status_code == 200
            assert res_dim.content.startswith(b"\x89PNG\r\n\x1a\n")

            # 3. Invalid width (< 50) rejected with 422
            res_bad_w = await ac.get("/api/barcode/TEST-CODE128?width=30")
            assert res_bad_w.status_code == 422

            # 4. Invalid height (< 30) rejected with 422
            res_bad_h = await ac.get("/api/barcode/TEST-CODE128?height=15")
            assert res_bad_h.status_code == 422

            # 5. Lot-specific barcode image for lot 1
            res_lot = await ac.get("/api/lots/1/barcode-image")
            assert res_lot.status_code == 200
            assert res_lot.headers["content-type"] == "image/png"

            # 6. Non-existent lot returns 404
            res_bad_lot = await ac.get("/api/lots/999999/barcode-image")
            assert res_bad_lot.status_code == 404

@pytest.mark.asyncio
async def test_sql_backup_download_service():
    async with lifespan(app):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            login = await ac.post("/api/auth/login", json={"username": "owner", "password": "1234"})
            token = login.json()["token"]
            headers = {"Authorization": f"Bearer {token}"}

            res = await ac.get("/api/backup/download", headers=headers)
            assert res.status_code == 200
            assert res.headers["content-type"] == "application/sql"
            assert "attachment; filename=\"pos_backup_" in res.headers.get("content-disposition", "")
            content = res.content
            assert b"-- Al-Amin POS & Inventory Management System" in content
            assert b"CREATE TABLE" in content or b"INSERT INTO" in content

@pytest.mark.asyncio
async def test_dashboard_summary_kpi_integrity():
    async with lifespan(app):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            login = await ac.post("/api/auth/login", json={"username": "owner", "password": "1234"})
            token = login.json()["token"]
            headers = {"Authorization": f"Bearer {token}"}

            res = await ac.get("/api/dashboard/summary", headers=headers)
            assert res.status_code == 200
            data = res.json()

            # Ensure all required metrics exist and are numeric
            assert float(data["totalSalesToday"]) >= 0.0
            assert float(data["totalSalesMonth"]) >= 0.0
            assert int(data["totalOrdersToday"]) >= 0
            assert float(data["totalReturnsToday"]) >= 0.0
            assert float(data["cashInDrawerToday"]) >= 0.0
            assert int(data["totalCustomers"]) >= 0
            assert int(data["lowStockCount"]) >= 0
            assert int(data["expiringSoonCount"]) >= 0
            assert isinstance(data["expiringLots"], list)
            assert isinstance(data["lowStockProducts"], list)

@pytest.mark.asyncio
async def test_product_duplicate_code_and_price_boundaries():
    async with lifespan(app):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            login = await ac.post("/api/auth/login", json={"username": "owner", "password": "1234"})
            token = login.json()["token"]
            headers = {"Authorization": f"Bearer {token}"}

            # 1. Fetch existing product
            prods = (await ac.get("/api/products", headers=headers)).json()
            assert len(prods) > 0
            existing_code = prods[0]["productCode"]

            # 2. Attempt duplicate creation with existing productCode -> 400 Bad Request
            dup_res = await ac.post(
                "/api/products",
                json={
                    "productCode": existing_code,
                    "nameEn": "Duplicate Test Agro",
                    "nameBn": "ডুপ্লিকেট",
                    "category": "Insecticide",
                    "baseUnit": "Bottle",
                    "standardRetailPrice": 200.0,
                },
                headers=headers,
            )
            assert dup_res.status_code == 400
            assert "already exists" in dup_res.json()["message"]

            # 3. Negative retail price rejected by schema (422)
            neg_price_res = await ac.post(
                "/api/products",
                json={
                    "productCode": f"TEST-NEG-{uuid.uuid4().hex[:5]}",
                    "nameEn": "Negative Price Agro",
                    "nameBn": "নেগেটিভ",
                    "category": "Insecticide",
                    "baseUnit": "Bottle",
                    "standardRetailPrice": -50.0,
                },
                headers=headers,
            )
            assert neg_price_res.status_code == 422

@pytest.mark.asyncio
async def test_customer_duplicate_phone_enforcement():
    async with lifespan(app):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            login = await ac.post("/api/auth/login", json={"username": "owner", "password": "1234"})
            token = login.json()["token"]
            headers = {"Authorization": f"Bearer {token}"}

            # 1. Create a customer with a unique phone
            phone_suffix = str(uuid.uuid4().int)[:8]
            phone = f"017{phone_suffix}"
            create_res = await ac.post(
                "/api/customers",
                json={"name": "Primary Farmer", "phone": phone, "villageAddress": "Bhairab"},
                headers=headers,
            )
            assert create_res.status_code == 201

            # 2. Attempt duplicate creation with same phone -> 400
            dup_res = await ac.post(
                "/api/customers",
                json={"name": "Secondary Farmer", "phone": phone, "villageAddress": "Bhairab"},
                headers=headers,
            )
            assert dup_res.status_code == 400
            assert "already exists" in dup_res.json()["message"]
