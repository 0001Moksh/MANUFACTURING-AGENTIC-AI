from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone

from cryptography.hazmat.primitives import hashes

from crypto.encryption import encrypt_payload
from crypto.signing import get_private_key
from licensing.tokens import generate_tokens
from licensing.serializer import serialize_container


def build_license_payload(customer_name: str, customer_id: str, product: str, license_type: str, expires_at: str, installation_id: str, features: list[str], max_users: int = 50, notes: str = "") -> dict:
    token_values = generate_tokens()
    issued_at = datetime.now(timezone.utc).isoformat()
    payload = {
        "license_id": f"LIC-{customer_id.upper()}-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}",
        "customer_id": customer_id,
        "customer_name": customer_name,
        "product": product,
        "license_type": license_type,
        "issued_at": issued_at,
        "expires_at": expires_at,
        "installation_id": installation_id,
        "features": features,
        "limits": {"max_users": max_users, "notes": notes},
        "version": "1.0",
        "key_id": "mai-license-key-v1",
        "token_1": token_values[0],
        "token_2": token_values[1],
        "token_3": token_values[2],
        "token_4": token_values[3],
        "token_5": token_values[4],
    }
    return payload


def generate_license_file(payload: dict) -> bytes:
    private_key = get_private_key()
    normalized = dict(payload)
    serialized = json.dumps(normalized, sort_keys=True, separators=(",", ":")).encode("utf-8")
    key_b64, nonce_b64, cipher_b64 = encrypt_payload(normalized)
    signature = private_key.sign(serialized)
    from base64 import b64encode
    return serialize_container(normalized, key_b64, nonce_b64, cipher_b64, b64encode(signature).decode("ascii"))
