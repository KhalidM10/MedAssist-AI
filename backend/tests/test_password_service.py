"""
Unit tests for password validation and strength scoring.
No database required — pure function tests.
"""
import pytest
from app.services.password_service import score_password, validate_password


# ── score_password ────────────────────────────────────────────────────────────

class TestScorePassword:
    def test_too_short_scores_zero(self):
        assert score_password("Ab1!") == 0

    def test_common_password_scores_zero(self):
        assert score_password("password") == 0
        assert score_password("123456") == 0
        assert score_password("qwerty") == 0

    def test_common_password_case_insensitive(self):
        assert score_password("PASSWORD") == 0
        assert score_password("Password") == 0

    def test_kenya_specific_common_passwords_score_zero(self):
        assert score_password("nairobi") == 0
        assert score_password("medassist") == 0
        assert score_password("safari") == 0
        assert score_password("jambo") == 0

    def test_minimum_length_only_scores_one(self):
        # 8 chars, lowercase only — no uppercase, no digit, no special
        assert score_password("abcdefgh") == 1

    def test_uppercase_and_digit_scores_two(self):
        assert score_password("Abcdefg1") == 2

    def test_uppercase_digit_special_scores_three(self):
        assert score_password("Abcdef1!") == 3

    def test_12_chars_uppercase_digit_special_scores_four(self):
        assert score_password("Abcdefghij1!") == 4

    def test_score_four_requires_all_complexity(self):
        # 12 chars but no special char → should be 2, not 4
        assert score_password("Abcdefghij12") == 2

    def test_score_is_never_negative(self):
        assert score_password("") >= 0

    def test_score_is_never_above_four(self):
        assert score_password("A" * 100 + "1!aaa") <= 4

    def test_very_strong_password(self):
        assert score_password("Tr0ub4dor&3Kenya!") == 4


# ── validate_password ─────────────────────────────────────────────────────────

class TestValidatePassword:
    def test_valid_password_returns_no_errors(self):
        assert validate_password("Medassist@2024!") == []

    def test_too_short_returns_error(self):
        errors = validate_password("Ab1!")
        assert any("8 characters" in e for e in errors)

    def test_no_uppercase_returns_error(self):
        errors = validate_password("abcdef1!")
        assert any("uppercase" in e.lower() for e in errors)

    def test_no_digit_returns_error(self):
        errors = validate_password("Abcdefgh!")
        assert any("number" in e.lower() for e in errors)

    def test_no_special_char_returns_error(self):
        errors = validate_password("Abcdefg1")
        assert any("special" in e.lower() for e in errors)

    def test_common_password_returns_error(self):
        # "password123" is in _COMMON; even though it lacks uppercase/special,
        # the common-password error must be among the returned errors
        errors = validate_password("password123")
        assert any("common" in e.lower() for e in errors)

    def test_multiple_failures_return_multiple_errors(self):
        # Only 4 chars, no upper, no digit, no special
        errors = validate_password("abcd")
        assert len(errors) >= 3

    def test_exactly_8_chars_with_all_requirements(self):
        assert validate_password("Abcde1!x") == []

    def test_empty_string_fails_multiple_rules(self):
        errors = validate_password("")
        assert len(errors) >= 1

    def test_special_chars_all_accepted(self):
        for special in "!@#$%^&*":
            pw = f"Abcdefg1{special}"
            errors = validate_password(pw)
            assert not any("special" in e.lower() for e in errors), \
                f"Special char '{special}' should be accepted"

    def test_medassist_brand_name_blocked(self):
        # "medassist123" is explicitly in _COMMON to block brand-name passwords
        errors = validate_password("medassist123")
        assert any("common" in e.lower() for e in errors)
