import uuid
from datetime import datetime, date
from decimal import Decimal
import pytest
from httpx import ASGITransport, AsyncClient
from app.main import app, lifespan
from app.models.product import Product
from app.models.inventory import InventoryLot
from app.models.sale import Sale, SaleItem
from app.models.customer import Customer
from app.services.sale_service import to_sale_response

# ==============================================================================
# 1. UNIT TESTS: PROFIT CALCULATIONS IN TO_SALE_RESPONSE
# ==============================================================================

def test_to_sale_response_profit_math():
    """Unit test line_profit and total_profit calculations."""
    p = Product(id=1, product_code="P1", name_en="Prod 1", name_bn="পণ্য ১", category="Insecticide")
    lot = InventoryLot(id=10, lot_number="LOT-10", barcode="BAR-10", product=p)

    it1 = SaleItem(
        id=101,
        lot_id=10,
        lot=lot,
        total_quantity=Decimal("2.000"),
        unit_cost=Decimal("60.00"),
        unit_price=Decimal("100.00"),
        subtotal=Decimal("200.00"),
    )
    it2 = SaleItem(
        id=102,
        lot_id=10,
        lot=lot,
        total_quantity=Decimal("1.000"),
        unit_cost=Decimal("40.00"),
        unit_price=Decimal("70.00"),
        subtotal=Decimal("70.00"),
    )
    # line 1 profit: (100 - 60) * 2 = 80
    # line 2 profit: (70 - 40) * 1 = 30
    # sum line profit: 110
    # discount: 15
    # net total profit: 110 - 15 = 95.00

    c = Customer(id=1, name="Rahim", phone="01711223344")
    sale = Sale(
        id=500,
        invoice_no="INV-20260926-0000500",
        sale_date=datetime.now(),
        customer_id=1,
        customer=c,
        sale_mode="RETAIL",
        subtotal=Decimal("270.00"),
        discount=Decimal("15.00"),
        round_off=Decimal("0.00"),
        total_amount=Decimal("255.00"),
        payment_method="CASH",
        cash_paid=Decimal("255.00"),
        due_amount=Decimal("0.00"),
        items=[it1, it2],
    )

    resp = to_sale_response(sale)
    assert float(resp.items[0].line_profit) == 80.0
    assert float(resp.items[1].line_profit) == 30.0
    assert float(resp.total_profit) == 95.0
    assert resp.customer_name == "Rahim"

# ==============================================================================
# 2. INTEGRATION TESTS: SALES ENGINE & ROUTER
# ==============================================================================

@pytest.mark.asyncio
async def test_sale_digital_payment_and_change_tender():
    """Verify change amount calculation and digital payment attributes."""
    async with lifespan(app):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            login = await ac.post("/api/auth/login", json={"username": "owner", "password": "1234"})
            token = login.json()["token"]
            headers = {"Authorization": f"Bearer {token}"}

            # 1. Create fresh lot with 10 units @ 100 retail
            lot_res = await ac.post(
                "/api/inventory/lots",
                json={
                    "productId": 1,
                    "lotNumber": f"LOT-SALE-DIG-{uuid.uuid4().hex[:5].upper()}",
                    "quantity": 10.0,
                    "purchaseCost": 50.0,
                    "lotRetailPrice": 100.0,
                    "lotWholesalePrice": 90.0,
                    "barcode": f"BAR-{uuid.uuid4().hex[:6]}",
                    "entryDate": "2026-09-26",
                    "expiryDate": "2028-09-26",
                },
                headers=headers,
            )
            assert lot_res.status_code == 201
            lot_id = lot_res.json()["id"]

            # 2. Process sale with CASH + CHANGE
            # Total bill: 2 * 100 = 200, Paid: 200, Tendered: 500 -> change: 300
            cash_sale = await ac.post(
                "/api/sales",
                json={
                    "saleMode": "RETAIL",
                    "items": [{"lotId": lot_id, "totalQuantity": 2.0, "unitPrice": 100.0}],
                    "discount": 0.0,
                    "paymentMethod": "CASH",
                    "cashPaid": 200.0,
                    "cashTendered": 500.0,
                },
                headers=headers,
            )
            assert cash_sale.status_code == 201
            c_data = cash_sale.json()
            assert float(c_data["changeAmount"]) == 300.0
            assert float(c_data["cashTendered"]) == 500.0

            # 3. Process sale with DIGITAL (BKASH)
            bkash_trx = f"BK-{uuid.uuid4().hex[:8].upper()}"
            dig_sale = await ac.post(
                "/api/sales",
                json={
                    "saleMode": "RETAIL",
                    "items": [{"lotId": lot_id, "totalQuantity": 1.0, "unitPrice": 100.0}],
                    "discount": 0.0,
                    "paymentMethod": "DIGITAL",
                    "digitalPaid": 100.0,
                    "digitalMedium": "BKASH",
                    "digitalTrxId": bkash_trx,
                },
                headers=headers,
            )
            assert dig_sale.status_code == 201
            d_data = dig_sale.json()
            assert d_data["paymentMethod"] == "DIGITAL"
            assert float(d_data["digitalPaid"]) == 100.0
            assert d_data["digitalMedium"] == "BKASH"
            assert d_data["digitalTrxId"] == bkash_trx

