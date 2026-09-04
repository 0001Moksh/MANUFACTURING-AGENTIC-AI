from __future__ import annotations

import base64
import json
import os
import secrets
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Dict, Optional

from cryptography.exceptions import InvalidSignature
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import ed25519
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

LICENSE_CONTAINER_PREFIX = "MAI-LIC-V1"
PRODUCT_NAME = "MANUFACTURING_AGENTIC_AI"
GRACE_PERIOD_DAYS = int(os.getenv("MAI_LICENSE_GRACE_DAYS", "7"))


@dataclass
class LicenseValidationResult:
    status: str
    is_valid: bool
    message: str
    blocking_code: str
    warning: Optional[str] = None
    payload: Optional[Dict[str, Any]] = None
    customer_name: Optional[str] = None
    license_type: Optional[str] = None
    expires_at: Optional[str] = None
    days_remaining: Optional[int] = None
    installation_id: Optional[str] = None
    product: Optional[str] = None
    feature_summary: Optional[Dict[str, bool]] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "status": self.status,
            "is_valid": self.is_valid,
            "message": self.message,
            "blocking_code": self.blocking_code,
            "warning": self.warning,
            "payload": self.payload,
            "customer_name": self.customer_name,
            "license_type": self.license_type,
            "expires_at": self.expires_at,
            "days_remaining": self.days_remaining,
            "installation_id": self.installation_id,
            "product": self.product,
            "features": self.feature_summary,
        }


