import base64
import json


def serialize_container(payload: dict, key_b64: str, nonce_b64: str, cipher_b64: str, signature_b64: str) -> bytes:
    return (
        "MAI-LIC-V1|"
        f"{key_b64}|{nonce_b64}|{cipher_b64}|{signature_b64}"
    ).encode("utf-8")


def parse_container(raw: bytes) -> dict:
    text = raw.decode("utf-8")
    parts = text.split("|")
    if len(parts) != 5 or parts[0] != "MAI-LIC-V1":
        raise ValueError("License file format is invalid.")
    return {
        "key_b64": parts[1],
        "nonce_b64": parts[2],
        "ciphertext_b64": parts[3],
        "signature_b64": parts[4],
    }
