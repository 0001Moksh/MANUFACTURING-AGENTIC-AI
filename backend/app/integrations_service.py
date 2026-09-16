import asyncio
import json
import logging
import os
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime
from typing import Any, Dict, Optional

from pydantic import BaseModel, Field

logger = logging.getLogger("mai.integrations")

# Cache TTL in seconds — avoids blocking /api/telemetry every 30s
_CACHE_TTL_SECONDS = 60


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


def _sync_ping_influxdb(
    server_url: str,
    api_token: Optional[str] = None,
    timeout: float = 5.0,
) -> Dict[str, Any]:
    """
    Ping InfluxDB 2.x at GET /ping (returns 204 No Content when healthy).
    Falls back to GET /health (returns {"status": "pass"} on 200).
    """
    cleaned_url = _clean_url(server_url)
    start_time = time.perf_counter()

    headers: Dict[str, str] = {
        "User-Agent": "MAI-Platform-IntegrationEngine/1.0",
        "Accept": "application/json",
    }
    token = (api_token or "").strip()
    if token:
        headers["Authorization"] = f"Token {token}"  # InfluxDB uses 'Token' not 'Bearer'

    for probe_path in ("/ping", "/health"):
        probe_url = f"{cleaned_url}{probe_path}"
        try:
            req = urllib.request.Request(probe_url, headers=headers, method="GET")
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                elapsed_ms = int((time.perf_counter() - start_time) * 1000)
                status_code = resp.status
                # /ping → 204 (no body), /health → 200 {"status":"pass"}
                if status_code in (200, 204):
                    body_text = resp.read().decode("utf-8", errors="replace")
                    try:
                        payload = json.loads(body_text) if body_text.strip() else {}
                    except Exception:
                        payload = {}
                    db_ok = payload.get("status") in ("pass", "ok") if payload else True
                    if db_ok or status_code == 204:
                        return {
                            "success": True,
                            "status": "CONNECTED",
                            "message": f"InfluxDB reachable at {cleaned_url} ({probe_path}, HTTP {status_code}).",
                            "latency_ms": elapsed_ms,
                            "details": payload or {"http_code": status_code},
                        }
        except urllib.error.HTTPError as he:
            elapsed_ms = int((time.perf_counter() - start_time) * 1000)
            if he.code in (401, 403):
                return {
                    "success": False,
                    "status": "DISCONNECTED",
                    "message": f"InfluxDB auth failed (HTTP {he.code}): check INFLUXDB_TOKEN.",
                    "latency_ms": elapsed_ms,
                    "details": {"http_code": he.code, "reason": str(he.reason)},
                }
            # Other HTTP errors — try next probe path
            logger.debug("InfluxDB %s returned HTTP %s — trying next probe.", probe_path, he.code)
        except (urllib.error.URLError, TimeoutError, OSError) as ue:
            elapsed_ms = int((time.perf_counter() - start_time) * 1000)
            err_str = str(ue.reason) if hasattr(ue, "reason") else str(ue)
            return {
                "success": False,
                "status": "DISCONNECTED",
                "message": f"Could not reach InfluxDB at {cleaned_url}: {err_str}",
                "latency_ms": elapsed_ms,
                "details": {"error": err_str},
            }
        except Exception as exc:
            elapsed_ms = int((time.perf_counter() - start_time) * 1000)
            return {
                "success": False,
                "status": "DISCONNECTED",
                "message": f"Unexpected error pinging InfluxDB: {exc}",
                "latency_ms": elapsed_ms,
                "details": {"error": str(exc)},
            }

    elapsed_ms = int((time.perf_counter() - start_time) * 1000)
    return {
        "success": False,
        "status": "DISCONNECTED",
        "message": f"InfluxDB did not respond on any probe path at {cleaned_url}.",
        "latency_ms": elapsed_ms,
        "details": {},
    }


