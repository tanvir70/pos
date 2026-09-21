import pytest
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
