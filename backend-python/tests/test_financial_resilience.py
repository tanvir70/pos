import uuid
from decimal import Decimal
import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text
from app.database import engine
from app.main import app, lifespan
from app.models.inventory import StockInventory
from app.models.customer import CustomerLedger

@pytest.mark.asyncio
async def test_financial_audit_endpoint_healthy():
    """Verify that a standard system state passes the automated financial integrity audit."""
    async with lifespan(app):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            # Login
            login = await ac.post("/api/auth/login", json={"username": "owner", "password": "1234"})
            assert login.status_code == 200
            token = login.json()["token"]
            headers = {"Authorization": f"Bearer {token}"}

            audit_res = await ac.get("/api/backup/financial-audit", headers=headers)
            assert audit_res.status_code == 200
            report = audit_res.json()
            assert "status" in report
            assert report["status"] in ("HEALTHY", "DISCREPANCIES_DETECTED")
            assert "totalSalesChecked" in report
            assert "totalCustomersChecked" in report

@pytest.mark.asyncio
async def test_cash_drawer_tender_math_isolation():
    """Verify cash drawer math: handing 1000 note on 200 bill properly records cashPaid=200, tendered=1000, change=800."""
    async with lifespan(app):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            login = await ac.post("/api/auth/login", json={"username": "owner", "password": "1234"})
            token = login.json()["token"]
            headers = {"Authorization": f"Bearer {token}"}

            # 1. Create a lot
            lot_res = await ac.post(
                "/api/inventory/lots",
                json={
                    "productId": 1,
                    "lotNumber": f"LOT-CASH-{uuid.uuid4().hex[:6].upper()}",
                    "quantity": 10.0,
                    "purchaseCost": 50.0,
                    "lotRetailPrice": 100.0,
                    "lotWholesalePrice": 90.0,
                    "barcode": f"BAR-{uuid.uuid4().hex[:7]}",
                    "entryDate": "2026-09-26",
                    "expiryDate": "2028-09-26",
                },
                headers=headers,
            )
            assert lot_res.status_code == 201
            lot_id = lot_res.json()["id"]

            # 2. Customer buys 2 units = 200 total, hands 1000 note
            sale_res = await ac.post(
                "/api/sales",
                json={
                    "saleMode": "RETAIL",
                    "items": [{"lotId": lot_id, "totalQuantity": 2.0, "unitPrice": 100.0}],
                    "discount": 0.0,
                    "paymentMethod": "CASH",
                    "cashPaid": 1000.0,  # Cashier entered 1000 in cash input
                    "cashTendered": 1000.0,
                },
                headers=headers,
            )
            assert sale_res.status_code == 201
            sale = sale_res.json()

            # Accounting invariants verification:
            # Total bill is 200.00
            assert float(sale["totalAmount"]) == 200.0
            # Cash paid credited to drawer revenue must be capped at 200.00 (not 1000.00)
            assert float(sale["cashPaid"]) == 200.0
            # Cash tendered is 1000.00
            assert float(sale["cashTendered"]) == 1000.0
            # Change returned is 800.00
            assert float(sale["changeAmount"]) == 800.0
            # Due is 0.00
            assert float(sale["dueAmount"]) == 0.0

@pytest.mark.asyncio
async def test_digital_overpayment_rejected():
    """Verify that passing digitalPaid > totalAmount is strictly rejected."""
    async with lifespan(app):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            login = await ac.post("/api/auth/login", json={"username": "owner", "password": "1234"})
            token = login.json()["token"]
            headers = {"Authorization": f"Bearer {token}"}

            lot_res = await ac.post(
                "/api/inventory/lots",
                json={
                    "productId": 1,
                    "lotNumber": f"LOT-DIG-OVER-{uuid.uuid4().hex[:6].upper()}",
                    "quantity": 5.0,
                    "purchaseCost": 50.0,
                    "lotRetailPrice": 100.0,
                    "lotWholesalePrice": 90.0,
                    "barcode": f"BAR-{uuid.uuid4().hex[:7]}",
                    "entryDate": "2026-09-26",
                    "expiryDate": "2028-09-26",
                },
                headers=headers,
            )
            assert lot_res.status_code == 201
            lot_id = lot_res.json()["id"]

            bad_res = await ac.post(
                "/api/sales",
                json={
                    "saleMode": "RETAIL",
                    "items": [{"lotId": lot_id, "totalQuantity": 1.0, "unitPrice": 100.0}],
                    "discount": 0.0,
                    "paymentMethod": "DIGITAL",
                    "digitalPaid": 250.0,  # 250 > 100 total
                    "digitalMedium": "BKASH",
                },
                headers=headers,
            )
            assert bad_res.status_code == 400
            assert "Digital paid" in bad_res.json()["message"]