class LicenseValidator:
    def __init__(self, public_key_pem: Optional[str] = None, private_key_pem: Optional[str] = None):
        self.private_key: Optional[ed25519.Ed25519PrivateKey] = None
        self.public_key: Optional[ed25519.Ed25519PublicKey] = None

        if public_key_pem:
            self.public_key = serialization.load_pem_public_key(public_key_pem.encode("utf-8"))
        elif private_key_pem:
            self.private_key = serialization.load_pem_private_key(private_key_pem.encode("utf-8"), password=None)
            self.public_key = self.private_key.public_key()
        else:
            self.private_key = ed25519.Ed25519PrivateKey.generate()
            self.public_key = self.private_key.public_key()

        if private_key_pem and not self.public_key:
            raise ValueError("Unable to load license public key.")

    @property
    def public_key_pem(self) -> str:
        if self.public_key is None:
            raise ValueError("No public key loaded.")
        return self.public_key.public_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PublicFormat.SubjectPublicKeyInfo,
        ).decode("utf-8")

    def _canonical_payload(self, payload: Dict[str, Any]) -> bytes:
        return json.dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")

    def _serialize_container(self, payload: Dict[str, Any], *, key: bytes, iv: bytes, signature: bytes) -> bytes:
        key_b64 = base64.b64encode(key).decode("ascii")
        iv_b64 = base64.b64encode(iv).decode("ascii")
        sig_b64 = base64.b64encode(signature).decode("ascii")
        ciphertext = AESGCM(key).encrypt(iv, self._canonical_payload(payload), None)
        ciphertext_b64 = base64.b64encode(ciphertext).decode("ascii")
        return f"{LICENSE_CONTAINER_PREFIX}|{key_b64}|{iv_b64}|{ciphertext_b64}|{sig_b64}".encode("utf-8")

    def build_license_file(self, payload: Dict[str, Any], *, installation_id_override: Optional[str] = None) -> bytes:
        if not self.private_key:
            raise ValueError("A private key is required to generate signed license content.")

        normalized = dict(payload)
        normalized["product"] = normalized.get("product", PRODUCT_NAME)
        normalized["version"] = normalized.get("version", "1.0")
        normalized["features"] = list(normalized.get("features", []))
        normalized["tokens"] = sorted(normalized.get("tokens", []))
        if installation_id_override:
            normalized["installation_id"] = installation_id_override

        payload_bytes = self._canonical_payload(normalized)
        signature = self.private_key.sign(payload_bytes)
        key = secrets.token_bytes(32)
        iv = secrets.token_bytes(12)
        ciphertext = AESGCM(key).encrypt(iv, payload_bytes, None)
        key_b64 = base64.b64encode(key).decode("ascii")
        iv_b64 = base64.b64encode(iv).decode("ascii")
        sig_b64 = base64.b64encode(signature).decode("ascii")
        ciphertext_b64 = base64.b64encode(ciphertext).decode("ascii")
        return f"{LICENSE_CONTAINER_PREFIX}|{key_b64}|{iv_b64}|{ciphertext_b64}|{sig_b64}".encode("utf-8")

    def decode_license_bytes(self, raw: bytes) -> Dict[str, Any]:
        if not raw or not isinstance(raw, (bytes, bytearray)):
            raise ValueError("The supplied license was empty or unreadable.")
        text = raw.decode("utf-8")
        parts = text.split("|")
        if len(parts) != 5 or parts[0] != LICENSE_CONTAINER_PREFIX:
            raise ValueError("License container prefix or format is invalid.")

        key_b64, iv_b64, ciphertext_b64, signature_b64 = parts[1:]
        try:
            key = base64.b64decode(key_b64, validate=True)
            iv = base64.b64decode(iv_b64, validate=True)
            ciphertext = base64.b64decode(ciphertext_b64, validate=True)
            signature = base64.b64decode(signature_b64, validate=True)
        except Exception as exc:  # pragma: no cover - defensive
            raise ValueError("License fields are not valid base64 data.") from exc

        if len(key) != 32 or len(iv) != 12:
            raise ValueError("License key or IV is malformed.")

        try:
            plaintext = AESGCM(key).decrypt(iv, ciphertext, None)
        except Exception as exc:  # pragma: no cover - defensive
            raise ValueError("License payload is encrypted with an invalid key or IV.") from exc

        try:
            payload = json.loads(plaintext.decode("utf-8"))
        except Exception as exc:  # pragma: no cover - defensive
            raise ValueError("License payload is not valid JSON.") from exc

        if not isinstance(payload, dict):
            raise ValueError("License payload is not a dictionary.")

        self._verify_signature(payload, signature)
        return {
            "payload": payload,
            "payload_json": plaintext.decode("utf-8"),
            "aes_key": key,
            "iv": iv,
            "ciphertext": ciphertext,
            "signature": signature,
        }

    def _verify_signature(self, payload: Dict[str, Any], signature: bytes) -> None:
        if self.public_key is None:
            raise ValueError("No public verification key is configured.")
        try:
            self.public_key.verify(signature, self._canonical_payload(payload))
        except InvalidSignature as exc:
            raise ValueError("Digital signature verification failed.") from exc

    def _validate_token_set(self, payload: Dict[str, Any]) -> bool:
        tokens = []
        for idx in range(1, 6):
            token = payload.get(f"token_{idx}")
            if not isinstance(token, str) or len(token) < 24 or len(token) > 128:
                return False
            if not token.isalnum() or not token.replace("-", "").isalnum():
                return False
            tokens.append(token)
        return len(set(tokens)) == len(tokens)

    def _compute_warning(self, expires_at: datetime) -> Optional[str]:
        remaining = expires_at - datetime.now(timezone.utc)
        days = remaining.days
        if remaining.total_seconds() <= 0:
            return None
        thresholds = [90, 60, 30, 14, 7, 3, 1]
        for threshold in thresholds:
            if days <= threshold:
                return f"{threshold}_days" if threshold != 1 else "1_day"
        return None

    def validate_license_file(self, raw_license: Optional[bytes], *, installation_id: Optional[str] = None) -> LicenseValidationResult:
        if not raw_license:
            return LicenseValidationResult(
                status="NOT_INSTALLED",
                is_valid=False,
                message="No MAI license is installed on this system.",
                blocking_code="LICENSE_REQUIRED",
            )

        return self.validate_license_bytes(raw_license, installation_id=installation_id)

    def validate_license_bytes(self, raw_license: bytes, *, installation_id: Optional[str] = None) -> LicenseValidationResult:
        if not raw_license:
            return LicenseValidationResult(
                status="NOT_INSTALLED",
                is_valid=False,
                message="No MAI license is installed on this system.",
                blocking_code="LICENSE_REQUIRED",
            )

        try:
            decoded = self.decode_license_bytes(raw_license)
            payload = decoded["payload"]
        except Exception as exc:
            return LicenseValidationResult(
                status="INVALID",
                is_valid=False,
                message=f"License format is invalid or unreadable: {exc}",
                blocking_code="LICENSE_INVALID",
            )

        try:
            if not isinstance(payload.get("license_id"), str):
                raise ValueError("Missing license_id")
            if not isinstance(payload.get("customer_id"), str):
                raise ValueError("Missing customer_id")
            if not isinstance(payload.get("customer_name"), str):
                raise ValueError("Missing customer_name")
            if payload.get("product") != PRODUCT_NAME:
                return LicenseValidationResult(
                    status="PRODUCT_MISMATCH",
                    is_valid=False,
                    message="This license is not valid for the MANUFACTURING_AGENTIC_AI product.",
                    blocking_code="LICENSE_INVALID",
                    payload=payload,
                    customer_name=payload.get("customer_name"),
                    product=payload.get("product"),
                )
            if not isinstance(payload.get("license_type"), str):
                raise ValueError("Missing license_type")
            if not isinstance(payload.get("features"), list):
                raise ValueError("Missing features")
            if not isinstance(payload.get("version"), str):
                raise ValueError("Missing version")
            if not self._validate_token_set(payload):
                return LicenseValidationResult(
                    status="TAMPERED",
                    is_valid=False,
                    message="The license tokens are malformed or inconsistent.",
                    blocking_code="LICENSE_INVALID",
                    payload=payload,
                    customer_name=payload.get("customer_name"),
                    product=payload.get("product"),
                )

            issued_at = payload.get("issued_at")
            expires_at = payload.get("expires_at")
            if not isinstance(issued_at, str) or not isinstance(expires_at, str):
                raise ValueError("License timestamps are missing.")

            issued_dt = datetime.fromisoformat(issued_at)
            expires_dt = datetime.fromisoformat(expires_at)
            if issued_dt.tzinfo is None:
                issued_dt = issued_dt.replace(tzinfo=timezone.utc)
            if expires_dt.tzinfo is None:
                expires_dt = expires_dt.replace(tzinfo=timezone.utc)

            now = datetime.now(timezone.utc)
            if now < issued_dt:
                return LicenseValidationResult(
                    status="INVALID",
                    is_valid=False,
                    message="The license issue time is in the future.",
                    blocking_code="LICENSE_INVALID",
                    payload=payload,
                    customer_name=payload.get("customer_name"),
                    license_type=payload.get("license_type"),
                    expires_at=expires_at,
                    product=payload.get("product"),
                )
            if now > expires_dt:
                return LicenseValidationResult(
                    status="EXPIRED",
                    is_valid=False,
                    message="This MAI license has expired.",
                    blocking_code="LICENSE_EXPIRED",
                    payload=payload,
                    customer_name=payload.get("customer_name"),
                    license_type=payload.get("license_type"),
                    expires_at=expires_at,
                    product=payload.get("product"),
                    days_remaining=0,
                )

            if installation_id and payload.get("installation_id") != installation_id:
                return LicenseValidationResult(
                    status="MACHINE_MISMATCH",
                    is_valid=False,
                    message="This license was issued for a different installation.",
                    blocking_code="LICENSE_INVALID",
                    payload=payload,
                    customer_name=payload.get("customer_name"),
                    license_type=payload.get("license_type"),
                    expires_at=expires_at,
                    product=payload.get("product"),
                    installation_id=payload.get("installation_id"),
                )

            if payload.get("version") not in {"1.0", "1", "2.0"}:
                return LicenseValidationResult(
                    status="VERSION_UNSUPPORTED",
                    is_valid=False,
                    message="The installed MAI version is not supported by this license.",
                    blocking_code="LICENSE_INVALID",
                    payload=payload,
                    customer_name=payload.get("customer_name"),
                    license_type=payload.get("license_type"),
                    expires_at=expires_at,
                    product=payload.get("product"),
                )

            feature_summary = {feature: feature in payload.get("features", []) for feature in [
                "MES", "SCADA", "ERP", "IoT", "CCTV", "Predictive Maintenance",
                "Production Analytics", "Agentic AI", "Advanced Agents", "Reports"
            ]}
            remaining_days = (expires_dt - now).days
            warning = self._compute_warning(expires_dt)
            return LicenseValidationResult(
                status="VALID",
                is_valid=True,
                message="License is valid and access is enabled.",
                blocking_code="LICENSE_VALID",
                warning=warning,
                payload=payload,
                customer_name=payload.get("customer_name"),
                license_type=payload.get("license_type"),
                expires_at=expires_at,
                days_remaining=max(0, remaining_days),
                installation_id=payload.get("installation_id"),
                product=payload.get("product"),
                feature_summary=feature_summary,
            )
        except Exception as exc:  # pragma: no cover - defensive
            return LicenseValidationResult(
                status="VALIDATION_ERROR",
                is_valid=False,
                message=f"License validation failed: {exc}",
                blocking_code="LICENSE_INVALID",
                payload=payload if 'payload' in locals() else None,
            )