@pytest.mark.asyncio
async def test_sale_customer_credit_and_queries():
    """Verify credit sale updates customer currentDue and test get_sale_by_id/invoice and pagination."""
    async with lifespan(app):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            login = await ac.post("/api/auth/login", json={"username": "owner", "password": "1234"})
            token = login.json()["token"]
            headers = {"Authorization": f"Bearer {token}"}

            # 1. Create Customer
            phone = f"017{str(uuid.uuid4().int)[:8]}"
            cust_res = await ac.post(
                "/api/customers",
                json={"name": "Credit Farmer", "phone": phone, "initialDue": 0.0},
                headers=headers,
            )
            assert cust_res.status_code == 201
            cust_id = cust_res.json()["id"]

            # 2. Fresh lot
            lot_res = await ac.post(
                "/api/inventory/lots",
                json={
                    "productId": 1,
                    "lotNumber": f"LOT-SALE-CR-{uuid.uuid4().hex[:5].upper()}",
                    "quantity": 10.0,
                    "purchaseCost": 50.0,
                    "lotRetailPrice": 120.0,
                    "lotWholesalePrice": 110.0,
                    "barcode": f"BAR-{uuid.uuid4().hex[:6]}",
                    "entryDate": "2026-09-26",
                    "expiryDate": "2028-09-26",
                },
                headers=headers,
            )
            assert lot_res.status_code == 201
            lot_id = lot_res.json()["id"]

            # 3. Credit sale: 2 units @ 120 = 240 bill, 100 paid, 140 due
            sale_res = await ac.post(
                "/api/sales",
                json={
                    "customerId": cust_id,
                    "saleMode": "RETAIL",
                    "items": [{"lotId": lot_id, "totalQuantity": 2.0, "unitPrice": 120.0}],
                    "discount": 0.0,
                    "paymentMethod": "CASH",
                    "cashPaid": 100.0,
                },
                headers=headers,
            )
            assert sale_res.status_code == 201
            sale = sale_res.json()
            sale_id = sale["id"]
            invoice_no = sale["invoiceNo"]
            assert float(sale["dueAmount"]) == 140.0

            # 4. Customer due should now be 140.0
            cust_after = (await ac.get(f"/api/customers/{cust_id}", headers=headers)).json()
            assert float(cust_after["currentDue"]) == 140.0

            # 5. Customer purchases endpoint
            purchases = (await ac.get(f"/api/customers/{cust_id}/purchases", headers=headers)).json()
            assert len(purchases) >= 1
            assert purchases[0]["id"] == sale_id

            # 6. Get sale by ID (200 vs 404)
            get_sale = await ac.get(f"/api/sales/{sale_id}", headers=headers)
            assert get_sale.status_code == 200
            assert get_sale.json()["invoiceNo"] == invoice_no

            bad_id = await ac.get("/api/sales/999999", headers=headers)
            assert bad_id.status_code == 404

            # 7. Get sale by invoice (200 vs 404)
            get_inv = await ac.get(f"/api/sales/invoice/{invoice_no}", headers=headers)
            assert get_inv.status_code == 200

            bad_inv = await ac.get("/api/sales/invoice/INV-NONEXISTENT", headers=headers)
            assert bad_inv.status_code == 404

            # 8. Paged sales endpoint
            paged = await ac.get("/api/sales?page=0&size=5&saleMode=RETAIL", headers=headers)
            assert paged.status_code == 200
            p_data = paged.json()
            assert "content" in p_data
            assert "totalElements" in p_data
            assert p_data["totalElements"] >= 1
