"""Remove exact Telegraf input configs without touching the shared runtime/output."""

import os
import platform
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[2]
PENDING_DIR = PROJECT_ROOT / ".runtime" / "plugin-config-removals"


def installed_config_dir() -> Path:
    system = platform.system().lower()
    if system == "windows":
        return Path(os.getenv("ProgramFiles", r"C:\Program Files")) / "IIIOT-Veda" / "config"
    if system == "darwin":
        return Path("/usr/local/etc/telegraf.d")
    return Path("/etc/telegraf/telegraf.d")


def request_config_removal(kind: str) -> str:
    """Queue a privileged cleanup/restart, and remove immediately when allowed."""
    if not kind or not all(char.isascii() and (char.islower() or char.isdigit() or char == "-") for char in kind):
        raise ValueError("Invalid plugin kind")
    path = installed_config_dir() / f"mai-{kind}.conf"
    marker = PENDING_DIR / f"{kind}.pending"
    if not path.exists() and not marker.exists():
        return "absent"
    PENDING_DIR.mkdir(parents=True, exist_ok=True)
    marker.touch()
    try:
        path.unlink(missing_ok=True)
    except PermissionError:
        return "pending"
    return "removed"
