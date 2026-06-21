"""
Unit tests for JWT token creation and decoding.
No database required — pure cryptographic function tests.
"""
import time
from datetime import timedelta

import pytest
from jose import JWTError

from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)


# ── Password hashing ──────────────────────────────────────────────────────────

class TestPasswordHashing:
    def test_hash_is_not_plaintext(self):
        h = hash_password("MyPassword1!")
        assert h != "MyPassword1!"

    def test_hash_starts_with_bcrypt_prefix(self):
        h = hash_password("MyPassword1!")
        assert h.startswith("$2b$")

    def test_correct_password_verifies(self):
        h = hash_password("MyPassword1!")
        assert verify_password("MyPassword1!", h) is True

    def test_wrong_password_fails_verification(self):
        h = hash_password("MyPassword1!")
        assert verify_password("WrongPassword!", h) is False

    def test_empty_string_hashes_and_verifies(self):
        h = hash_password("")
        assert verify_password("", h) is True
        assert verify_password("x", h) is False

    def test_same_password_produces_different_hashes(self):
        h1 = hash_password("MyPassword1!")
        h2 = hash_password("MyPassword1!")
        assert h1 != h2  # bcrypt uses random salt

    def test_unicode_password_hashes(self):
        pw = "Pässwörd1!"
        h = hash_password(pw)
        assert verify_password(pw, h) is True


# ── Access tokens ─────────────────────────────────────────────────────────────

class TestAccessToken:
    def test_access_token_decodes_correctly(self):
        token = create_access_token({"sub": "user-123", "role": "patient"})
        payload = decode_token(token)
        assert payload["sub"] == "user-123"
        assert payload["role"] == "patient"

    def test_access_token_type_is_access(self):
        token = create_access_token({"sub": "user-123"})
        payload = decode_token(token)
        assert payload["type"] == "access"

    def test_access_token_has_expiry(self):
        token = create_access_token({"sub": "user-123"})
        payload = decode_token(token)
        assert "exp" in payload

    def test_access_token_custom_expiry(self):
        token = create_access_token({"sub": "user-123"}, expires_delta=timedelta(hours=2))
        payload = decode_token(token)
        # exp should be roughly now + 2h (within 10s tolerance)
        assert payload["exp"] > time.time() + 7100

    def test_expired_access_token_raises(self):
        token = create_access_token({"sub": "user-123"}, expires_delta=timedelta(seconds=-1))
        with pytest.raises(JWTError):
            decode_token(token)

    def test_tampered_token_raises(self):
        token = create_access_token({"sub": "user-123"})
        tampered = token[:-5] + "XXXXX"
        with pytest.raises(JWTError):
            decode_token(tampered)

    def test_empty_token_raises(self):
        with pytest.raises(JWTError):
            decode_token("")

    def test_garbage_token_raises(self):
        with pytest.raises(JWTError):
            decode_token("not.a.jwt")

    def test_different_users_get_different_tokens(self):
        t1 = create_access_token({"sub": "user-1"})
        t2 = create_access_token({"sub": "user-2"})
        assert t1 != t2

    def test_all_roles_encoded_correctly(self):
        roles = ["patient", "clinic_admin", "clinic_doctor",
                 "clinic_receptionist", "clinic_pharmacist", "super_admin"]
        for role in roles:
            token = create_access_token({"sub": "user-123", "role": role})
            assert decode_token(token)["role"] == role


# ── Refresh tokens ────────────────────────────────────────────────────────────

class TestRefreshToken:
    def test_refresh_token_decodes_correctly(self):
        token = create_refresh_token({"sub": "user-123"})
        payload = decode_token(token)
        assert payload["sub"] == "user-123"

    def test_refresh_token_type_is_refresh(self):
        token = create_refresh_token({"sub": "user-123"})
        payload = decode_token(token)
        assert payload["type"] == "refresh"

    def test_refresh_token_has_longer_expiry_than_access(self):
        access = create_access_token({"sub": "u"})
        refresh = create_refresh_token({"sub": "u"})
        access_exp = decode_token(access)["exp"]
        refresh_exp = decode_token(refresh)["exp"]
        assert refresh_exp > access_exp

    def test_refresh_type_differs_from_access_type(self):
        access = create_access_token({"sub": "u"})
        refresh = create_refresh_token({"sub": "u"})
        assert decode_token(access)["type"] != decode_token(refresh)["type"]

    def test_refresh_token_not_accepted_as_access(self):
        # The deps layer checks payload["type"] == "access" — verify types differ
        refresh = create_refresh_token({"sub": "u"})
        payload = decode_token(refresh)
        assert payload.get("type") != "access"


# ── Token security properties ─────────────────────────────────────────────────

class TestTokenSecurity:
    def test_sub_preserved_through_encode_decode_cycle(self):
        user_id = "550e8400-e29b-41d4-a716-446655440000"
        token = create_access_token({"sub": user_id})
        assert decode_token(token)["sub"] == user_id

    def test_extra_claims_preserved(self):
        token = create_access_token({"sub": "u", "clinic_id": "clinic-abc"})
        payload = decode_token(token)
        assert payload["clinic_id"] == "clinic-abc"

    def test_token_is_string(self):
        assert isinstance(create_access_token({"sub": "u"}), str)
        assert isinstance(create_refresh_token({"sub": "u"}), str)