def _license_state_dir() -> Path:
    root = Path(__file__).resolve().parents[1]
    path = root / "licenses"
    path.mkdir(exist_ok=True, parents=True)
    return path


def get_active_license_path() -> Path:
    configured = os.getenv("MAI_LICENSE_FILE")
    if configured:
        return Path(configured)
    return _license_state_dir() / "customer.lic"


def write_active_license(raw_license: bytes) -> Path:
    path = get_active_license_path()
    path.parent.mkdir(exist_ok=True, parents=True)
    path.write_bytes(raw_license)
    return path


def read_active_license() -> Optional[bytes]:
    path = get_active_license_path()
    if not path.exists():
        return None
    try:
        return path.read_bytes()
    except OSError:
        return None


def get_installation_id() -> str:
    env_override = os.getenv("MAI_INSTALLATION_ID")
    if env_override and env_override.strip():
        return env_override.strip()

    dir_path = _license_state_dir()
    id_path = dir_path / "installation_id.txt"
    if id_path.exists():
        try:
            value = id_path.read_text("utf-8").strip()
            if value:
                return value
        except OSError:
            pass
    installation_id = "INSTALL-" + secrets.token_hex(12)
    id_path.write_text(installation_id, encoding="utf-8")
    return installation_id


def get_license_validator() -> LicenseValidator:
    public_key = os.getenv("MAI_LICENSE_PUBLIC_KEY")
    if public_key:
        return LicenseValidator(public_key_pem=public_key)
    return LicenseValidator()


def generate_test_license() -> bytes:
    validator = LicenseValidator()
    payload = {
        "license_id": "LIC-TEST-0001",
        "customer_id": "CUST-TEST-1",
        "customer_name": "ABC Manufacturing",
        "product": PRODUCT_NAME,
        "license_type": "ANNUAL",
        "issued_at": (datetime.now(timezone.utc) - timedelta(days=1)).isoformat(),
        "expires_at": (datetime.now(timezone.utc) + timedelta(days=365)).isoformat(),
        "installation_id": "INSTALL-123",
        "features": ["MES", "SCADA", "ERP", "IoT", "Reports"],
        "limits": {"max_users": 50},
        "version": "1.0",
        "key_id": "test-key-1",
        "token_1": "f7d13fca0d5a41eaa7ff42d02d49e111",
        "token_2": "8d2a8179d3894d9ab7e85d7a93c9c759",
        "token_3": "e0a7d6b4ab61414a97fff85ef18e5dcb",
        "token_4": "a00c71f4dca849b5a5f784d5ad473b31",
        "token_5": "d9f5834531bc4fa189cfedfb6ac17030",
    }
    return validator.build_license_file(payload, installation_id_override="INSTALL-123")
