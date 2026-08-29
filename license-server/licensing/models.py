from dataclasses import dataclass, asdict
from datetime import datetime
from typing import Any


@dataclass
class LicenseRecord:
    license_id: str
    customer_id: str
    customer_name: str
    product: str
    license_type: str
    issued_at: str
    expires_at: str
    installation_id: str
    features: list[str]
    limits: dict[str, Any]
    version: str
    key_id: str
    token_1: str
    token_2: str
    token_3: str
    token_4: str
    token_5: str
    revoked: bool = False
    revocation_reason: str | None = None
    revoked_at: str | None = None
    revoked_by: str | None = None
    created_at: str | None = None

    def to_dict(self):
        return asdict(self)
