import pytest
import random
from httpx import ASGITransport, AsyncClient
from app.main import app, lifespan

@pytest.mark.asyncio
async def test_customer_crud_and_land_area():
    async with lifespan(app):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            login = await ac.post("/api/auth/login", json={"username": "owner", "password": "1234"})
            token = login.json()["token"]
            headers = {"Authorization": f"Bearer {token}"}

            unique_phone = f"017{random.randint(10000000, 99999999)}"
            new_customer = {
                "name": "Haji Abdur Rahim",
                "phone": unique_phone,
                "fatherName": "Late Moniruddin",
                "villageAddress": "Kandapara, Belabo",
                "landArea": "5 Bigha",
                "customerType": "RETAIL",
            }

            # Create customer
            create_res = await ac.post("/api/customers", json=new_customer, headers=headers)
            assert create_res.status_code == 201
            cust_data = create_res.json()
            assert cust_data["name"] == "Haji Abdur Rahim"
            assert cust_data["landArea"] == "5 Bigha"
            assert cust_data["fatherName"] == "Late Moniruddin"
            cust_id = cust_data["id"]

            # Update customer with new land area and village
            update_payload = {
                "name": "Haji Abdur Rahim",
                "phone": unique_phone,
                "fatherName": "Late Moniruddin",
                "villageAddress": "Binnabaid, Belabo",
                "landArea": "6.5 Bigha",
                "customerType": "RETAIL",
            }
            update_res = await ac.put(f"/api/customers/{cust_id}", json=update_payload, headers=headers)
            assert update_res.status_code == 200
            updated_data = update_res.json()
            assert updated_data["landArea"] == "6.5 Bigha"
            assert updated_data["villageAddress"] == "Binnabaid, Belabo"

            # Get customer by id
            get_res = await ac.get(f"/api/customers/{cust_id}", headers=headers)
            assert get_res.status_code == 200
            assert get_res.json()["landArea"] == "6.5 Bigha"

@pytest.mark.asyncio
async def test_customer_phone_validation():
    async with lifespan(app):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            login = await ac.post("/api/auth/login", json={"username": "owner", "password": "1234"})
            token = login.json()["token"]
            headers = {"Authorization": f"Bearer {token}"}

            # Alphabetic characters in phone should fail
            bad_phone_res = await ac.post(
                "/api/customers",
                json={"name": "Test Alphabet Phone", "phone": "017123abcde"},
                headers=headers,
            )
            assert bad_phone_res.status_code == 422

            # Less than 11 digits should fail
            short_phone_res = await ac.post(
                "/api/customers",
                json={"name": "Test Short Phone", "phone": "01712345"},
                headers=headers,
            )
            assert short_phone_res.status_code == 422

            # Formatted / punctuated phone should be sanitized to 11 digits
            rand_suffix = random.randint(10000000, 99999999)
            formatted_phone = f"+880 17-{str(rand_suffix)[:4]}-{str(rand_suffix)[4:]}"
            valid_res = await ac.post(
                "/api/customers",
                json={"name": "Test Formatted Phone", "phone": formatted_phone},
                headers=headers,
            )
            assert valid_res.status_code == 201
            assert valid_res.json()["phone"] == f"017{rand_suffix}"
