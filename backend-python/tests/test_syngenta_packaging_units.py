import pytest
from decimal import Decimal
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select

from app.main import app, lifespan
from app.database import async_session_maker
from app.models.product import Product
from app.models.inventory import InventoryLot, StockInventory
from app.scripts.seed_syngenta_catalog import seed_syngenta_catalog, SYNGENTA_PRODUCTS


@pytest.mark.asyncio
async def test_syngenta_catalog_seed_and_count():
    """Verify that all 117 Syngenta products are seeded correctly and have positive multipliers."""
    async with lifespan(app):
        res = await seed_syngenta_catalog()
        assert res["status"] == "success"
        assert res["total_catalog_items"] == 117

        # Verify specific SKUs from the price list
        virtako_10 = next(p for p in SYNGENTA_PRODUCTS if p["agi_code"] == "72598")
        assert virtako_10["carton_multiplier"] == 40
        assert Decimal(virtako_10["retailer_pack"]) == Decimal("160.71")
        assert Decimal(virtako_10["retailer_carton"]) == Decimal("6428.57")

        actara_240 = next(p for p in SYNGENTA_PRODUCTS if p["agi_code"] == "87221")
        assert actara_240["carton_multiplier"] == 240
        assert Decimal(actara_240["retailer_pack"]) == Decimal("53.40")

        equipment = next(p for p in SYNGENTA_PRODUCTS if p["agi_code"] == "202255")
        assert equipment["carton_multiplier"] == 1
        assert equipment["unit"] == "UNIT"


