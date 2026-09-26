import uuid
from datetime import date, datetime, timedelta
from decimal import Decimal
import pytest
from httpx import ASGITransport, AsyncClient
from app.main import app, lifespan
from app.database import async_session_maker
from app.services.dashboard_service import (
    get_dashboard_summary,
    get_top_selling_products,
    get_top_selling_products_paged,
)

# ==============================================================================
# 1. INTEGRATION TESTS: DASHBOARD SUMMARY METRICS & DRAWER BALANCE
# ==============================================================================

@pytest.mark.asyncio
async def test_dashboard_summary_metrics_and_drawer():
    """Verify calculation of total sales, orders, profits, cash in drawer, and dues."""
    async with lifespan(app):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            login = await ac.post("/api/auth/login", json={"username": "owner", "password": "1234"})
            token = login.json()["token"]
            headers = {"Authorization": f"Bearer {token}"}

            # Baseline summary
            base_summary_res = await ac.get("/api/dashboard/summary", headers=headers)
            assert base_summary_res.status_code == 200
            base_summary = base_summary_res.json()
            init_sales = Decimal(str(base_summary["totalSalesToday"]))
            init_cash_drawer = Decimal(str(base_summary["cashInDrawerToday"]))
            init_orders = base_summary["totalOrdersToday"]

            import random
            rand_phone = f"017{random.randint(10000000, 99999999)}"
            cust_res = await ac.post(
                "/api/customers",
                json={
                    "name": f"Dashboard Tester {uuid.uuid4().hex[:6]}",
                    "phone": rand_phone,
                    "customerType": "RETAIL",
                    "initialDue": 0.0,
                },
                headers=headers,
            )
            assert cust_res.status_code == 201
            cust_id = cust_res.json()["id"]

            # 2. Create fresh lot
            lot_res = await ac.post(
                "/api/inventory/lots",
                json={
                    "productId": 1,
                    "lotNumber": f"LOT-DASH-{uuid.uuid4().hex[:5].upper()}",
                    "quantity": 50.0,
                    "purchaseCost": 60.0,
                    "lotRetailPrice": 100.0,
                    "lotWholesalePrice": 90.0,
                    "barcode": f"BAR-DASH-{uuid.uuid4().hex[:6]}",
                    "entryDate": "2026-09-26",
                    "expiryDate": "2028-09-26",
                },
                headers=headers,
            )
            assert lot_res.status_code == 201
            lot_id = lot_res.json()["id"]

            # 3. Create Sale 1: Cash sale of 3 units @ 100 = 300.00 cash paid
            # Cost = 3 * 60 = 180. Profit = 300 - 180 = 120
            sale1_res = await ac.post(
                "/api/sales",
                json={
                    "saleMode": "RETAIL",
                    "items": [{"lotId": lot_id, "totalQuantity": 3.0, "unitPrice": 100.0}],
                    "discount": 0.0,
                    "paymentMethod": "CASH",
                    "cashPaid": 300.0,
                },
                headers=headers,
            )
            assert sale1_res.status_code == 201
            sale1_id = sale1_res.json()["id"]

            # 4. Create Sale 2: Credit sale for customer: 2 units @ 100 = 200.00 total
            # cashPaid = 50.00, dueAmount = 150.00
            sale2_res = await ac.post(
                "/api/sales",
                json={
                    "customerId": cust_id,
                    "saleMode": "RETAIL",
                    "items": [{"lotId": lot_id, "totalQuantity": 2.0, "unitPrice": 100.0}],
                    "discount": 0.0,
                    "paymentMethod": "CREDIT",
                    "cashPaid": 50.0,
                },
                headers=headers,
            )
            assert sale2_res.status_code == 201

            # 5. Customer makes cash repayment of 50.00 due
            repay_res = await ac.post(
                f"/api/customers/{cust_id}/payments",
                json={
                    "amount": 50.0,
                    "paymentMethod": "CASH",
                    "notes": "Partial debt payment",
                },
                headers=headers,
            )
            assert repay_res.status_code == 201

            # 6. Process Return on Sale 1: return 1 unit for 100.00 CASH_REFUND
            ret_res = await ac.post(
                "/api/returns",
                json={
                    "originalSaleId": sale1_id,
                    "refundType": "CASH_REFUND",
                    "items": [{"lotId": lot_id, "quantity": 1.0, "refundPrice": 100.0, "isDamaged": False}],
                },
                headers=headers,
            )
            assert ret_res.status_code == 201

            # 7. Check updated dashboard summary
            new_summary_res = await ac.get("/api/dashboard/summary", headers=headers)
            assert new_summary_res.status_code == 200
            new_summary = new_summary_res.json()

            # Sales today increased by 300 + 200 = 500
            assert Decimal(str(new_summary["totalSalesToday"])) == init_sales + Decimal("500.00")
            assert new_summary["totalOrdersToday"] == init_orders + 2

            # Cash drawer formula: sales_cash + repayments_cash - refunds_cash
            # Delta sales_cash = 300 + 50 = 350
            # Delta repayments_cash = 50
            # Delta refunds_cash = 100
            # Total delta drawer = 350 + 50 - 100 = 300.00
            assert Decimal(str(new_summary["cashInDrawerToday"])) == init_cash_drawer + Decimal("300.00")

            # Direct Service Call Verification
            async with async_session_maker() as db:
                summary_dto = await get_dashboard_summary(db)
                assert summary_dto.total_sales_today == init_sales + Decimal("500.00")
                assert summary_dto.cash_in_drawer_today == init_cash_drawer + Decimal("300.00")
                assert summary_dto.total_customers >= 1
                assert summary_dto.sales_growth == 0.0

