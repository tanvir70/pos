import pytest
from httpx import ASGITransport, AsyncClient
from app.main import app, lifespan

@pytest.mark.asyncio
async def test_dealership_complete_business_flow():
    async with lifespan(app):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            # 1. Login
            login_res = await ac.post("/api/auth/login", json={"username": "owner", "password": "1234"})
            assert login_res.status_code == 200, login_res.text
            login_data = login_res.json()
            assert "token" in login_data
            token = login_data["token"]
            headers = {"Authorization": f"Bearer {token}"}

            # 2. Get Products
            prod_res = await ac.get("/api/products", headers=headers)
            assert prod_res.status_code == 200
            products = prod_res.json()
            assert len(products) >= 6
            p1 = next((p for p in products if p["productCode"] == "SYN-AMI-TOP"), products[0])

            # 3. Get Lots
            lots_res = await ac.get(f"/api/inventory/lots?productId={p1['id']}", headers=headers)
            assert lots_res.status_code == 200
            lots = lots_res.json()
            assert len(lots) >= 1
            lot1 = next((l for l in lots if l["id"] == 1 or l["id"] == 7), lots[0])

            # 4. Get Customers
            cust_res = await ac.get("/api/customers", headers=headers)
            assert cust_res.status_code == 200
            customers = cust_res.json()
            assert len(customers) >= 1
            c1 = customers[0]
            initial_due = float(c1["currentDue"])

            # 5. Process Sale with 7-digit invoice
            sale_req = {
                "customerId": c1["id"],
                "saleMode": "RETAIL",
                "items": [
                    {
                        "lotId": lot1["id"],
                        "totalQuantity": 2.0,
                        "unitPrice": float(lot1["lotRetailPrice"]),
                    }
                ],
                "discount": 0.0,
                "roundOff": 0.0,
                "paymentMethod": "CASH",
                "cashPaid": 500.0,
                "cashTendered": 500.0,
            }
            sale_res = await ac.post("/api/sales", json=sale_req, headers=headers)
            assert sale_res.status_code == 201, sale_res.text
            sale_data = sale_res.json()

            # Check 7-digit invoice code
            invoice_no = sale_data["invoiceNo"]
            assert invoice_no.startswith("INV-")
            code_part = invoice_no.split("-")[2]
            assert len(code_part) == 7, f"Invoice number {invoice_no} does not have 7 digits"

            # 6. Check Customer updated due
            c1_updated = (await ac.get(f"/api/customers/{c1['id']}", headers=headers)).json()
            expected_due = initial_due + float(sale_data["dueAmount"])
            assert float(c1_updated["currentDue"]) == pytest.approx(expected_due, 0.01)

            # 7. Record Due Payment with 7-digit receipt
            pay_res = await ac.post(
                f"/api/customers/{c1['id']}/payments",
                json={"amount": 200.0, "paymentMethod": "CASH", "notes": "Counter test payment"},
                headers=headers,
            )
            assert pay_res.status_code == 201, pay_res.text
            pay_data = pay_res.json()
            receipt_no = pay_data["moneyReceiptNo"]
            assert receipt_no.startswith("DUE-")
            assert len(receipt_no.split("-")[2]) == 7, f"Due receipt number {receipt_no} does not have 7 digits"

            # 8. Process Sale Return with damaged item (Quarantine routing)
            ret_req = {
                "originalSaleId": sale_data["id"],
                "customerId": c1["id"],
                "refundType": "DUE_ADJUSTMENT",
                "reason": "Leaking bottle seal",
                "items": [
                    {
                        "lotId": lot1["id"],
                        "quantity": 1.0,
                        "refundPrice": float(lot1["lotRetailPrice"]),
                        "isDamaged": True,
                    }
                ],
            }
            ret_res = await ac.post("/api/returns", json=ret_req, headers=headers)
            assert ret_res.status_code == 201, ret_res.text
            ret_data = ret_res.json()
            ret_no = ret_data["returnNo"]
            assert ret_no.startswith("RET-")
            assert len(ret_no.split("-")[2]) == 7, f"Return number {ret_no} does not have 7 digits"
            assert ret_data["items"][0]["restockLocation"] == "QUARANTINE"

            # 9. Check Dashboard Summary
            dash_res = await ac.get("/api/dashboard/summary", headers=headers)
            assert dash_res.status_code == 200, dash_res.text
            dash_data = dash_res.json()
            assert float(dash_data["totalSalesToday"]) >= float(sale_data["totalAmount"])
            assert int(dash_data["totalOrdersToday"]) >= 1

            # 10. Check Barcode Generation
            barcode_res = await ac.get(f"/api/barcode/{lot1['barcode']}")
            assert barcode_res.status_code == 200
            assert barcode_res.headers["content-type"] == "image/png"
            assert barcode_res.headers["cache-control"] == "public, max-age=86400"
            assert len(barcode_res.content) > 100

            # 11. Check SQL Backup Download
            backup_res = await ac.get("/api/backup/download", headers=headers)
            assert backup_res.status_code == 200
            assert backup_res.headers["content-type"] == "application/sql"
            assert "attachment; filename=\"pos_backup_" in backup_res.headers["content-disposition"]
            assert b"-- Al-Amin POS & Inventory Management System" in backup_res.content
