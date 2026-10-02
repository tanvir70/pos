import pytest
from httpx import ASGITransport, AsyncClient
from app.main import app, lifespan
from app.services.auth_service import create_access_token, decode_access_token, hash_password, verify_password

def test_password_hash_and_verify():
    raw = "owner123"
    hashed = hash_password(raw)
    assert verify_password(raw, hashed) is True
    assert verify_password("wrongpassword", hashed) is False

def test_jwt_token_roundtrip():
    token = create_access_token(data={"sub": "owner", "role": "ROLE_OWNER"})
    payload = decode_access_token(token)
    assert payload["sub"] == "owner"
    assert payload["role"] == "ROLE_OWNER"

@pytest.mark.asyncio
async def test_auth_login_endpoints():
    async with lifespan(app):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            # 1. Invalid password
            bad_pw = await ac.post("/api/auth/login", json={"username": "owner", "password": "wrongpassword"})
            assert bad_pw.status_code == 401
            assert "Invalid username or password" in bad_pw.json()["message"]

            # 2. Unknown user
            unknown_user = await ac.post("/api/auth/login", json={"username": "nonexistent_user", "password": "1234"})
            assert unknown_user.status_code == 401
            assert "Invalid username or password" in unknown_user.json()["message"]

            # 3. Successful login with owner
            good_login = await ac.post("/api/auth/login", json={"username": "owner", "password": "1234"})
            assert good_login.status_code == 200
            data = good_login.json()
            assert "token" in data
            assert data["username"] == "owner"
            assert data["role"] == "ROLE_OWNER"

@pytest.mark.asyncio
async def test_auth_me_endpoint_security():
    async with lifespan(app):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            # 1. Missing token
            res_no_token = await ac.get("/api/auth/me")
            assert res_no_token.status_code == 401

            # 2. Invalid token
            res_bad_token = await ac.get("/api/auth/me", headers={"Authorization": "Bearer invalid.jwt.token"})
            assert res_bad_token.status_code == 401

            # 3. Valid token
            login = await ac.post("/api/auth/login", json={"username": "owner", "password": "1234"})
            token = login.json()["token"]
            res_valid = await ac.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
            assert res_valid.status_code == 200
            profile = res_valid.json()
            assert profile["username"] == "owner"
            assert profile["active"] is True

@pytest.mark.asyncio
async def test_change_password_endpoint():
    async with lifespan(app):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            # Login
            login = await ac.post("/api/auth/login", json={"username": "owner", "password": "1234"})
            token = login.json()["token"]
            headers = {"Authorization": f"Bearer {token}"}

            # Wrong current password
            bad_pw = await ac.post(
                "/api/auth/change-password",
                headers=headers,
                json={"currentPassword": "wrongpassword", "newPassword": "BrandNewSecretPassword123!"},
            )
            assert bad_pw.status_code == 400
            assert "Current password is incorrect" in bad_pw.json()["message"]

            # Too short new password
            short_pw = await ac.post(
                "/api/auth/change-password",
                headers=headers,
                json={"currentPassword": "owner123", "newPassword": "123"},
            )
            assert short_pw.status_code == 400

            # Successful password change
            success = await ac.post(
                "/api/auth/change-password",
                headers=headers,
                json={"currentPassword": "owner123", "newPassword": "NewSecurePassword#2026"},
            )
            assert success.status_code == 200
            assert success.json()["status"] == "SUCCESS"

            # Verify login with new password works
            new_login = await ac.post(
                "/api/auth/login",
                json={"username": "owner", "password": "NewSecurePassword#2026"},
            )
            assert new_login.status_code == 200

            # Restore original password for test idempotency
            restore = await ac.post(
                "/api/auth/change-password",
                headers={"Authorization": f"Bearer {new_login.json()['token']}"},
                json={"currentPassword": "NewSecurePassword#2026", "newPassword": "owner123"},
            )
            assert restore.status_code == 200