# ==============================================================================
# 2. INTEGRATION TESTS: LOW STOCK & EXPIRING LOT ALERTS
# ==============================================================================

@pytest.mark.asyncio
async def test_dashboard_low_stock_and_expiry_alerts():
    """Verify low stock alerts and lots expiring within 30 days appear in summary."""
    async with lifespan(app):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            login = await ac.post("/api/auth/login", json={"username": "owner", "password": "1234"})
            token = login.json()["token"]
            headers = {"Authorization": f"Bearer {token}"}

            # 1. Create a product with min_stock_alert = 15
            code_unique = f"ALERT-{uuid.uuid4().hex[:6].upper()}"
            prod_res = await ac.post(
                "/api/products",
                json={
                    "productCode": code_unique,
                    "nameEn": "Alert Test Product",
                    "nameBn": "অ্যালার্ট টেস্ট পণ্য",
                    "category": "INSECTICIDE",
                    "baseUnit": "KG",
                    "minStockAlert": 15,
                    "buyingPrice": 50.0,
                    "standardRetailPrice": 100.0,
                },
                headers=headers,
            )
            assert prod_res.status_code == 201
            prod_id = prod_res.json()["id"]

            # Add only 5 units in Dokan (5 <= 15 -> triggers low stock alert)
            # Set expiry date to 10 days from now (<= 30 days -> triggers expiring soon alert)
            exp_date_str = (date.today() + timedelta(days=10)).isoformat()
            lot_res = await ac.post(
                "/api/inventory/lots",
                json={
                    "productId": prod_id,
                    "lotNumber": f"LOT-EXP-{uuid.uuid4().hex[:5].upper()}",
                    "quantity": 5.0,
                    "purchaseCost": 50.0,
                    "lotRetailPrice": 100.0,
                    "lotWholesalePrice": 90.0,
                    "barcode": f"BAR-EXP-{uuid.uuid4().hex[:6]}",
                    "entryDate": date.today().isoformat(),
                    "expiryDate": exp_date_str,
                },
                headers=headers,
            )
            assert lot_res.status_code == 201
            lot_id = lot_res.json()["id"]

            # Query summary
            summary_res = await ac.get("/api/dashboard/summary", headers=headers)
            assert summary_res.status_code == 200
            summary = summary_res.json()

            # Verify low stock product is captured
            low_stock_ids = [p["productId"] for p in summary["lowStockProducts"]]
            assert prod_id in low_stock_ids
            matched_prod = next(p for p in summary["lowStockProducts"] if p["productId"] == prod_id)
            assert matched_prod["minStockAlert"] == 15
            assert Decimal(str(matched_prod["totalStock"])) == Decimal("5.000")

            # Verify expiring lot is captured
            expiring_lot_ids = [lt["lotId"] for lt in summary["expiringLots"]]
            assert lot_id in expiring_lot_ids
            matched_lot = next(lt for lt in summary["expiringLots"] if lt["lotId"] == lot_id)
            assert matched_lot["daysUntilExpiry"] == 10
            assert Decimal(str(matched_lot["quantity"])) == Decimal("5.000")

# ==============================================================================
# 3. INTEGRATION TESTS: TOP SELLING PRODUCTS & PAGINATION
# ==============================================================================

