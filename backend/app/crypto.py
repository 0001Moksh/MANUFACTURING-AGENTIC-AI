"""
Symmetric encryption and decryption helper for camera RTSP credentials in MAI platform.
Matches encryption format from video analytics service (Fernet AES-128-CBC with HMAC-SHA256).
"""

import os
import logging
from typing import Dict, Any, Optional
from cryptography.fernet import Fernet, InvalidToken

logger = logging.getLogger(__name__)

_DEFAULT_KEY = "A7lbQlcJSmFqVM_cDnCMke2vGH356K5t-JbezmZmieU="
_ENCRYPTION_KEY = os.getenv("CAMERA_ENCRYPTION_KEY", _DEFAULT_KEY)

try:
    _fernet = Fernet(_ENCRYPTION_KEY.encode() if isinstance(_ENCRYPTION_KEY, str) else _ENCRYPTION_KEY)
except Exception as err:
    logger.error("Failed to initialize Fernet cipher with key: %s", err)
    _fernet = None


def encrypt_value(plaintext: str) -> str:
    """Encrypt a plaintext string. Returns base64-encoded ciphertext string."""
    if not plaintext or not _fernet:
        return plaintext
    try:
        return _fernet.encrypt(plaintext.encode()).decode()
    except Exception as exc:
        logger.error("Encryption error: %s", exc)
        return plaintext


def decrypt_value(ciphertext: str) -> str:
    """
    Decrypt a ciphertext string. Returns original plaintext password.
    Falls back to returning input as-is if ciphertext is unencrypted legacy password.
    """
    if not ciphertext or not _fernet:
        return ciphertext
    try:
        return _fernet.decrypt(ciphertext.encode()).decode()
    except (InvalidToken, Exception):
        # Backward compatibility for plain text passwords stored prior to encryption
        return ciphertext


def build_rtsp_url(camera: Dict[str, Any]) -> str:
    """
    Dynamically build RTSP connection URI using decrypted credentials and camera template.
    Example output: rtsp://admin:iiiot2.com@192.168.10.250:554/2
    """
    camera_number = str(camera.get("camera_number", "1"))
    raw_template = camera.get("rtsp_template") or "{camera_number}"
    template = raw_template.replace("{camera_number}", camera_number)
    
    # Remove leading slash from template if present
    template = template.lstrip("/")

    user_id = camera.get("user_id", "")
    raw_password = camera.get("password", "")
    decrypted_password = decrypt_value(raw_password) if raw_password else ""

    auth = ""
    if user_id and decrypted_password:
        auth = f"{user_id}:{decrypted_password}@"
    elif user_id:
        auth = f"{user_id}@"

    ip = camera.get("ip", "localhost")
    port = camera.get("port", 554)

    return f"rtsp://{auth}{ip}:{port}/{template}"
