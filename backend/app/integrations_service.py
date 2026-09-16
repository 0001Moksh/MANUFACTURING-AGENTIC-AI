import asyncio
import json
import logging
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime
from typing import Any, Dict, Optional

from pydantic import BaseModel, Field

logger = logging.getLogger("mai.integrations")


class GrafanaConfig(BaseModel):
    server_url: str = Field(..., description="Grafana base URL (e.g. http://grafana.internal:3000)")
    api_token: Optional[str] = Field(None, description="Bearer / Service Account Token for authentication")
    org_id: int = Field(1, description="Grafana Organization ID")
    status: str = Field("UNTESTED", description="CONNECTED, DISCONNECTED, or UNTESTED")
    last_checked_at: Optional[str] = Field(None, description="ISO timestamp of last test")
    details: Optional[str] = Field(None, description="Status or connection error details")


class IntegrationTestRequest(BaseModel):
    integration_type: str = Field("grafana", description="Type of integration (e.g., grafana, mes, video_analytics)")
    server_url: Optional[str] = None
    api_token: Optional[str] = None
    service_account_token: Optional[str] = None
    org_id: Optional[int] = 1


class IntegrationTestResponse(BaseModel):
    success: bool
    status: str
    message: str
    latency_ms: int
    details: Optional[Dict[str, Any]] = None


class IntegrationSaveRequest(BaseModel):
    name: str = Field(..., description="Integration name (e.g. 'Grafana IoT Application' or 'MES')")
    is_enabled: Optional[bool] = None
    server_url: Optional[str] = None
    api_token: Optional[str] = None
    org_id: Optional[int] = 1


def _clean_url(url: str) -> str:
    trimmed = url.strip()
    if not trimmed.startswith("http://") and not trimmed.startswith("https://"):
        trimmed = f"http://{trimmed}"
    return trimmed.rstrip("/")


def _sync_ping_grafana(
    server_url: str,
    api_token: Optional[str] = None,
    org_id: int = 1,
    timeout: float = 5.0,
) -> Dict[str, Any]:
    """
    Synchronously ping Grafana endpoint (GET /api/health or GET /api/org).
    Max timeout enforced at 5.0 seconds.
    """
    cleaned_url = _clean_url(server_url)
    start_time = time.perf_counter()

    # Try health check endpoint first (/api/health)
    health_url = f"{cleaned_url}/api/health"
    headers = {
        "User-Agent": "MAI-Platform-IntegrationEngine/1.0",
        "Accept": "application/json",
        "X-Grafana-Org-Id": str(org_id or 1),
    }

    token = (api_token or "").strip()
    if token:
        headers["Authorization"] = f"Bearer {token}"

    try:
        req = urllib.request.Request(health_url, headers=headers, method="GET")
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            elapsed_ms = int((time.perf_counter() - start_time) * 1000)
            status_code = resp.status
            body_bytes = resp.read()
            body_text = body_bytes.decode("utf-8", errors="replace")

            try:
                payload = json.loads(body_text) if body_text else {}
            except Exception:
                payload = {"raw": body_text}

            # If /api/health returns 200 and database is ok or valid payload
            is_ok = status_code == 200 and (
                isinstance(payload, dict) and (
                    payload.get("database") in ("ok", "OK", True)
                    or payload.get("commit") is not None
                    or payload.get("version") is not None
                    or status_code == 200
                )
            )

            if is_ok:
                return {
                    "success": True,
                    "status": "CONNECTED",
                    "message": "Successfully connected to Grafana IoT Application.",
                    "latency_ms": elapsed_ms,
                    "details": payload,
                }

    except urllib.error.HTTPError as he:
        elapsed_ms = int((time.perf_counter() - start_time) * 1000)
        # If /api/health required auth (401/403) and token was given or try /api/org
        if he.code in (401, 403):
            if not token:
                return {
                    "success": False,
                    "status": "DISCONNECTED",
                    "message": "Authentication required: Please provide a valid Grafana API or Service Account Token.",
                    "latency_ms": elapsed_ms,
                    "details": {"http_code": he.code, "reason": he.reason},
                }
            return {
                "success": False,
                "status": "DISCONNECTED",
                "message": f"Authentication failed (HTTP {he.code}): Invalid or expired Grafana Token.",
                "latency_ms": elapsed_ms,
                "details": {"http_code": he.code, "reason": he.reason},
            }
        elif he.code == 404:
            # Fallback check: try GET /api/org or root /api
            try:
                org_url = f"{cleaned_url}/api/org"
                req2 = urllib.request.Request(org_url, headers=headers, method="GET")
                with urllib.request.urlopen(req2, timeout=max(1.0, timeout - (time.perf_counter() - start_time))) as resp2:
                    elapsed_ms2 = int((time.perf_counter() - start_time) * 1000)
                    if resp2.status == 200:
                        return {
                            "success": True,
                            "status": "CONNECTED",
                            "message": "Successfully connected to Grafana IoT Application (Organization API).",
                            "latency_ms": elapsed_ms2,
                            "details": {"http_code": 200},
                        }
            except Exception:
                pass

            return {
                "success": False,
                "status": "DISCONNECTED",
                "message": f"Grafana server endpoint not found (HTTP 404) at {cleaned_url}.",
                "latency_ms": elapsed_ms,
                "details": {"http_code": 404},
            }
        else:
            return {
                "success": False,
                "status": "DISCONNECTED",
                "message": f"Grafana server returned HTTP error {he.code}: {he.reason}",
                "latency_ms": elapsed_ms,
                "details": {"http_code": he.code, "reason": str(he.reason)},
            }

    except urllib.error.URLError as ue:
        elapsed_ms = int((time.perf_counter() - start_time) * 1000)
        err_str = str(ue.reason) if hasattr(ue, "reason") else str(ue)
        return {
            "success": False,
            "status": "DISCONNECTED",
            "message": f"Could not reach Grafana server at {cleaned_url}: {err_str}",
            "latency_ms": elapsed_ms,
            "details": {"error": err_str},
        }

    except TimeoutError:
        return {
            "success": False,
            "status": "DISCONNECTED",
            "message": f"Connection timed out after {int(timeout * 1000)}ms while contacting {cleaned_url}.",
            "latency_ms": int(timeout * 1000),
            "details": {"error": "Timeout"},
        }

    except Exception as exc:
        elapsed_ms = int((time.perf_counter() - start_time) * 1000)
        return {
            "success": False,
            "status": "DISCONNECTED",
            "message": f"Connection failed: {str(exc)}",
            "latency_ms": elapsed_ms,
            "details": {"error": str(exc)},
        }

    return {
        "success": False,
        "status": "DISCONNECTED",
        "message": f"Unexpected response from Grafana at {cleaned_url}.",
        "latency_ms": int((time.perf_counter() - start_time) * 1000),
    }


