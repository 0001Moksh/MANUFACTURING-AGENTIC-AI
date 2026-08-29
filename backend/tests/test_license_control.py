from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone

import pytest

from app.license_control import LicenseValidator, LicenseValidationResult, generate_test_license


@pytest.fixture
def validator():
    return LicenseValidator(public_key_pem=None)


def _license_fixture(validator: LicenseValidator, *, days_valid: int = 365):
    payload = {
        "license_id": "LIC-TEST-001",
        "customer_id": "CUST-001",
        "customer_name": "ABC Manufacturing",
        "product": "MANUFACTURING_AGENTIC_AI",
        "license_type": "ANNUAL",
        "issued_at": (datetime.now(timezone.utc) - timedelta(days=1)).isoformat(),
        "expires_at": (datetime.now(timezone.utc) + timedelta(days=days_valid)).isoformat(),
        "installation_id": "INSTALL-123",
        "features": ["MES", "SCADA", "ERP", "IoT"],
        "limits": {"max_users": 50},
        "version": "1.0",
        "key_id": "test-key-1",
        "token_1": "e9d6f7f2dce44fe4a234d44a9d6c4f36",
        "token_2": "b4b62f5f1d2a4c7c9f2d5f37f25e9b1d",
        "token_3": "58d93713489348ec9db1d1d7e103b83b",
        "token_4": "99a3c2f8cbf549f97d2b7ff23d74f5ef",
        "token_5": "c5f15d12eaf74b18a4afefd9a8f2b95a",
    }
    return validator.build_license_file(payload, installation_id_override="INSTALL-123")


def test_valid_license_passes(validator: LicenseValidator):
    file_bytes = _license_fixture(validator)
    result = validator.validate_license_bytes(file_bytes, installation_id="INSTALL-123")
    assert result.is_valid is True
    assert result.status == "VALID"


def test_expired_license_blocks(validator: LicenseValidator):
    file_bytes = _license_fixture(validator, days_valid=-5)
    result = validator.validate_license_bytes(file_bytes, installation_id="INSTALL-123")
    assert result.is_valid is False
    assert result.status in {"EXPIRED", "VALIDATION_ERROR"}


def test_modified_expiry_blocks(validator: LicenseValidator):
    file_bytes = _license_fixture(validator)
    payload = validator.decode_license_bytes(file_bytes)["payload"]
    payload["expires_at"] = (datetime.now(timezone.utc) + timedelta(days=2000)).isoformat()
    attacker_validator = LicenseValidator()
    tampered = attacker_validator.build_license_file(payload, installation_id_override="INSTALL-123")
    result = validator.validate_license_bytes(tampered, installation_id="INSTALL-123")
    assert result.is_valid is False


def test_modified_customer_blocks(validator: LicenseValidator):
    file_bytes = _license_fixture(validator)
    payload = validator.decode_license_bytes(file_bytes)["payload"]
    payload["customer_name"] = "Hacked Customer"
    attacker_validator = LicenseValidator()
    tampered = attacker_validator.build_license_file(payload, installation_id_override="INSTALL-123")
    result = validator.validate_license_bytes(tampered, installation_id="INSTALL-123")
    assert result.is_valid is False


def test_modified_feature_blocks(validator: LicenseValidator):
    file_bytes = _license_fixture(validator)
    payload = validator.decode_license_bytes(file_bytes)["payload"]
    payload["features"] = ["MES", "SCADA", "ERP", "HACKED"]
    attacker_validator = LicenseValidator()
    tampered = attacker_validator.build_license_file(payload, installation_id_override="INSTALL-123")
    result = validator.validate_license_bytes(tampered, installation_id="INSTALL-123")
    assert result.is_valid is False


def test_invalid_signature_blocks(validator: LicenseValidator):
    file_bytes = _license_fixture(validator)
    result = validator.validate_license_bytes(file_bytes + b"tamper", installation_id="INSTALL-123")
    assert result.is_valid is False
    assert result.status in {"INVALID", "TAMPERED", "VALIDATION_ERROR"}


def test_wrong_installation_blocks(validator: LicenseValidator):
    file_bytes = _license_fixture(validator)
    result = validator.validate_license_bytes(file_bytes, installation_id="INSTALL-999")
    assert result.is_valid is False
    assert result.status in {"MACHINE_MISMATCH", "INVALID"}


def test_wrong_product_blocks(validator: LicenseValidator):
    file_bytes = _license_fixture(validator)
    payload = validator.decode_license_bytes(file_bytes)["payload"]
    payload["product"] = "OTHER_PRODUCT"
    tampered = validator.build_license_file(payload, installation_id_override="INSTALL-123")
    result = validator.validate_license_bytes(tampered, installation_id="INSTALL-123")
    assert result.is_valid is False


def test_corrupt_file_blocks(validator: LicenseValidator):
    result = validator.validate_license_bytes(b"not-a-valid-license", installation_id="INSTALL-123")
    assert result.is_valid is False


def test_no_license_blocks_login(validator: LicenseValidator):
    result = validator.validate_license_file(None, installation_id="INSTALL-123")
    assert result.is_valid is False
    assert result.status in {"NOT_INSTALLED", "INVALID"}


def test_valid_license_login_allowed(validator: LicenseValidator):
    file_bytes = _license_fixture(validator)
    result = validator.validate_license_bytes(file_bytes, installation_id="INSTALL-123")
    assert result.is_valid is True


def test_expiry_warning_thresholds(validator: LicenseValidator):
    future = datetime.now(timezone.utc) + timedelta(days=14)
    payload = {
        "license_id": "LIC-WARN-001",
        "customer_id": "CUST-001",
        "customer_name": "ABC Manufacturing",
        "product": "MANUFACTURING_AGENTIC_AI",
        "license_type": "ANNUAL",
        "issued_at": (datetime.now(timezone.utc) - timedelta(days=1)).isoformat(),
        "expires_at": future.isoformat(),
        "installation_id": "INSTALL-123",
        "features": ["MES", "SCADA"],
        "limits": {"max_users": 50},
        "version": "1.0",
        "key_id": "test-key-1",
        "token_1": "f7d13fca0d5a41eaa7ff42d02d49e111",
        "token_2": "8d2a8179d3894d9ab7e85d7a93c9c759",
        "token_3": "e0a7d6b4ab61414a97fff85ef18e5dcb",
        "token_4": "a00c71f4dca849b5a5f784d5ad473b31",
        "token_5": "d9f5834531bc4fa189cfedfb6ac17030",
    }
    file_bytes = validator.build_license_file(payload, installation_id_override="INSTALL-123")
    result = validator.validate_license_bytes(file_bytes, installation_id="INSTALL-123")
    assert result.is_valid is True
    assert result.warning is not None
    assert result.warning in {"7_days","14_days","30_days","60_days","90_days"}


def test_api_bypass_blocked(validator: LicenseValidator):
    result = validator.validate_license_file(None, installation_id="INSTALL-123")
    assert result.is_valid is False
    assert result.status in {"NOT_INSTALLED", "INVALID"}
    assert result.blocking_code in {"LICENSE_REQUIRED", "LICENSE_INVALID"}


def test_generate_test_license_works():
    license = generate_test_license()
    assert isinstance(license, bytes)
    assert b"MAI-LIC-V1" in license