def _sync_ping_grafana(
    server_url: str,
    api_token: Optional[str] = None,
    org_id: int = 1,
    timeout: float = 5.0,
) -> Dict[str, Any]:
    """
    Ping Grafana (port 3000) via GET /api/health,
    or InfluxDB (any other port) via GET /ping.
    Auto-detects based on the URL port.
    """
    cleaned_url = _clean_url(server_url)

    # Auto-detect: if the URL contains :3000 treat it as Grafana UI;
    # everything else (8086, etc.) is an InfluxDB / time-series backend.
    parsed = urllib.parse.urlparse(cleaned_url)
    port = parsed.port or (443 if parsed.scheme == "https" else 80)
    if port != 3000:
        return _sync_ping_influxdb(cleaned_url, api_token, timeout=timeout)

    # --- Grafana /api/health path ---
    start_time = time.perf_counter()
    health_url = f"{cleaned_url}/api/health"
    headers: Dict[str, str] = {
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
            body_text = resp.read().decode("utf-8", errors="replace")
            try:
                payload = json.loads(body_text) if body_text else {}
            except Exception:
                payload = {"raw": body_text}

            if status_code == 200:
                return {
                    "success": True,
                    "status": "CONNECTED",
                    "message": "Successfully connected to Grafana IoT Application.",
                    "latency_ms": elapsed_ms,
                    "details": payload,
                }
    except urllib.error.HTTPError as he:
        elapsed_ms = int((time.perf_counter() - start_time) * 1000)
        if he.code in (401, 403):
            return {
                "success": False,
                "status": "DISCONNECTED",
                "message": f"Grafana auth failed (HTTP {he.code}): check API token.",
                "latency_ms": elapsed_ms,
                "details": {"http_code": he.code, "reason": str(he.reason)},
            }
        return {
            "success": False,
            "status": "DISCONNECTED",
            "message": f"Grafana returned HTTP {he.code}: {he.reason}",
            "latency_ms": elapsed_ms,
            "details": {"http_code": he.code},
        }
    except (urllib.error.URLError, TimeoutError, OSError) as ue:
        elapsed_ms = int((time.perf_counter() - start_time) * 1000)
        err_str = str(ue.reason) if hasattr(ue, "reason") else str(ue)
        return {
            "success": False,
            "status": "DISCONNECTED",
            "message": f"Could not reach Grafana at {cleaned_url}: {err_str}",
            "latency_ms": elapsed_ms,
            "details": {"error": err_str},
        }
    except Exception as exc:
        elapsed_ms = int((time.perf_counter() - start_time) * 1000)
        return {
            "success": False,
            "status": "DISCONNECTED",
            "message": f"Grafana connection error: {exc}",
            "latency_ms": elapsed_ms,
            "details": {"error": str(exc)},
        }

    elapsed_ms = int((time.perf_counter() - start_time) * 1000)
    return {
        "success": False,
        "status": "DISCONNECTED",
        "message": f"Unexpected response from Grafana at {cleaned_url}.",
        "latency_ms": elapsed_ms,
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
_grafana_last_probe_time: float = 0.0  # epoch seconds of last live probe


def update_cached_grafana_status(status_dict: Dict[str, Any]) -> None:
    global _cached_grafana_status
    _cached_grafana_status.update(status_dict)


def _build_iot_url() -> str:
    """Construct the IoT backend URL from environment variables.
    Uses IIIOT_PORT (8086 = InfluxDB) by default.
    """
    ip = os.getenv("IIIOT_IP", "192.168.10.130")
    port = os.getenv("IIIOT_PORT", "8086")
    return f"http://{ip}:{port}"


def get_grafana_health_status_sync() -> Dict[str, Any]:
    """
    Return cached Grafana/InfluxDB status for agents and telemetry.
    Live probe runs at most once every _CACHE_TTL_SECONDS (60 s) to avoid
    blocking the /api/telemetry endpoint on every frontend poll.
    """
    global _cached_grafana_status, _grafana_last_probe_time

    # Resolve server_url from env if not yet set
    server_url = _cached_grafana_status.get("server_url") or _build_iot_url()
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

    now = time.monotonic()
    cache_age = now - _grafana_last_probe_time
    cached_status = _cached_grafana_status.get("status", "UNTESTED")

    # Skip live probe if we have a recent successful result
    if cache_age < _CACHE_TTL_SECONDS and cached_status not in ("UNTESTED", None):
        logger.debug(
            "Grafana health: returning cached result (%s, age=%.0fs)", cached_status, cache_age
        )
        return dict(_cached_grafana_status)

    # Live probe (3 s timeout — firm cap to not stall telemetry)
    logger.info("Grafana health: running live probe → %s", server_url)
    try:
        ping_result = _sync_ping_grafana(server_url, api_token, org_id=1, timeout=3.0)
        _cached_grafana_status.update({
            "status": ping_result.get("status", "DISCONNECTED"),
            "latency_ms": ping_result.get("latency_ms", 0),
            "message": ping_result.get("message", ""),
            "dashboards_active": ping_result.get("success", False),
            "alert_stream_active": ping_result.get("success", False),
            "checked_at": datetime.utcnow().isoformat(),
        })
        _grafana_last_probe_time = now
        logger.info(
            "Grafana health probe result: %s (%dms)",
            ping_result.get("status"),
            ping_result.get("latency_ms", 0),
        )
    except Exception as e:
        logger.warning("Grafana health probe exception: %s", e)
        _cached_grafana_status["status"] = "DISCONNECTED"
        _cached_grafana_status["message"] = str(e)

    return dict(_cached_grafana_status)