@pytest.mark.asyncio
async def test_database_check_constraint_negative_stock():
    """Verify database-level check constraint blocks negative stock commit."""
    async with lifespan(app):
        from sqlalchemy.exc import IntegrityError
        with pytest.raises(IntegrityError):
            async with engine.begin() as conn:
                await conn.execute(
                    text("INSERT INTO stock_inventory (lot_id, location, quantity) VALUES (1, 'QUARANTINE_TEST', -5.0)")
                )

@pytest.mark.asyncio
async def test_database_check_constraint_negative_ledger():
    """Verify database-level check constraint blocks negative ledger debits/credits."""
    async with lifespan(app):
        from sqlalchemy.exc import IntegrityError
        with pytest.raises(IntegrityError):
            async with engine.begin() as conn:
                await conn.execute(
                    text("INSERT INTO customer_ledger (customer_id, transaction_type, debit, credit, balance_after) VALUES (1, 'CORRUPT', -100.0, 0, 100.0)")
                )

@pytest.mark.asyncio
async def test_ledger_reconciliation_self_healing():
    """Verify automated detection and self-healing reconciliation of customer ledger drift."""
    async with lifespan(app):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            login = await ac.post("/api/auth/login", json={"username": "owner", "password": "1234"})
            token = login.json()["token"]
            headers = {"Authorization": f"Bearer {token}"}

            # 1. Create a customer with initial due 500
            phone_suffix = str(uuid.uuid4().int)[:8]
            c_res = await ac.post(
                "/api/customers",
                json={"name": "Reconciliation Test Customer", "phone": f"017{phone_suffix}", "initialDue": 500.0},
                headers=headers,
            )
            assert c_res.status_code == 201
            customer = c_res.json()
            cust_id = customer["id"]

            # 2. Artificially corrupt stored current_due directly in DB (simulating an external data glitch)
            async with engine.begin() as conn:
                await conn.execute(
                    text("UPDATE customer SET current_due = 999.0 WHERE id = :cid"),
                    {"cid": cust_id},
                )

            # 3. Financial audit must detect the drift
            audit_res = await ac.get("/api/backup/financial-audit", headers=headers)
            assert audit_res.status_code == 200
            audit_data = audit_res.json()
            assert audit_data["status"] == "DISCREPANCIES_DETECTED"
            drift_entry = next(
                (a for a in audit_data["ledgerAnomalies"] if a["customerId"] == cust_id), None
            )
            assert drift_entry is not None
            assert float(drift_entry["storedDue"]) == 999.0
            assert float(drift_entry["ledgerDue"]) == 500.0

            # 4. Trigger self-healing reconciliation
            rec_res = await ac.post(f"/api/backup/reconcile-customer/{cust_id}", headers=headers)
            assert rec_res.status_code == 200
            rec_data = rec_res.json()
            assert rec_data["status"] == "RECONCILED"
            assert float(rec_data["reconciledDue"]) == 500.0

            # 5. Verify customer profile is now healed
            cust_check = (await ac.get(f"/api/customers/{cust_id}", headers=headers)).json()
            assert float(cust_check["currentDue"]) == 500.0

            # 6. Verify subsequent financial audit confirms complete mathematical reconciliation
            audit_res2 = await ac.get("/api/backup/financial-audit", headers=headers)
            assert audit_res2.status_code == 200
            healed_entry = next(
                (a for a in audit_res2.json()["ledgerAnomalies"] if a["customerId"] == cust_id), None
            )
            assert healed_entry is None, "Customer still reported as anomaly after reconciliation!"

@pytest.mark.asyncio
async def test_negative_customer_due_rejected():
    """Verify that creating a customer with negative currentDue or initialDue is rejected by schema."""
    async with lifespan(app):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            login = await ac.post("/api/auth/login", json={"username": "owner", "password": "1234"})
            token = login.json()["token"]
            headers = {"Authorization": f"Bearer {token}"}

            phone_suffix = str(uuid.uuid4().int)[:8]
            res1 = await ac.post(
                "/api/customers",
                json={"name": "Bad Customer", "phone": f"017{phone_suffix}", "currentDue": -100.0},
                headers=headers,
            )
            assert res1.status_code == 422

            res2 = await ac.post(
                "/api/customers",
                json={"name": "Bad Customer 2", "phone": f"017{phone_suffix}", "initialDue": -50.0},
                headers=headers,
            )
            assert res2.status_code == 422
