import uuid
from decimal import Decimal
import pytest
from httpx import ASGITransport, AsyncClient
from app.main import app, lifespan
from app.models.customer import Customer, CustomerLedger
from app.schemas.customer import CustomerRequest, CustomerPaymentRequest
from app.services import customer_service

# ==============================================================================
# 1. UNIT TESTS: DTO CONVERTERS
# ==============================================================================

def test_to_customer_dto_mapping():
    c = Customer(
        id=99,
        name="Abdur Rahim",
        father_name="Late Moniruddin",
        business_name="Rahim Agro",
        phone="01711223344",
        whatsapp_number="01711223344",
        email="rahim@example.com",
        village_address="Kandapara",
        land_area="10 Bigha",
        customer_type="RETAIL",
        total_purchases=Decimal("15000.00"),
        current_due=Decimal("250.00"),
        mfs_type="BKASH",
        mfs_number="01711223344",
        bank_name="Sonali Bank",
        bank_branch="Bhairab",
        bank_account_no="1234567890",
    )
    dto = customer_service.to_customer_dto(c)
    assert dto.id == 99
    assert dto.name == "Abdur Rahim"
    assert dto.father_name == "Late Moniruddin"
    assert dto.phone == "01711223344"
    assert dto.current_due == Decimal("250.00")
    assert dto.land_area == "10 Bigha"

def test_to_ledger_dto_mapping():
    from datetime import datetime
    l = CustomerLedger(
        id=55,
        customer_id=99,
        transaction_date=datetime(2026, 9, 26, 12, 0, 0),
        transaction_type="PAYMENT",
        debit=Decimal("0.00"),
        credit=Decimal("150.00"),
        balance_after=Decimal("100.00"),
        money_receipt_no="DUE-20260926-0000001",
        sale_id=None,
        notes="Partial repayment",
        client_trx_id="CL-TRX-123",
    )
    dto = customer_service.to_ledger_dto(l)
    assert dto.id == 55
    assert dto.customer_id == 99
    assert dto.transaction_type == "PAYMENT"
    assert dto.credit == Decimal("150.00")
    assert dto.balance_after == Decimal("100.00")
    assert dto.money_receipt_no == "DUE-20260926-0000001"

# ==============================================================================
# 2. INTEGRATION TESTS: CUSTOMER CRUD & LEDGER
# ==============================================================================

@pytest.mark.asyncio
async def test_customer_lifecycle_and_due_opening():
    """Test customer creation with initial due, ledger entry, and update."""
    async with lifespan(app):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            login = await ac.post("/api/auth/login", json={"username": "owner", "password": "1234"})
            token = login.json()["token"]
            headers = {"Authorization": f"Bearer {token}"}

            phone_suffix = str(uuid.uuid4().int)[:8]
            phone = f"017{phone_suffix}"

            # 1. Create customer with initial due 350.0
            create_res = await ac.post(
                "/api/customers",
                json={
                    "name": "Karim Mia",
                    "phone": phone,
                    "villageAddress": "Char Shindur",
                    "landArea": "3 Bigha",
                    "customerType": "RETAIL",
                    "initialDue": 350.0,
                },
                headers=headers,
            )
            assert create_res.status_code == 201
            cust = create_res.json()
            assert cust["name"] == "Karim Mia"
            assert float(cust["currentDue"]) == 350.0
            cust_id = cust["id"]

            # 2. Check customer ledger contains OPENING_DUE entry
            ledger_res = await ac.get(f"/api/customers/{cust_id}/ledger", headers=headers)
            assert ledger_res.status_code == 200
            entries = ledger_res.json()
            assert len(entries) == 1
            assert entries[0]["transactionType"] == "INVOICE_BILL"
            assert float(entries[0]["debit"]) == 350.0
            assert float(entries[0]["balanceAfter"]) == 350.0

            # 3. Update customer details
            update_res = await ac.put(
                f"/api/customers/{cust_id}",
                json={
                    "name": "Karim Mia Updated",
                    "phone": phone,
                    "villageAddress": "Char Shindur Bazaar",
                    "landArea": "4 Bigha",
                },
                headers=headers,
            )
            assert update_res.status_code == 200
            updated = update_res.json()
            assert updated["name"] == "Karim Mia Updated"
            assert updated["villageAddress"] == "Char Shindur Bazaar"
            assert updated["landArea"] == "4 Bigha"

            # 4. Get customer by ID (200 vs 404)
            get_res = await ac.get(f"/api/customers/{cust_id}", headers=headers)
            assert get_res.status_code == 200
            assert get_res.json()["id"] == cust_id

            bad_get = await ac.get("/api/customers/999999", headers=headers)
            assert bad_get.status_code == 404

@pytest.mark.asyncio
async def test_customer_search_and_filters():
    """Test customer search query, customer type filter, and next-due-invoice-no."""
    async with lifespan(app):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            login = await ac.post("/api/auth/login", json={"username": "owner", "password": "1234"})
            token = login.json()["token"]
            headers = {"Authorization": f"Bearer {token}"}

            unique_tag = f"SEARCH-{uuid.uuid4().hex[:6]}"
            phone1 = f"018{str(uuid.uuid4().int)[:8]}"
            phone2 = f"019{str(uuid.uuid4().int)[:8]}"

            # Create Retail Customer
            c1 = await ac.post(
                "/api/customers",
                json={"name": f"Farmer {unique_tag}", "phone": phone1, "customerType": "RETAIL"},
                headers=headers,
            )
            assert c1.status_code == 201

            # Create Wholesale Dealer
            c2 = await ac.post(
                "/api/customers",
                json={"name": f"Dealer {unique_tag}", "phone": phone2, "customerType": "WHOLESALE"},
                headers=headers,
            )
            assert c2.status_code == 201

            # Search by tag
            res_query = await ac.get(f"/api/customers?query={unique_tag}", headers=headers)
            assert res_query.status_code == 200
            assert len(res_query.json()) == 2

            # Filter by type RETAIL
            res_retail = await ac.get(f"/api/customers?query={unique_tag}&type=RETAIL", headers=headers)
            assert res_retail.status_code == 200
            assert len(res_retail.json()) == 1
            assert res_retail.json()[0]["customerType"] == "RETAIL"

            # Filter by type WHOLESALE
            res_ws = await ac.get(f"/api/customers?query={unique_tag}&type=WHOLESALE", headers=headers)
            assert res_ws.status_code == 200
            assert len(res_ws.json()) == 1
            assert res_ws.json()[0]["customerType"] == "WHOLESALE"

            # Check next-due-invoice-no router endpoint
            due_no_res = await ac.get("/api/customers/next-due-invoice-no", headers=headers)
            assert due_no_res.status_code == 200
            assert due_no_res.json()["dueInvoiceNo"].startswith("DUE-")