@pytest.mark.asyncio
async def test_dashboard_top_selling_products_and_pagination():
    """Verify period filters, ranking by revenue, percentage share, and pagination."""
    async with lifespan(app):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            login = await ac.post("/api/auth/login", json={"username": "owner", "password": "1234"})
            token = login.json()["token"]
            headers = {"Authorization": f"Bearer {token}"}

            # 1. Create two distinct products
            code_a = f"TOPA-{uuid.uuid4().hex[:6].upper()}"
            prod_a_res = await ac.post(
                "/api/products",
                json={
                    "productCode": code_a,
                    "nameEn": "Top Selling A",
                    "nameBn": "টপ পণ্য এ",
                    "category": "FERTILIZER",
                    "baseUnit": "BAG",
                    "minStockAlert": 0,
                    "buyingPrice": 100.0,
                    "standardRetailPrice": 200.0,
                },
                headers=headers,
            )
            assert prod_a_res.status_code == 201
            prod_a = prod_a_res.json()

            code_b = f"TOPB-{uuid.uuid4().hex[:6].upper()}"
            prod_b_res = await ac.post(
                "/api/products",
                json={
                    "productCode": code_b,
                    "nameEn": "Top Selling B",
                    "nameBn": "টপ পণ্য বি",
                    "category": "FERTILIZER",
                    "baseUnit": "BAG",
                    "minStockAlert": 0,
                    "buyingPrice": 100.0,
                    "standardRetailPrice": 150.0,
                },
                headers=headers,
            )
            assert prod_b_res.status_code == 201
            prod_b = prod_b_res.json()

            # Lots for each
            lot_a = (await ac.post(
                "/api/inventory/lots",
                json={
                    "productId": prod_a["id"],
                    "lotNumber": f"LOT-TA-{uuid.uuid4().hex[:5].upper()}",
                    "quantity": 50.0,
                    "purchaseCost": 100.0,
                    "lotRetailPrice": 200.0,
                    "lotWholesalePrice": 180.0,
                    "barcode": f"BAR-TA-{uuid.uuid4().hex[:6]}",
                    "entryDate": date.today().isoformat(),
                    "expiryDate": "2028-12-31",
                },
                headers=headers,
            )).json()

            lot_b = (await ac.post(
                "/api/inventory/lots",
                json={
                    "productId": prod_b["id"],
                    "lotNumber": f"LOT-TB-{uuid.uuid4().hex[:5].upper()}",
                    "quantity": 50.0,
                    "purchaseCost": 100.0,
                    "lotRetailPrice": 150.0,
                    "lotWholesalePrice": 140.0,
                    "barcode": f"BAR-TB-{uuid.uuid4().hex[:6]}",
                    "entryDate": date.today().isoformat(),
                    "expiryDate": "2028-12-31",
                },
                headers=headers,
            )).json()

            # Sell 5 of Product A (Revenue = 5 * 200 = 1000)
            await ac.post(
                "/api/sales",
                json={
                    "saleMode": "RETAIL",
                    "items": [{"lotId": lot_a["id"], "totalQuantity": 5.0, "unitPrice": 200.0}],
                    "discount": 0.0,
                    "paymentMethod": "CASH",
                    "cashPaid": 1000.0,
                },
                headers=headers,
            )

            # Sell 2 of Product B (Revenue = 2 * 150 = 300)
            await ac.post(
                "/api/sales",
                json={
                    "saleMode": "RETAIL",
                    "items": [{"lotId": lot_b["id"], "totalQuantity": 2.0, "unitPrice": 150.0}],
                    "discount": 0.0,
                    "paymentMethod": "CASH",
                    "cashPaid": 300.0,
                },
                headers=headers,
            )

            # 2. Test periods via service directly
            async with async_session_maker() as db:
                for period in ["today", "week", "month", "year"]:
                    top_list = await get_top_selling_products(db, period=period, limit=10)
                    assert len(top_list) >= 2
                    # Verify descending order of revenue
                    for i in range(len(top_list) - 1):
                        assert top_list[i].total_revenue >= top_list[i + 1].total_revenue

                # Verify pagination directly via service
                paged_res = await get_top_selling_products_paged(db, period="month", page=0, size=1)
                assert paged_res.page_number == 0
                assert paged_res.page_size == 1
                assert paged_res.total_elements >= 2
                assert len(paged_res.content) == 1
                assert paged_res.first is True

            # 3. Test Router endpoints
            # Unpaged with limit param
            limit_res = await ac.get("/api/dashboard/top-selling?limit=50&period=month", headers=headers)
            assert limit_res.status_code == 200
            limit_data = limit_res.json()
            assert isinstance(limit_data, list)
            assert len(limit_data) <= 50
            # Product A should have higher revenue than Product B
            item_a = next(i for i in limit_data if i["productId"] == prod_a["id"])
            item_b = next(i for i in limit_data if i["productId"] == prod_b["id"])
            assert Decimal(str(item_a["totalRevenue"])) >= Decimal("1000.00")
            assert Decimal(str(item_b["totalRevenue"])) >= Decimal("300.00")
            assert item_a["percentageShare"] > item_b["percentageShare"]

            # Paged response via query parameters
            paged_api_res = await ac.get("/api/dashboard/top-selling?page=0&size=2&period=today", headers=headers)
            assert paged_api_res.status_code == 200
            paged_json = paged_api_res.json()
            assert "content" in paged_json
            assert "pageNumber" in paged_json
            assert "totalElements" in paged_json
            assert paged_json["pageSize"] == 2
            assert len(paged_json["content"]) == 2
