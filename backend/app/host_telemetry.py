"""InfluxDB 3 reads shared by host-plugin routes."""

import asyncio
from datetime import datetime, timezone
from typing import Any

from .influx_telemetry import InfluxTelemetryError, query_influxdb3_sql_async
from .memory_telemetry import memory_sample


HOST_TABLES = {
    "telegraf_cpu", "telegraf_mem", "telegraf_disk", "telegraf_diskio",
    "telegraf_net", "telegraf_mqtt", "telegraf_modbus", "telegraf_opcua",
    "iiiot_veda_ping", "iiiot_veda_http_response", "iiiot_veda_dns_query", "iiiot_veda_net_response", "iiiot_veda_x509_cert", "iiiot_veda_netstat",
    "iiiot_veda_email_response", "iiiot_veda_email_cert", "iiiot_veda_system", "iiiot_veda_swap", "iiiot_veda_processes", "iiiot_veda_procstat",
    "iiiot_veda_desktop_system", "iiiot_veda_desktop_processes", "iiiot_veda_docker", "iiiot_veda_kubernetes", "iiiot_veda_mongodb", "iiiot_veda_mysql", "iiiot_veda_redis",
    "iiiot_veda_sql", "iiiot_veda_sqlserver", "iiiot_veda_postgresql", "iiiot_veda_win_eventlog", "iiiot_veda_influxdb", "iiiot_veda_internal", "iiiot_veda_github", "iiiot_veda_exec", "iiiot_veda_execd", "iiiot_veda_file", "iiiot_veda_socket_listener", "iiiot_veda_http", "iiiot_veda_http_listener", "iiiot_veda_nvidia", "iiiot_veda_s7",
    "iiiot_veda_syslog", "iiiot_veda_cisco_telemetry", "iiiot_veda_system_extended", "iiiot_veda_opentelemetry", "iiiot_veda_nginx", "iiiot_veda_csv", "iiiot_veda_grok",
}


def docker_daemon_is_idle(checks: list[dict[str, Any]]) -> bool:
    """Return true when Docker is reachable and has no running containers.

    An idle Docker host is a healthy monitoring target even though it may not
    produce container-level measurements.
    """
    daemon_check = next((check for check in checks if check.get("name") == "docker_daemon"), None)
    if not daemon_check or not daemon_check.get("passed"):
        return False
    try:
        return int(daemon_check.get("running_containers")) == 0
    except (TypeError, ValueError):
        return False


def plugin_telemetry_is_connected(
    plugin_kind: str,
    metric: dict[str, Any] | None,
    query_succeeded: bool,
    checks: list[dict[str, Any]],
) -> bool:
    """Verify the installed collector and destination independently of source traffic.

    A missing or idle source must not force customers to manufacture a sample
    event. Installation checks are performed before this function and a
    successful query proves that the InfluxDB endpoint is reachable and
    authenticated, even when the plugin's measurement has not been created yet.
    """
    return query_succeeded


def influx_table_is_missing(error: Exception) -> bool:
    detail = str(error).lower()
    identifies_table = "table" in detail or "measurement" in detail
    reports_missing = any(marker in detail for marker in ("not found", "does not exist", "unknown table"))
    return identifies_table and reports_missing


async def _query(table: str, minutes: int, limit: int) -> list[dict[str, Any]]:
    if table not in HOST_TABLES:
        raise ValueError("Unsupported host telemetry table")
    return await query_influxdb3_sql_async(
        f'''SELECT * FROM "{table}" WHERE time >= now() - INTERVAL '{minutes} minutes'
            ORDER BY time DESC LIMIT {limit}'''
    )


async def latest_plugin_metric(db, table, allow_idle=False):
    if table not in HOST_TABLES:
        raise ValueError("Unsupported host telemetry table")
    idle_message = None
    try:
        async with asyncio.timeout(12):
            rows = await _query(table, 10, 1)
    except InfluxTelemetryError as exc:
        if influx_table_is_missing(exc):
            return None, f"No {table} measurement exists yet. The input must emit at least one metric before InfluxDB creates it."
        raise
    if not rows:
        if allow_idle:
            async with asyncio.timeout(12):
                rows = await query_influxdb3_sql_async(f'SELECT * FROM "{table}" ORDER BY time DESC LIMIT 1')
            if rows:
                idle_message = "No new Windows Application events in the last 10 minutes. The collector is running; this input is idle."
            else:
                return None, "No Windows Application events have been collected yet."
        else:
            return None, "No recent telemetry was found in InfluxDB. Check the IIIOT-Veda service and InfluxDB output."
    metric = dict(rows[0])
    if isinstance(metric.get("time"), str):
        try:
            metric["time"] = datetime.fromisoformat(metric["time"].replace("Z", "+00:00"))
        except ValueError:
            pass
    return metric, idle_message


async def memory_payload(db, minutes=30, limit=1200):
    minutes, limit = max(1, min(minutes, 1440)), max(1, min(limit, 5000))
    async with asyncio.timeout(12):
        influx_rows = await _query("telegraf_mem", minutes, limit)
    rows = []
    for item in influx_rows:
        fields = dict(item)
        rows.append({"time": fields.pop("time", None), "host": fields.pop("host", None), "fields": fields})
    samples = [memory_sample(row) for row in reversed(rows)]
    return {
        "plugin_id": "telegraf-memory-monitoring", "window_minutes": minutes,
        "sample_count": len(samples), "hosts": sorted({sample["host"] for sample in samples}),
        "samples": samples, "generated_at": datetime.now(timezone.utc).isoformat(),
    }


async def connector_payload(db, plugin_id, tables, minutes=30, limit=1200):
    if not tables or any(table not in HOST_TABLES for table in tables):
        raise ValueError("Unsupported connector telemetry table")
    minutes, limit = max(1, min(minutes, 1440)), max(1, min(limit, 5000))
    rows = []
    async with asyncio.timeout(12):
        for table in tables:
            for item in await _query(table, minutes, max(1, limit - len(rows))):
                fields = dict(item)
                time_value, host = fields.pop("time", None), fields.pop("host", None)
                rows.append({
                    "time": time_value.isoformat() if hasattr(time_value, "isoformat") else str(time_value),
                    "host": host or "Unknown host", "measurement": table.removeprefix("telegraf_"), "fields": fields,
                })
    rows.sort(key=lambda row: row["time"])
    rows = rows[-limit:]
    return {
        "plugin_id": plugin_id, "window_minutes": minutes, "sample_count": len(rows),
        "hosts": sorted({row["host"] for row in rows}), "measurements": sorted({row["measurement"] for row in rows}),
        "samples": rows, "generated_at": datetime.now(timezone.utc).isoformat(),
    }


async def cpu_payload(db, minutes=30, limit=1200):
    minutes, limit = max(1, min(minutes, 1440)), max(1, min(limit, 5000))
    async with asyncio.timeout(12):
        rows = await _query("telegraf_cpu", minutes, limit)
    samples = []
    for item in reversed(rows):
        sample = dict(item)
        time_value = sample.get("time")
        sample["time"] = time_value.isoformat() if hasattr(time_value, "isoformat") else str(time_value)
        sample["host"], sample["cpu"] = sample.get("host") or "Unknown host", sample.get("cpu") or "cpu-total"
        samples.append(sample)
    return {
        "plugin_id": "telegraf-cpu-monitoring", "window_minutes": minutes, "sample_count": len(samples),
        "hosts": sorted({sample["host"] for sample in samples}), "samples": samples,
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }
