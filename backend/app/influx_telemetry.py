import csv
import io
import os
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from typing import Any, Dict, List


METRIC_CONFIG = {
    "temperature": {
        "label": "Temperature",
        "unit": "°C",
        "measurement": os.getenv("INFLUX_TEMPERATURE_MEASUREMENT", "Drive Thermal"),
        "bucket": os.getenv("INFLUX_TEMPERATURE_BUCKET", os.getenv("INFLUXDB_BUCKET", "ECE2")),
        "normal": [0, 75],
        "warning": 85,
        "critical": 98,
    },
    "vibration": {
        "label": "Vibration",
        "unit": "mm/s",
        "measurement": os.getenv("INFLUX_VIBRATION_MEASUREMENT", "Vibration Sensor"),
        "bucket": os.getenv("INFLUX_VIBRATION_BUCKET", os.getenv("INFLUXDB_BUCKET", "ECE2")),
        "normal": [0, 3.5],
        "warning": 5,
        "critical": 7.5,
    },
    "current": {
        "label": "Current",
        "unit": "A",
        "measurement": os.getenv("INFLUX_CURRENT_MEASUREMENT", "Current"),
        "bucket": os.getenv("INFLUX_CURRENT_BUCKET", os.getenv("INFLUXDB_BUCKET", "ECE2")),
        "normal": [0, 160],
        "warning": 185,
        "critical": 210,
    },
    "power": {
        "label": "Power",
        "unit": "kW",
        "measurement": os.getenv("INFLUX_POWER_MEASUREMENT", "Motor Power"),
        "bucket": os.getenv("INFLUX_POWER_BUCKET", os.getenv("INFLUXDB_BUCKET", "ECE2")),
        "normal": [0, 2500],
        "warning": 2650,
        "critical": 2780,
    },
    "rpm": {
        "label": "RPM",
        "unit": "rpm",
        "measurement": os.getenv("INFLUX_RPM_MEASUREMENT", "RPM"),
        "bucket": os.getenv("INFLUX_RPM_BUCKET", os.getenv("INFLUXDB_BUCKET", "ECE2")),
        "normal": [0, 18],
        "warning": 18.8,
        "critical": 19.5,
    },
}


class InfluxTelemetryError(RuntimeError):
    pass


def _influx_url() -> str:
    configured = os.getenv("INFLUXDB_URL", "").strip()
    if configured:
        return configured.rstrip("/")
    return f"http://{os.getenv('IIIOT_IP', '192.168.10.130')}:{os.getenv('IIIOT_PORT', '8086')}"


def _query_flux(query: str) -> List[Dict[str, str]]:
    token = os.getenv("INFLUXDB_TOKEN", "").strip()
    org = os.getenv("INFLUXDB_ORG", "IIIOT-INFOTECH").strip()
    if not token:
        raise InfluxTelemetryError("INFLUXDB_TOKEN is not configured")

    request = urllib.request.Request(
        f"{_influx_url()}/api/v2/query?org={urllib.parse.quote(org)}",
        data=query.encode("utf-8"),
        headers={
            "Authorization": f"Token {token}",
            "Accept": "text/csv",
            "Content-Type": "application/vnd.flux",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=10) as response:
            payload = response.read().decode("utf-8")
    except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError, OSError) as exc:
        raise InfluxTelemetryError(f"InfluxDB query failed: {exc}") from exc

    rows: List[Dict[str, str]] = []
    header: List[str] | None = None
    for record in csv.reader(line for line in io.StringIO(payload) if not line.startswith("#")):
        if not record:
            continue
        if "_time" in record:
            header = record
            continue
        if header and len(record) == len(header):
            rows.append(dict(zip(header, record)))
    return rows


def _metric_rows(config: Dict[str, Any], range_window: str) -> List[Dict[str, str]]:
    bucket = config["bucket"].replace('"', '\\"')
    measurement = config["measurement"].replace('"', '\\"')
    flux = f'''from(bucket: "{bucket}")
  |> range(start: -{range_window})
  |> filter(fn: (r) => r._measurement == "{measurement}" and r._field == "value")
  |> aggregateWindow(every: 1m, fn: last, createEmpty: false)
  |> sort(columns: ["_time"])
  |> tail(n: 120)'''
    return _query_flux(flux)


def _status(value: float | None, config: Dict[str, Any]) -> str:
    if value is None:
        return "normal"
    if value >= config["critical"]:
        return "critical"
    if value >= config["warning"]:
        return "warning"
    return "normal"


def get_machine_telemetry() -> Dict[str, Any]:
    metrics: List[Dict[str, Any]] = []
    has_any_data = False

    for key, config in METRIC_CONFIG.items():
        rows = _metric_rows(config, os.getenv("INFLUX_TELEMETRY_RANGE", "24h"))
        points = []
        for row in rows:
            try:
                value = float(row["_value"])
            except (KeyError, TypeError, ValueError):
                continue
            points.append({"t": row.get("_time", ""), "v": value})

        latest = points[-1]["v"] if points else None
        has_any_data = has_any_data or latest is not None
        metrics.append({
            "key": key,
            "label": config["label"],
            "value": latest,
            "unit": config["unit"],
            "min": config["normal"][0],
            "max": config["critical"] * 1.1,
            "threshold": config["warning"],
            "normalRange": config["normal"],
            "warningThreshold": config["warning"],
            "criticalThreshold": config["critical"],
            "status": _status(latest, config),
            "spark": points,
            "dataAvailable": latest is not None,
            "source": {"bucket": config["bucket"], "measurement": config["measurement"]},
        })

    if not has_any_data:
        raise InfluxTelemetryError("InfluxDB returned no configured machine telemetry")

    available_values = [m["value"] for m in metrics if m["value"] is not None]
    has_critical = any(m["status"] == "critical" for m in metrics)
    has_warning = any(m["status"] == "warning" for m in metrics)
    status = "Critical" if has_critical else "Warning" if has_warning else "Healthy"
    health_score = max(0, min(100, round(100 - sum(
        35 if m["status"] == "critical" else 15 if m["status"] == "warning" else 0
        for m in metrics
    ))))

    machine_name = os.getenv("INFLUX_MACHINE_NAME", "Live InfluxDB Equipment")
    machine_code = os.getenv("INFLUX_MACHINE_CODE", "INFLUX-01")
    return {
        "id": machine_code,
        "code": machine_code,
        "name": machine_name,
        "type": "InfluxDB telemetry stream",
        "location": "Configured InfluxDB source",
        "plant": "Configured InfluxDB source",
        "line": "Configured InfluxDB source",
        "healthScore": health_score,
        "status": status,
        "activeIssues": int(has_critical or has_warning),
        "lastAnomalyAt": datetime.now(timezone.utc).isoformat() if has_critical or has_warning else None,
        "lastUpdated": datetime.now(timezone.utc).isoformat(),
        "operator": "Not configured",
        "installDate": "Not configured",
        "lastMaintenance": "Not configured",
        "agentStatus": "Monitoring",
        "metrics": metrics,
        "liveMetrics": metrics,
        "anomalies": [],
        "issues": [],
        "useCases": [],
        "recommendations": [],
        "specs": [],
        "source": "InfluxDB",
        "availableMetricCount": len(available_values),
    }
