from __future__ import annotations

import os
from pathlib import Path

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import ed25519

from config.settings import PRIVATE_KEY_PATH, PUBLIC_KEY_PATH


def ensure_keypair() -> tuple[ed25519.Ed25519PrivateKey, ed25519.Ed25519PublicKey]:
    private_path = Path(PRIVATE_KEY_PATH)
    public_path = Path(PUBLIC_KEY_PATH)

    if private_path.exists() and public_path.exists():
        private_key = serialization.load_pem_private_key(private_path.read_bytes(), password=None)
        public_key = serialization.load_pem_public_key(public_path.read_bytes())
        return private_key, public_key

    private_key = ed25519.Ed25519PrivateKey.generate()
    public_key = private_key.public_key()
    private_path.write_bytes(
        private_key.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.PKCS8,
            encryption_algorithm=serialization.NoEncryption(),
        )
    )
    public_path.write_bytes(
        public_key.public_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PublicFormat.SubjectPublicKeyInfo,
        )
    )
    return private_key, public_key


def get_private_key() -> ed25519.Ed25519PrivateKey:
    return ensure_keypair()[0]


def get_public_key() -> ed25519.Ed25519PublicKey:
    return ensure_keypair()[1]


def public_key_pem() -> str:
    return get_public_key().public_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PublicFormat.SubjectPublicKeyInfo,
    ).decode("utf-8")