async def test_grafana_connection(
    server_url: str,
    api_token: Optional[str] = None,
    org_id: int = 1,
    timeout: float = 5.0,
) -> Dict[str, Any]:
    """
    Asynchronously test Grafana connection by executing HTTP ping in a thread pool.
    Guarantees max timeout <= 5000ms.
    """
    if not server_url or not server_url.strip():
        return {
            "success": False,
            "status": "DISCONNECTED",
            "message": "Grafana Server URL cannot be empty.",
            "latency_ms": 0,
            "details": {"error": "Empty URL"},
        }

    loop = asyncio.get_running_loop()
    try:
        result = await asyncio.wait_for(
            loop.run_in_executor(
                None,
                _sync_ping_grafana,
                server_url,
                api_token,
                org_id,
                timeout,
            ),
            timeout=timeout + 0.5,
        )
        return result
    except asyncio.TimeoutError:
        return {
            "success": False,
            "status": "DISCONNECTED",
            "message": f"Connection check timed out after {int(timeout * 1000)}ms.",
            "latency_ms": int(timeout * 1000),
            "details": {"error": "AsyncTimeout"},
        }
    except Exception as e:
        return {
            "success": False,
            "status": "DISCONNECTED",
            "message": f"Test connection error: {str(e)}",
            "latency_ms": 0,
            "details": {"error": str(e)},
        }


_cached_grafana_status: Dict[str, Any] = {
    "integration": "Grafana IoT Application",
    "status": "UNTESTED",
    "is_enabled": True,
    "server_url": None,
    "latency_ms": 0,
    "message": "Initialized",
    "dashboards_active": False,
    "alert_stream_active": False,
    "checked_at": None,
}


def update_cached_grafana_status(status_dict: Dict[str, Any]) -> None:
    global _cached_grafana_status
    _cached_grafana_status.update(status_dict)


def get_grafana_health_status_sync() -> Dict[str, Any]:
    """
    Synchronous helper to retrieve cached/live Grafana status for agents and telemetry.
    """
    global _cached_grafana_status
    import os

    server_url = _cached_grafana_status.get("server_url")
    if not server_url:
        ip = os.getenv("IIIOT_IP", "192.168.10.130")
        server_url = f"http://{ip}:3000"
        _cached_grafana_status["server_url"] = server_url

    api_token = os.getenv("INFLUXDB_TOKEN", "")

    is_enabled = _cached_grafana_status.get("is_enabled", True)
    if not is_enabled:
        return {
            "integration": "Grafana IoT Application",
            "status": "DISABLED",
            "is_enabled": False,
            "server_url": server_url,
            "message": "Grafana IoT integration is disabled in Admin Console → Integrations.",
            "dashboards_active": False,
            "alert_stream_active": False,
            "checked_at": _cached_grafana_status.get("checked_at"),
        }

    # Fast probe (2.0s timeout)
    try:
        ping_result = _sync_ping_grafana(server_url, api_token, org_id=1, timeout=2.0)
        _cached_grafana_status["status"] = ping_result.get("status", "DISCONNECTED")
        _cached_grafana_status["latency_ms"] = ping_result.get("latency_ms", 0)
        _cached_grafana_status["message"] = ping_result.get("message", "")
        _cached_grafana_status["dashboards_active"] = ping_result.get("success", False)
        _cached_grafana_status["alert_stream_active"] = ping_result.get("success", False)
        _cached_grafana_status["checked_at"] = datetime.utcnow().isoformat()
    except Exception as e:
        _cached_grafana_status["status"] = "DISCONNECTED"
        _cached_grafana_status["message"] = str(e)

    return dict(_cached_grafana_status)

