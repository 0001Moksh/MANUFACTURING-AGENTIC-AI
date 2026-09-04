import base64
import json
import secrets
from typing import Any

from cryptography.hazmat.primitives.ciphers.aead import AESGCM


def encrypt_payload(payload: dict[str, Any]) -> tuple[str, str, str]:
    plaintext = json.dumps(payload, sort_keys=True, separators=(",", ":")).encode("utf-8")
    key = secrets.token_bytes(32)
    nonce = secrets.token_bytes(12)
    ciphertext = AESGCM(key).encrypt(nonce, plaintext, None)
    return base64.b64encode(key).decode("ascii"), base64.b64encode(nonce).decode("ascii"), base64.b64encode(ciphertext).decode("ascii")


def decrypt_payload(key_b64: str, nonce_b64: str, ciphertext_b64: str) -> dict[str, Any]:
    key = base64.b64decode(key_b64)
    nonce = base64.b64decode(nonce_b64)
    ciphertext = base64.b64decode(ciphertext_b64)
    plaintext = AESGCM(key).decrypt(nonce, ciphertext, None)
    return json.loads(plaintext.decode("utf-8"))
