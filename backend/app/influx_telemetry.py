import csv
import io
import os
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime
from typing import Any, Dict, List
import logging
from zoneinfo import ZoneInfo


logger = logging.getLogger("influx_telemetry")

IST = ZoneInfo("Asia/Kolkata")
CANONICAL_MEASUREMENT = "electrical_params"
FIELD_METADATA = {
    "BN_V": {"label": "BN Voltage", "unit": "V"},
    "BR_V": {"label": "BR Voltage", "unit": "V"},
    "B_Current": {"label": "B Current", "unit": "A"},
    "Cumulative_Cycles": {"label": "Cumulative Cycles", "unit": "cycles"},
    "Current_AVG": {"label": "Average Current", "unit": "A"},
    "Dry_Status": {"label": "Dry Status", "unit": "status"},
    "Proxy_Count": {"label": "Proxy Count", "unit": "count"},
    "RN_V": {"label": "RN Voltage", "unit": "V"},
    "RY_V": {"label": "RY Voltage", "unit": "V"},
    "R_Current": {"label": "R Current", "unit": "A"},
    "Temperature": {"label": "Temperature", "unit": "°C"},
    "V_AVG": {"label": "Average Voltage", "unit": "V"},
    "YB_V": {"label": "YB Voltage", "unit": "V"},
    "YN_V": {"label": "YN Voltage", "unit": "V"},
    "Y_Current": {"label": "Y Current", "unit": "A"},
}


class InfluxTelemetryError(RuntimeError):
    pass


SUPPORTED_INFLUX_BUCKETS = ["ECE2", "mps"]


def normalize_influx_bucket(bucket_name: str | None) -> str:
    if not bucket_name:
        return "ECE2"
    normalized = str(bucket_name).strip()
    if not normalized:
        return "ECE2"
    lookup = normalized.lower().replace(" ", "")
    if lookup in {"ece2", "ece-2"}:
        return "ECE2"
    if lookup in {"mps", "mp3"}:
        return "mps"
    return normalized


def get_active_influx_bucket() -> str:
    return normalize_influx_bucket(os.getenv("INFLUXDB_BUCKET", "ECE2"))


def list_supported_influx_buckets() -> List[str]:
    return ["ECE2", "mps"]


def set_active_influx_bucket(bucket_name: str) -> Dict[str, Any]:
    normalized = normalize_influx_bucket(bucket_name)
    if normalized not in set(list_supported_influx_buckets()):
        raise ValueError(f"Unsupported Influx DB bucket: {bucket_name}")
    os.environ["INFLUXDB_BUCKET"] = normalized
    return {
        "activeBucket": normalized,
        "supportedBuckets": list_supported_influx_buckets(),
        "message": f"InfluxDB bucket switched to {normalized}",
    }


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
        if any(column in record for column in ("_time", "_value", "_field")):
            header = record
            continue
        if header and len(record) == len(header):
            rows.append(dict(zip(header, record)))
    return rows


def _discover_measurements() -> List[str]:
    bucket = get_active_influx_bucket().replace('"', '\\"')
    flux = f'''import "influxdata/influxdb/schema"
schema.measurements(bucket: "{bucket}")'''
    measurements = [row.get("_value", "").strip() for row in _query_flux(flux) if row.get("_value", "").strip()]
    ordered = []
    for candidate in [CANONICAL_MEASUREMENT, *measurements]:
        if candidate not in ordered:
            ordered.append(candidate)
    return ordered


def _discover_fields_for_measurement(measurement: str) -> List[str]:
    bucket = get_active_influx_bucket().replace('"', '\\"')
    measurement_name = measurement.replace('"', '\\"')
    flux = f'''import "influxdata/influxdb/schema"
schema.fieldKeys(
  bucket: "{bucket}",
  predicate: (r) => r._measurement == "{measurement_name}",
  start: -30d
)'''
    fields = {row.get("_value", "").strip() for row in _query_flux(flux) if row.get("_value", "").strip()}
    return sorted(fields)


def _discover_fields() -> List[str]:
    discovered: List[str] = []
    for measurement in _discover_measurements():
        fields = _discover_fields_for_measurement(measurement)
        if fields:
            discovered.extend(fields)
    return sorted(set(discovered))


def _metric_config(field: str, measurement_name: str = CANONICAL_MEASUREMENT) -> Dict[str, Any]:
    metadata = FIELD_METADATA.get(field, {})
    return {
        **metadata,
        "label": metadata.get("label", field.replace("_", " ").strip()),
        "unit": metadata.get("unit", ""),
        "measurement": measurement_name,
        "field": field,
        "bucket": get_active_influx_bucket(),
        "normal": metadata.get("normal"),
        "warning": metadata.get("warning"),
        "critical": metadata.get("critical"),
    }


