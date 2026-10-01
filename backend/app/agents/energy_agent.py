"""Live-telemetry conversation runner for the Energy Agent."""

import asyncio
import json
import logging
import os
import time
import uuid
from datetime import datetime, timezone
from typing import Any

from app.influx_telemetry import get_machine_telemetry
from app.llm_gateway import execute_completion

logger = logging.getLogger("energy_agent")

ENERGY_SYSTEM_PROMPT = """You are Energy Agent, an industrial electrical telemetry assistant.
Use only the live InfluxDB telemetry provided in the current turn and prior
conversation. Clearly identify device IDs and signals when available. Distinguish
observed readings from possible explanations. Never invent values, alerts, devices,
or energy consumption. Do not claim kWh, peak-demand savings, or forecasts unless
validated power/energy readings and sufficient history are explicitly supplied.
If telemetry is unavailable, explain that limitation and what data is needed.
Respond concisely and professionally. For operational changes, provide advice only;
do not claim to have changed equipment settings.
"""

ANALYTICAL_TERMS = (
    "analyze", "analyse", "why", "root cause", "compare", "recommend",
    "trend", "anomaly", "explain", "summary", "summarize", "summarise",
    "historical", "forecast",
)


class EnergyAgentUnavailableError(RuntimeError):
    """Raised when live telemetry or an LLM response is unavailable."""


def _telemetry_context(machines: list[dict[str, Any]]) -> tuple[str, int]:
    devices = []
    for machine in machines:
        signals = []
        for metric in machine.get("liveMetrics", []):
            points = [
                point for point in metric.get("spark", [])
                if isinstance(point.get("v"), (int, float))
            ]
            values = [float(point["v"]) for point in points]
            latest = metric.get("value")
            if latest is None and values:
                latest = values[-1]
            if latest is None and not values:
                continue
            signals.append({
                "signal": metric.get("label") or metric.get("key"),
                "field": metric.get("key"),
                "unit": metric.get("unit", ""),
                "latest": latest,
                "latest_sample_time": points[-1].get("t") if points else None,
                "samples_in_window": len(values),
                "min": min(values) if values else None,
                "mean": sum(values) / len(values) if values else None,
                "max": max(values) if values else None,
                "status": metric.get("status", "unavailable"),
                "warning_threshold": metric.get("warningThreshold"),
                "critical_threshold": metric.get("criticalThreshold"),
            })
        if signals:
            devices.append({"device_id": machine.get("id"), "signals": signals})

    if not devices:
        raise EnergyAgentUnavailableError("InfluxDB returned no usable machine telemetry.")

    telemetry_range = os.getenv("INFLUX_TELEMETRY_RANGE", "24h")
    context = {
        "source": "InfluxDB",
        "bucket": os.getenv("INFLUXDB_BUCKET", "ECE2"),
        "measurement_window": telemetry_range,
        "devices": devices,
        "energy_note": (
            "kWh cannot be calculated from voltage/current alone. A validated energy counter or "
            "power measurement with sampling details is required."
        ),
    }
    return json.dumps(context, separators=(",", ":")), len(devices)


async def run_energy_agent_conversation(
    message: str,
    thread_id: str | None = None,
    history: list[dict[str, str]] | None = None,
) -> dict[str, Any]:
    started = time.perf_counter()
    thread = thread_id or f"energy-{uuid.uuid4()}"
    try:
        machines = await asyncio.to_thread(get_machine_telemetry)
    except Exception as exc:
        logger.warning("Energy Agent telemetry query failed thread=%s: %s", thread, exc)
        raise EnergyAgentUnavailableError(f"Live InfluxDB telemetry is unavailable: {exc}") from exc

    telemetry_context, device_count = _telemetry_context(machines)
    safe_history = []
    for item in (history or [])[-12:]:
        role = item.get("role")
        content = item.get("content", "")
        if role in {"user", "assistant"} and isinstance(content, str) and content:
            safe_history.append({"role": role, "content": content[:4000]})

    messages = [
        {"role": "system", "content": ENERGY_SYSTEM_PROMPT},
        *safe_history,
        {
            "role": "user",
            "content": (
                f"Question: {message}\n\n"
                f"Live InfluxDB telemetry summary (JSON):\n{telemetry_context}"
            ),
        },
    ]

    analytical = any(term in message.lower() for term in ANALYTICAL_TERMS)
    requested_model = "gemini" if analytical and os.getenv("GEMINI_API_KEY") else (
        "groq" if os.getenv("GROQ_API_KEY") else "auto"
    )
    result = await execute_completion(messages, model=requested_model, temperature=0.2, max_tokens=900)
    if result.get("error") or not result.get("text"):
        raise EnergyAgentUnavailableError(result.get("error") or "The Energy Agent did not return a response.")

    usage = result.get("usage") or {}
    prompt_tokens = int(usage.get("prompt_tokens") or usage.get("input_tokens") or 0)
    completion_tokens = int(usage.get("completion_tokens") or usage.get("output_tokens") or 0)
    cost_usd = float(result.get("cost_usd") or 0.0)
    elapsed = round(time.perf_counter() - started, 2)
    trace = {
        "thread_id": thread,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "model": result.get("model_used"),
        "tools_used": [{"name": "get_influx_telemetry", "status": "completed", "device_count": device_count}],
        "tokens": {
            "prompt_tokens": prompt_tokens,
            "completion_tokens": completion_tokens,
            "total_tokens": prompt_tokens + completion_tokens,
        },
        "cost_usd": cost_usd,
        "execution_time_sec": elapsed,
        "data_source": "InfluxDB",
        "telemetry_range": os.getenv("INFLUX_TELEMETRY_RANGE", "24h"),
    }
    logger.info(
        "Energy Agent turn thread=%s model=%s devices=%d prompt_tokens=%d completion_tokens=%d cost_usd=%.8f elapsed_sec=%.2f",
        thread, result.get("model_used"), device_count, prompt_tokens, completion_tokens, cost_usd, elapsed,
    )
    return {"status": "success", "thread_id": thread, "reply": result["text"], **trace, "trace": trace}