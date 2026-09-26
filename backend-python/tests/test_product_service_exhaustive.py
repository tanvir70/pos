import uuid
from decimal import Decimal
import pytest
from httpx import ASGITransport, AsyncClient
from app.main import app, lifespan
from app.models.product import Product
from app.routers.products import to_product_dto

# ==============================================================================
# 1. UNIT TESTS: PRODUCT DTO
# ==============================================================================

def test_to_product_dto_mapping():
    p = Product(
        id=77,
        product_code="PROD-TEST-77",
        name_en="Virtako 40WG",
        name_bn="ভিরতাকো ৪০ ডব্লিউজি",
        company_name="Syngenta",
        category="Insecticide",
        base_unit="Pack",
        carton_multiplier=Decimal("50.000"),
        default_barcode="SYN-VIR-40WG",
        standard_retail_price=Decimal("180.00"),
        standard_wholesale_price=Decimal("170.00"),
        buying_price=Decimal("160.00"),
        min_stock_alert=10,
    )
    dto = to_product_dto(p)
    assert dto.id == 77
    assert dto.product_code == "PROD-TEST-77"
    assert dto.name_en == "Virtako 40WG"
    assert dto.carton_multiplier == Decimal("50.000")
    assert dto.standard_retail_price == Decimal("180.00")

# ==============================================================================
# 2. INTEGRATION TESTS: PRODUCT ROUTER & CRUD
# ==============================================================================

@pytest.mark.asyncio
async def test_product_price_auto_defaults_and_duplicate_handling():
    """Verify wholesale price 95% fallback, buying price fallback, and duplicate check."""
    async with lifespan(app):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            login = await ac.post("/api/auth/login", json={"username": "owner", "password": "1234"})
            token = login.json()["token"]
            headers = {"Authorization": f"Bearer {token}"}

            code = f"AUTO-{uuid.uuid4().hex[:6].upper()}"

            # 1. Create product with ONLY standardRetailPrice = 200.0
            create_res = await ac.post(
                "/api/products",
                json={
                    "productCode": code,
                    "nameEn": "Auto Pricing Agrochemical",
                    "nameBn": "অটো প্রাইসিং",
                    "category": "Fungicide",
                    "baseUnit": "Bottle",
                    "standardRetailPrice": 200.0,
                },
                headers=headers,
            )
            assert create_res.status_code == 201
            p = create_res.json()
            prod_id = p["id"]

            # Verify wholesale price defaulted to 95% of retail: 200 * 0.95 = 190.00
            assert float(p["standardWholesalePrice"]) == 190.0
            # Verify buying price defaulted to wholesale price = 190.00
            assert float(p["buyingPrice"]) == 190.0
            # Verify default barcode defaulted to product code
            assert p["defaultBarcode"] == code

            # 2. Duplicate productCode rejected with 400
            dup_res = await ac.post(
                "/api/products",
                json={
                    "productCode": code,
                    "nameEn": "Duplicate",
                    "nameBn": "ডুপ্লিকেট",
                    "category": "Fungicide",
                    "baseUnit": "Bottle",
                    "standardRetailPrice": 200.0,
                },
                headers=headers,
            )
            assert dup_res.status_code == 400
            assert "already exists" in dup_res.json()["message"]

            # 3. Clean up created product
            del_res = await ac.delete(f"/api/products/{prod_id}", headers=headers)
            assert del_res.status_code == 200

@pytest.mark.asyncio
async def test_product_query_search_bilingual_and_updates():
    """Verify search across nameEn, nameBn, and productCode, and update/delete 404s."""
    async with lifespan(app):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            login = await ac.post("/api/auth/login", json={"username": "owner", "password": "1234"})
            token = login.json()["token"]
            headers = {"Authorization": f"Bearer {token}"}

            tag = uuid.uuid4().hex[:6]
            code = f"BN-{tag.upper()}"

            # Create test product
            create_res = await ac.post(
                "/api/products",
                json={
                    "productCode": code,
                    "nameEn": f"Super Crop Booster {tag}",
                    "nameBn": f"সুপার ক্রপ বুস্টার {tag}",
                    "companyName": "Green Harvest",
                    "category": "PGR",
                    "baseUnit": "Packet",
                    "standardRetailPrice": 85.0,
                },
                headers=headers,
            )
            assert create_res.status_code == 201
            prod_id = create_res.json()["id"]

            # 1. Search by English name query
            s_en = await ac.get(f"/api/products?query={tag}", headers=headers)
            assert s_en.status_code == 200
            assert any(item["id"] == prod_id for item in s_en.json())

            # 2. Search by Bengali name query
            s_bn = await ac.get(f"/api/products?query=সুপার", headers=headers)
            assert s_bn.status_code == 200
            assert any(item["id"] == prod_id for item in s_bn.json())

            # 3. Search by code
            s_code = await ac.get(f"/api/products?query={code}", headers=headers)
            assert s_code.status_code == 200
            assert len(s_code.json()) == 1

            # 4. Partial update
            up_res = await ac.put(
                f"/api/products/{prod_id}",
                json={"standardRetailPrice": 95.0, "minStockAlert": 15},
                headers=headers,
            )
            assert up_res.status_code == 200
            updated = up_res.json()
            assert float(updated["standardRetailPrice"]) == 95.0
            assert updated["minStockAlert"] == 15

            # 5. Non-existent product operations return 404
            bad_get = await ac.get("/api/products/999999", headers=headers)
            assert bad_get.status_code == 404

            bad_put = await ac.put("/api/products/999999", json={"nameEn": "Ghost"}, headers=headers)
            assert bad_put.status_code == 404

            bad_del = await ac.delete("/api/products/999999", headers=headers)
            assert bad_del.status_code == 404

            # Clean up
            await ac.delete(f"/api/products/{prod_id}", headers=headers)