def _metric_rows(metric_key: str, config: Dict[str, Any], range_window: str) -> List[Dict[str, str]]:
    bucket = config["bucket"].replace('"', '\\"')
    measurement = config["measurement"].replace('"', '\\"')
    field = config["field"].replace('"', '\\"')
    device_id = os.getenv("INFLUX_DEVICE_ID", "").strip().replace('"', '\\"')
    device_filter = f' and r.device_id == "{device_id}"' if device_id else ""
    flux = f'''from(bucket: "{bucket}")
  |> range(start: -{range_window})
    |> filter(fn: (r) => r._measurement == "{measurement}" and r._field == "{field}"{device_filter})
  |> aggregateWindow(every: 1m, fn: last, createEmpty: false)
  |> sort(columns: ["_time"])
  |> tail(n: 120)'''
    rows = _query_flux(flux)
    if rows or (measurement == CANONICAL_MEASUREMENT and field in FIELD_METADATA):
        return rows

    canonical_field = metric_key if metric_key in FIELD_METADATA else None
    if not canonical_field:
        return rows

    logger.warning(
        "No Influx rows for configured metric %s (%s/%s); retrying canonical schema %s/%s",
        metric_key,
        measurement,
        field,
        CANONICAL_MEASUREMENT,
        canonical_field,
    )
    config["measurement"] = CANONICAL_MEASUREMENT
    config["field"] = canonical_field
    canonical_config = dict(config)
    return _metric_rows(metric_key, canonical_config, range_window)


def _status(value: float | None, config: Dict[str, Any]) -> str:
    if value is None:
        return "unavailable"
    if config.get("critical") is not None and value >= config["critical"]:
        return "critical"
    if config.get("warning") is not None and value >= config["warning"]:
        return "warning"
    return "normal"


def get_machine_telemetry() -> List[Dict[str, Any]]:
    device_metrics: Dict[str, Dict[str, List[Dict[str, Any]]]] = {}
    range_window = os.getenv("INFLUX_TELEMETRY_RANGE", "24h")
    measurement_fields: Dict[str, List[str]] = {}

    for measurement in _discover_measurements():
        fields = _discover_fields_for_measurement(measurement)
        if fields:
            measurement_fields[measurement] = fields

    if not measurement_fields:
        raise InfluxTelemetryError(f"InfluxDB returned no fields for the active bucket '{get_active_influx_bucket()}'")

    discovered_fields = sorted({field for fields in measurement_fields.values() for field in fields})

    for measurement, fields in measurement_fields.items():
        for key in fields:
            config = _metric_config(key, measurement_name=measurement)
            for row in _metric_rows(key, config, range_window):
                device_id = row.get("device_id")
                if not device_id:
                    continue
                try:
                    value = float(row["_value"])
                except (KeyError, TypeError, ValueError):
                    continue
                device_metrics.setdefault(device_id, {}).setdefault(key, []).append({
                    "t": row.get("_time", ""),
                    "v": value,
                    "deviceId": device_id,
                    "measurement": measurement,
                })

    if not device_metrics:
        raise InfluxTelemetryError("InfluxDB returned no configured machine telemetry")

    machines = []
    for device_id, fields in sorted(device_metrics.items()):
        metrics = []
        for key in discovered_fields:
            measurement = next(
                (measurement_name for measurement_name, measurement_keys in measurement_fields.items() if key in measurement_keys),
                CANONICAL_MEASUREMENT,
            )
            config = _metric_config(key, measurement_name=measurement)
            points = sorted([point for point in fields.get(key, [])], key=lambda point: point["t"])
            latest = points[-1]["v"] if points else None
            normal = config.get("normal")
            metrics.append({
                "key": key,
                "label": config["label"],
                "value": latest,
                "unit": config["unit"],
                "min": normal[0] if normal else None,
                "max": config["critical"] * 1.1 if config.get("critical") else None,
                "threshold": config.get("warning"),
                "normalRange": normal,
                "warningThreshold": config.get("warning"),
                "criticalThreshold": config.get("critical"),
                "status": _status(latest, config),
                "spark": points,
                "dataAvailable": latest is not None,
                "source": {"bucket": config["bucket"], "measurement": config["measurement"], "field": config["field"], "deviceId": device_id},
            })
        monitored = [metric for metric in metrics if metric["value"] is not None]
        has_critical = any(metric["status"] == "critical" for metric in monitored)
        has_warning = any(metric["status"] == "warning" for metric in monitored)
        status = "Critical" if has_critical else "Warning" if has_warning else "Healthy"
        health_score = max(0, min(100, round(100 - sum(35 if metric["status"] == "critical" else 15 if metric["status"] == "warning" else 0 for metric in monitored))))
        machines.append({
            "id": device_id,
            "code": device_id,
            "name": f"InfluxDB Machine {device_id}",
            "type": "InfluxDB device",
            "location": "Configured InfluxDB source",
            "plant": "Configured InfluxDB source",
            "line": "Configured InfluxDB source",
            "healthScore": health_score,
            "status": status,
            "activeIssues": int(has_critical or has_warning),
            "lastAnomalyAt": datetime.now(IST).isoformat() if has_critical or has_warning else None,
            "lastUpdated": datetime.now(IST).isoformat(),
            "operator": "Not configured",
            "installDate": "Not configured",
            "lastMaintenance": "Not configured",
            "agentStatus": "Monitoring",
            "metrics": metrics,
            "liveMetrics": metrics,
            "anomalies": [], "issues": [], "useCases": [], "recommendations": [], "specs": [],
            "source": "InfluxDB",
            "availableMetricCount": len(monitored),
        })
    return machines