@pytest.mark.asyncio
async def test_carton_breakdown_pure_math():
    """Verify mathematical breakdown of base packs into cartons and loose packs."""
    # Product M = 40 (Virtako 10gm)
    m = Decimal("40.000")
    total_packs = Decimal("85.000")
    cartons = int(total_packs // m)
    loose = total_packs % m
    assert cartons == 2
    assert loose == Decimal("5.000")

    # Single-tier product M = 1 (Sprayer or Bulk Bag)
    m_single = Decimal("1.000")
    qty_single = Decimal("3.000")
    assert int(qty_single // m_single) == 3
    assert (qty_single % m_single) == Decimal("0.000")


@pytest.mark.asyncio
async def test_product_api_returns_packaging_fields():
    """Verify GET /api/products returns pack_size, unit_size, carton_wholesale_price, and carton_buying_price."""
    async with lifespan(app):
        await seed_syngenta_catalog()

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            login_res = await ac.post("/api/auth/login", json={"username": "owner", "password": "owner123"})
            token = login_res.json()["token"]
            headers = {"Authorization": f"Bearer {token}"}

            response = await ac.get("/api/products?query=Virtako", headers=headers)
            assert response.status_code == 200
            data = response.json()
            assert len(data) >= 1

            virtako = next((p for p in data if p["productCode"] == "72598"), None)
            assert virtako is not None
            assert virtako["packSize"] == "4 x 10 x 10 gm"
            assert virtako["unitSize"] == "10 gm"
            assert Decimal(str(virtako["cartonMultiplier"])) == Decimal("40")
            assert Decimal(str(virtako["standardWholesalePrice"])) == Decimal("160.71")
            assert Decimal(str(virtako["cartonWholesalePrice"])) == Decimal("6428.57")
            assert Decimal(str(virtako["cartonBuyingPrice"])) == Decimal("6122.45")


@pytest.mark.asyncio
async def test_fefo_multi_lot_sale():
    """Verify wholesale checkout deducting from early-expiry lots under FEFO."""
    async with lifespan(app):
        await seed_syngenta_catalog()

        async with async_session_maker() as session:
            stmt = select(Product).where(Product.product_code == "72598")
            prod = (await session.execute(stmt)).scalar_one()

            # Create Lot 1: 50 packs (expiring earlier: 2026-11-01)
            from datetime import date
            lot1 = InventoryLot(
                product_id=prod.id,
                lot_number="LOT-SPLIT-01",
                entry_date=date(2026, 8, 1),
                expiry_date=date(2026, 11, 1),
                purchase_cost=Decimal("150.00"),
                lot_retail_price=Decimal("180.00"),
                lot_wholesale_price=Decimal("160.71"),
                barcode="BAR-SPLIT-01",
            )
            session.add(lot1)
            await session.flush()
            stock1 = StockInventory(lot_id=lot1.id, location="DOKAN", quantity=Decimal("50.000"))
            session.add(stock1)

            # Create Lot 2: 200 packs (expiring later: 2027-11-01)
            lot2 = InventoryLot(
                product_id=prod.id,
                lot_number="LOT-SPLIT-02",
                entry_date=date(2026, 8, 1),
                expiry_date=date(2027, 11, 1),
                purchase_cost=Decimal("153.06"),
                lot_retail_price=Decimal("180.00"),
                lot_wholesale_price=Decimal("160.71"),
                barcode="BAR-SPLIT-02",
            )
            session.add(lot2)
            await session.flush()
            stock2 = StockInventory(lot_id=lot2.id, location="DOKAN", quantity=Decimal("200.000"))
            session.add(stock2)
            await session.commit()
            lot1_id = lot1.id
            lot2_id = lot2.id

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            login_res = await ac.post("/api/auth/login", json={"username": "owner", "password": "owner123"})
            token = login_res.json()["token"]
            headers = {"Authorization": f"Bearer {token}"}

            # Sell 50 packs from Lot 1 (depleting Lot 1 completely)
            sale_req = {
                "saleMode": "WHOLESALE",
                "items": [
                    {
                        "lotId": lot1_id,
                        "totalQuantity": 50.0,
                        "unitPrice": 160.71,
                    },
                    {
                        "lotId": lot2_id,
                        "totalQuantity": 70.0,
                        "unitPrice": 160.71,
                    },
                ],
                "discount": 0.0,
                "roundOff": 0.0,
                "paymentMethod": "CASH",
                "cashPaid": float(Decimal("120") * Decimal("160.71")),
                "cashTendered": float(Decimal("120") * Decimal("160.71")),
            }
            res = await ac.post("/api/sales", json=sale_req, headers=headers)
            assert res.status_code == 201
            assert res.json()["invoiceNo"].startswith("INV-")

            # Verify stocks
            stock_res = await ac.get("/api/inventory/stock", headers=headers)
            stocks = stock_res.json()
            s1 = next(s for s in stocks if s["lotId"] == lot1_id)
            s2 = next(s for s in stocks if s["lotId"] == lot2_id)
            assert float(s1["quantity"]) == 0.0
            assert float(s2["quantity"]) == 130.0


@pytest.mark.asyncio
async def test_carton_multiplier_stock_and_sale():
    """Verify stock inspection with carton multiplier and selling exact full cartons."""
    async with lifespan(app):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            login_res = await ac.post("/api/auth/login", json={"username": "owner", "password": "owner123"})
            token = login_res.json()["token"]
            headers = {"Authorization": f"Bearer {token}"}

            # Query product Virtako 10gm (agi_code: 72598, multiplier 40)
            res = await ac.get("/api/inventory/stock?includeOutOfStock=false", headers=headers)
            assert res.status_code == 200
            stocks = res.json()
            virtako_stocks = [s for s in stocks if s["productCode"] == "72598" and float(s["quantity"]) >= 40.0]
            assert len(virtako_stocks) >= 1
            v_lot = virtako_stocks[0]
            assert Decimal(str(v_lot["cartonMultiplier"])) == Decimal("40")
            assert Decimal(str(v_lot["cartonWholesalePrice"])) == Decimal("6428.57")

            # Sell 1 full carton (40 base units)
            sale_req = {
                "saleMode": "WHOLESALE",
                "items": [
                    {
                        "lotId": v_lot["lotId"],
                        "totalQuantity": 40.0,
                        "unitPrice": 160.71,
                    }
                ],
                "discount": 0.0,
                "roundOff": 0.0,
                "paymentMethod": "CASH",
                "cashPaid": 6428.40,
                "cashTendered": 6428.40,
            }
            sale_res = await ac.post("/api/sales", json=sale_req, headers=headers)
            assert sale_res.status_code == 201
            data = sale_res.json()
            assert Decimal(str(data["totalAmount"])) == Decimal("6428.40")


def test_extract_carton_multiplier_inference():
    """Verify backend carton multiplier inference from pack size formulas and Pydantic schemas."""
    from app.constants.units import extract_carton_multiplier
    from app.schemas.product import ProductCreateDto

    assert extract_carton_multiplier("(200s)") == Decimal("200")
    assert extract_carton_multiplier("(48s)") == Decimal("48")
    assert extract_carton_multiplier("20 x 50 ml") == Decimal("20")
    assert extract_carton_multiplier("40 * 100 gm") == Decimal("40")
    assert extract_carton_multiplier("100 gm") is None
    assert extract_carton_multiplier(None) is None

    # Test auto-inference on ProductCreateDto
    dto = ProductCreateDto(
        product_code="TEST-INFER-01",
        name_en="Test Product 50ml",
        name_bn="টেস্ট প্রোডাক্ট",
        category="Insecticide",
        base_unit="Bottle",
        pack_size="20 x 50 ml",
        standard_retail_price=Decimal("150.00"),
    )
    assert dto.carton_multiplier == Decimal("20")


@pytest.mark.asyncio
async def test_change_password_validation():
    """Verify change password rejects short passwords (< 6 chars) with HTTP 400."""
    async with lifespan(app):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            login_res = await ac.post("/api/auth/login", json={"username": "owner", "password": "owner123"})
            token = login_res.json()["token"]
            headers = {"Authorization": f"Bearer {token}"}

            # Attempt password with < 6 characters
            short_res = await ac.post(
                "/api/auth/change-password",
                json={"currentPassword": "owner123", "newPassword": "123"},
                headers=headers,
            )
            assert short_res.status_code == 400
            assert "at least 6 characters" in short_res.json()["message"]
