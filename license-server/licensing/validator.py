import base64
import json

from cryptography.exceptions import InvalidSignature

from crypto.encryption import decrypt_payload
from crypto.signing import get_public_key
from licensing.serializer import parse_container


def validate_license(raw: bytes, installation_id: str | None = None, product: str = "MANUFACTURING_AGENTIC_AI") -> dict:
    try:
        details = parse_container(raw)
        payload = decrypt_payload(details["key_b64"], details["nonce_b64"], details["ciphertext_b64"])
        signature = base64.b64decode(details["signature_b64"])
        public_key = get_public_key()
        public_key.verify(signature, json.dumps(payload, sort_keys=True, separators=(",", ":")).encode("utf-8"))
    except Exception as exc:
        return {"valid": False, "status": "INVALID", "message": f"License validation failed: {exc}"}

    if product and payload.get("product") != product:
        return {"valid": False, "status": "PRODUCT_MISMATCH", "message": "Wrong product."}
    if installation_id and payload.get("installation_id") != installation_id:
        return {"valid": False, "status": "MACHINE_MISMATCH", "message": "Wrong installation ID."}

    return {"valid": True, "status": "VALID", "payload": payload}
