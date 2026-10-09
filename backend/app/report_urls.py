"""Shared report storage and externally reachable URL configuration."""

import os
import re
from pathlib import Path
from typing import Any, Dict, Optional


REPORTS_DIR = os.path.abspath(os.getenv("REPORTS_DIR", "reports"))


def get_public_api_url() -> str:
    return os.getenv("PUBLIC_API_URL", "http://192.168.10.8:8001").rstrip("/")


def get_public_frontend_url() -> str:
    return os.getenv("FRONTEND_URL", "http://localhost:3000").rstrip("/")


def build_report_url(filename: str, public_api_url: Optional[str] = None) -> str:
    safe_filename = Path(filename).name
    if safe_filename != filename or not re.fullmatch(r"[\w.-]+\.pdf", safe_filename, re.IGNORECASE):
        raise ValueError("Report filename must be a PDF filename.")
    return f"{(public_api_url or get_public_api_url()).rstrip('/')}/reports/{safe_filename}"


def summarize_report_sources(sql_result: Any) -> str:
    if not isinstance(sql_result, list):
        return "No tabular source results were returned."

    sources: Dict[str, Dict[str, int]] = {}
    for item in sql_result:
        if not isinstance(item, dict):
            continue
        database = str(item.get("database") or "Unknown source")
        summary = sources.setdefault(database, {"rows": 0, "tables": 0})
        summary["rows"] += int(item.get("rows") or 0)
        summary["tables"] += 1
    if not sources:
        return "No tabular source results were returned."
    return "Data sources: " + "; ".join(
        f"{name} ({values['rows']} rows across {values['tables']} tables)"
        for name, values in sources.items()
    ) + "."
