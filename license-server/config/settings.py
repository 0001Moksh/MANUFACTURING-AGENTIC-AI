import os
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")

SECRET_KEY = os.getenv("LICENSE_SERVER_SECRET_KEY", "dev-secret-change-me")
ADMIN_USERNAME = os.getenv("LICENSE_SERVER_ADMIN_USERNAME", "admin")
ADMIN_PASSWORD = os.getenv("LICENSE_SERVER_ADMIN_PASSWORD", "Admin@123")

PRIVATE_KEY_PATH = Path(os.getenv("LICENSE_SERVER_PRIVATE_KEY_PATH", str(BASE_DIR / "storage" / "private_key.pem")))
PUBLIC_KEY_PATH = Path(os.getenv("LICENSE_SERVER_PUBLIC_KEY_PATH", str(BASE_DIR / "storage" / "public_key.pem")))
LICENSE_STORAGE_PATH = Path(os.getenv("LICENSE_STORAGE_PATH", str(BASE_DIR / "storage" / "licenses.json")))
LOG_PATH = Path(os.getenv("LOG_PATH", str(BASE_DIR / "storage" / "audit.log")))

BASE_DIR.mkdir(exist_ok=True, parents=True)
PRIVATE_KEY_PATH.parent.mkdir(exist_ok=True, parents=True)
PUBLIC_KEY_PATH.parent.mkdir(exist_ok=True, parents=True)
LICENSE_STORAGE_PATH.parent.mkdir(exist_ok=True, parents=True)
LOG_PATH.parent.mkdir(exist_ok=True, parents=True)
