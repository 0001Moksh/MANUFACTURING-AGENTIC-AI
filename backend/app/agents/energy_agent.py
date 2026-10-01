"""Live-telemetry conversation runner for the Energy Agent."""

import asyncio
import json
import logging
import os
import re
import time
import uuid
from bisect import bisect_left
from datetime import datetime, timezone
from typing import Any

from app.influx_telemetry import get_machine_telemetry
from app.llm_gateway import execute_completion

logger = logging.getLogger("energy_agent")

ENERGY_SYSTEM_PROMPT = """You are Energy Agent, an industrial electrical telemetry assistant.
Use only the live InfluxDB telemetry provided in the current turn and prior
conversation. Clearly identify device IDs and signals when available. Distinguish
observed readings from possible explanations. Never invent values, alerts, devices,
or calculations. When voltage and current are available, use derived_power_energy.
Per-phase V x I gives apparent power in VA; the sum of all three correctly mapped
phases gives an apparent-power estimate in kVA. Integrating apparent power over time
produces kVAh. Real power/energy requires a measured power factor or a validated
active-power/energy meter. If ENERGY_AGENT_POWER_FACTOR is configured, values based
on it are estimates and must be labelled as such; PF=1 is only a unity-power-factor
scenario, not actual active/billed energy. If three-phase coverage is incomplete,
clearly label the result partial. Do not say energy cannot be estimated when derived
values are present. Never claim peak-demand savings or forecasts without evidence.
If an earlier assistant message said energy could not be estimated but this turn
contains derived_power_energy, correct that earlier answer using the supplied result.
If telemetry is unavailable, explain that limitation and what data is needed.
Respond concisely and professionally. For operational changes, provide advice only;
do not claim to have changed equipment settings.
"""

ANALYTICAL_TERMS = (
    "analyze", "analyse", "why", "root cause", "compare", "recommend",
    "trend", "anomaly", "explain", "summary", "summarize", "summarise",
    "historical", "forecast", "energy", "kwh", "consumption", "power",
)


class EnergyAgentUnavailableError(RuntimeError):
    """Raised when live telemetry or an LLM response is unavailable."""


PHASE_FIELDS = (
    ("RN_V", "R_Current"),
    ("YN_V", "Y_Current"),
    ("BN_V", "B_Current"),
)


def _timestamp_seconds(value: Any) -> float | None:
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone.utc)
        return parsed.timestamp()
    except (TypeError, ValueError):
        return None


def _series(machine: dict[str, Any], field: str) -> list[tuple[float, float]]:
    metric = next((item for item in machine.get("liveMetrics", []) if item.get("key") == field), None)
    points = []
    for point in (metric or {}).get("spark", []):
        timestamp = _timestamp_seconds(point.get("t"))
        value = point.get("v")
        if timestamp is not None and isinstance(value, (int, float)):
            points.append((timestamp, float(value)))
    points.sort(key=lambda item: item[0])
    return points


def _match_samples(
    voltage: list[tuple[float, float]],
    current: list[tuple[float, float]],
    tolerance_seconds: float = 30,
) -> list[tuple[float, float]]:
    voltage_times = [point[0] for point in voltage]
    matched = []
    for current_time, current_value in current:
        index = bisect_left(voltage_times, current_time)
        candidates = voltage[max(0, index - 1):min(len(voltage), index + 1)]
        if not candidates:
            continue
        voltage_time, voltage_value = min(candidates, key=lambda point: abs(point[0] - current_time))
        if abs(voltage_time - current_time) <= tolerance_seconds:
            matched.append(((voltage_time + current_time) / 2, voltage_value * current_value))
    return matched


def _integrate_apparent_energy(samples: list[tuple[float, float]]) -> tuple[float | None, float]:
    if len(samples) < 2:
        return None, 0.0
    samples.sort(key=lambda item: item[0])
    intervals = [samples[index][0] - samples[index - 1][0] for index in range(1, len(samples))]
    positive_intervals = sorted(interval for interval in intervals if interval > 0)
    if not positive_intervals:
        return None, 0.0
    median_interval = positive_intervals[len(positive_intervals) // 2]
    max_gap = max(300.0, median_interval * 3)
    energy_vah = 0.0
    coverage_seconds = 0.0
    for index, interval in enumerate(intervals, start=1):
        if interval <= 0 or interval > max_gap:
            continue
        energy_vah += ((samples[index - 1][1] + samples[index][1]) / 2) * interval / 3600
        coverage_seconds += interval
    if coverage_seconds <= 0:
        return None, 0.0
    return energy_vah / 1000, coverage_seconds / 3600


def _derive_power_energy(machine: dict[str, Any]) -> dict[str, Any]:
    """Derive apparent power from aligned V/I samples and integrate it over time.

    Per-phase V x I is apparent power (VA), not real power (W). Real-power
    estimates are included only when ENERGY_AGENT_POWER_FACTOR is configured.
    """
    phase_samples: dict[str, list[tuple[float, float]]] = {}
    phases_present: list[str] = []

    for voltage_field, current_field in PHASE_FIELDS:
        matched = _match_samples(
            _series(machine, voltage_field),
            _series(machine, current_field),
        )
        if matched:
            phase = voltage_field[:1]
            phases_present.append(phase)
            phase_samples[phase] = matched

    samples: list[tuple[float, float]] = []
    if len(phase_samples) == len(PHASE_FIELDS):
        # Aggregate each phase into minute buckets first. This avoids requiring
        # independently sampled phases to have exactly the same timestamp.
        per_phase_minute: dict[str, dict[int, list[float]]] = {}
        for phase, points in phase_samples.items():
            minute_values: dict[int, list[float]] = {}
            for timestamp, volt_amperes in points:
                minute = int(timestamp // 60)
                minute_values.setdefault(minute, []).append(volt_amperes)
            per_phase_minute[phase] = minute_values

        common_minutes = set.intersection(
            *(set(per_phase_minute[phase]) for phase in per_phase_minute)
        )
        for minute in sorted(common_minutes):
            phase_averages = [
                sum(per_phase_minute[phase][minute])
                / len(per_phase_minute[phase][minute])
                for phase in ("R", "Y", "B")
            ]
            samples.append((minute * 60 + 30, sum(phase_averages)))

        if samples:
            basis = (
                "sum of minute-averaged RN_V x R_Current, "
                "YN_V x Y_Current, and BN_V x B_Current"
            )
            coverage = "complete three-phase; common minute buckets only"
        else:
            phase_samples = {}

    if not samples:
        # Fallback is deliberately labelled as an equivalent-phase estimate.
        # Do not multiply V_AVG x Current_AVG by three unless the signal
        # definitions confirm that this is the correct interpretation.
        samples = _match_samples(
            _series(machine, "V_AVG"),
            _series(machine, "Current_AVG"),
        )
        if not samples:
            return {
                "status": "unavailable",
                "reason": "No timestamp-aligned voltage/current pair was found.",
                "available_phases": sorted(phases_present),
                "power_factor_configured": False,
            }
        basis = "V_AVG x Current_AVG; equivalent-phase apparent-power estimate"
        coverage = "equivalent-phase estimate; total three-phase coverage not verified"

    samples.sort(key=lambda item: item[0])
    latest_kva = samples[-1][1] / 1000 if samples else None
    apparent_kvah, covered_hours = _integrate_apparent_energy(samples)

    pf_raw = os.getenv("ENERGY_AGENT_POWER_FACTOR", "").strip()
    power_factor: float | None = None
    if pf_raw:
        try:
            candidate_pf = float(pf_raw)
            if 0 < candidate_pf <= 1:
                power_factor = candidate_pf
            else:
                logger.warning(
                    "Ignoring ENERGY_AGENT_POWER_FACTOR outside (0, 1]: %r",
                    pf_raw,
                )
        except ValueError:
            logger.warning("Ignoring invalid ENERGY_AGENT_POWER_FACTOR: %r", pf_raw)

    estimated_real_kw = (
        latest_kva * power_factor if latest_kva is not None and power_factor is not None else None
    )
    estimated_real_kwh = (
        apparent_kvah * power_factor
        if apparent_kvah is not None and power_factor is not None
        else None
    )

    return {
        "status": "estimated" if apparent_kvah is not None else "power_only",
        "basis": basis,
        "coverage": coverage,
        "available_phases": sorted(phases_present),
        "matched_sample_count": len(samples),
        "latest_apparent_power_kva": round(latest_kva, 4) if latest_kva is not None else None,
        "integrated_apparent_energy_kvah": round(apparent_kvah, 6) if apparent_kvah is not None else None,
        "estimated_real_power_kw_at_configured_pf": round(estimated_real_kw, 4) if estimated_real_kw is not None else None,
        "estimated_real_energy_kwh_at_configured_pf": round(estimated_real_kwh, 6) if estimated_real_kwh is not None else None,
        "unity_power_factor_energy_scenario_kwh": round(apparent_kvah, 6) if apparent_kvah is not None else None,
        "power_factor_assumption": power_factor,
        "power_factor_configured": power_factor is not None,
        "integrated_coverage_hours": round(covered_hours, 4),
        "from": datetime.fromtimestamp(samples[0][0], timezone.utc).isoformat() if samples else None,
        "to": datetime.fromtimestamp(samples[-1][0], timezone.utc).isoformat() if samples else None,
        "calculation_note": (
            "V x I and summed phase values are apparent-power estimates. "
            "Configured-PF kW/kWh are estimates, not meter-verified active power/energy."
            if power_factor is not None else
            "Only apparent kVA/kVAh are derived. Set ENERGY_AGENT_POWER_FACTOR "
            "from a measured/documented value to estimate real kW/kWh; do not assume it."
        ),
    }


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
            devices.append({
                "device_id": machine.get("id"),
                "signals": signals,
                "derived_power_energy": _derive_power_energy(machine),
            })

    if not devices:
        raise EnergyAgentUnavailableError("InfluxDB returned no usable machine telemetry.")

    telemetry_range = os.getenv("INFLUX_TELEMETRY_RANGE", "24h")
    context = {
        "source": "InfluxDB",
        "bucket": os.getenv("INFLUXDB_BUCKET", "ECE2"),
        "measurement_window": telemetry_range,
        "devices": devices,
        "energy_note": (
            "Apparent power is derived from timestamp-aligned voltage x current and integrated "
            "using trapezoidal integration over valid sample intervals. kVA/kVAh are apparent "
            "power/energy estimates. Real kW/kWh are included only when "
            "ENERGY_AGENT_POWER_FACTOR is configured and are still estimates; use a validated "
            "active-power reading or active-energy counter for meter-grade results."
        ),
    }
    return json.dumps(context, separators=(",", ":")), len(devices)


def _is_energy_consumption_question(message: str) -> bool:
    text = message.lower()
    terms = (
        "energy consumption", "energy consumed", "energy usage", "consumption",
        "kwh", "kvah", "power consumption", "energy for", "consumed energy",
    )
    return any(term in text for term in terms)


def _requested_device_id(message: str, machines: list[dict[str, Any]]) -> str | None:
    message_upper = message.upper()
    for machine in machines:
        device_id = str(machine.get("id") or "").strip()
        if device_id and device_id.upper() in message_upper:
            return device_id
    return None


def _format_device_energy_answer(machine: dict[str, Any]) -> str:
    device_id = str(machine.get("id") or "Unknown device")
    result = _derive_power_energy(machine)
    lines = [f"Energy calculation for device {device_id}"]

    latest_kva = result.get("latest_apparent_power_kva")
    apparent_kvah = result.get("integrated_apparent_energy_kvah")
    real_kw = result.get("estimated_real_power_kw_at_configured_pf")
    real_kwh = result.get("estimated_real_energy_kwh_at_configured_pf")
    unity_kwh = result.get("unity_power_factor_energy_scenario_kwh")
    pf = result.get("power_factor_assumption")
    coverage_hours = result.get("integrated_coverage_hours")

    if latest_kva is not None:
        lines.append(f"- Latest derived apparent power: {latest_kva:.4f} kVA")

    if apparent_kvah is not None:
        lines.append(f"- Integrated apparent energy over valid samples: {apparent_kvah:.6f} kVAh")
        if coverage_hours is not None:
            lines.append(f"- Valid integration coverage: {coverage_hours:.4f} hours")
        if result.get("from") and result.get("to"):
            lines.append(f"- Sample interval: {result['from']} to {result['to']} (UTC)")
        lines.append(f"- Coverage: {result.get('coverage', 'not verified')}")

        if real_kwh is not None and real_kw is not None:
            lines.append(
                f"- Estimated real energy at configured PF {pf:.3f}: {real_kwh:.6f} kWh"
            )
            lines.append(
                f"- Estimated real power at configured PF {pf:.3f}: {real_kw:.4f} kW"
            )
            lines.append(
                "Note: these are estimates based on the configured power factor, "
                "not meter-verified active energy."
            )
        else:
            if unity_kwh is not None:
                lines.append(
                    f"- Unity-PF scenario only: {unity_kwh:.6f} kWh (assumes PF = 1.0; "
                    "not actual active/billed energy)."
                )
            lines.append(
                "Actual active energy in kWh cannot be confirmed without a measured/documented "
                "power factor or a validated active-energy meter. The measured-derived result "
                "above is apparent energy in kVAh."
            )
    else:
        lines.append("- Integrated energy: unavailable from the current telemetry samples.")
        lines.append(f"- Reason: {result.get('reason', 'Insufficient timestamp-aligned samples.')}")
        phases = result.get("available_phases") or []
        lines.append(
            "- Available matched phases: " + (", ".join(phases) if phases else "none detected")
        )
        lines.append(
            "To calculate this, the device needs timestamped voltage/current samples that align "
            "within the matching tolerance and at least two valid power samples for integration. "
            "Check the liveMetrics spark data and timestamps returned by get_machine_telemetry."
        )

    return "\n".join(lines)


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

    # For direct device-specific energy-consumption questions, answer from the
    # deterministic calculation rather than relying on the LLM to notice JSON fields.
    if _is_energy_consumption_question(message):
        requested_id = _requested_device_id(message, machines)
        if requested_id:
            matched_machine = next(
                machine for machine in machines
                if str(machine.get("id") or "").upper() == requested_id.upper()
            )
            reply = _format_device_energy_answer(matched_machine)
            elapsed = round(time.perf_counter() - started, 2)
            trace = {
                "thread_id": thread,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "model": "deterministic-telemetry-calculation",
                "tools_used": [{
                    "name": "get_machine_telemetry",
                    "status": "completed",
                    "device_count": device_count,
                }],
                "tokens": {
                    "prompt_tokens": 0,
                    "completion_tokens": 0,
                    "total_tokens": 0,
                },
                "cost_usd": 0.0,
                "execution_time_sec": elapsed,
                "data_source": "InfluxDB",
                "telemetry_range": os.getenv("INFLUX_TELEMETRY_RANGE", "24h"),
            }
            logger.info(
                "Energy calculation thread=%s device=%s elapsed_sec=%.2f",
                thread, requested_id, elapsed,
            )
            return {
                "status": "success",
                "thread_id": thread,
                "reply": reply,
                **trace,
                "trace": trace,
            }

        # Avoid letting the model invent readings for an ID not present in live data.
        possible_ids = re.findall(r"\b[A-Z0-9][A-Z0-9_-]{5,}\b", message.upper())
        if possible_ids:
            requested_id = possible_ids[-1]
            known_ids = [str(machine.get("id") or "") for machine in machines]
            reply = (
                f"Energy consumption for device {requested_id} is unavailable because this device "
                "was not present in the current live InfluxDB telemetry response. "
                f"Devices returned: {', '.join(known_ids) if known_ids else 'none'}. "
                "Check the device ID and telemetry query."
            )
            elapsed = round(time.perf_counter() - started, 2)
            trace = {
                "thread_id": thread,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "model": "deterministic-telemetry-check",
                "tools_used": [{"name": "get_machine_telemetry", "status": "completed", "device_count": device_count}],
                "tokens": {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0},
                "cost_usd": 0.0,
                "execution_time_sec": elapsed,
                "data_source": "InfluxDB",
                "telemetry_range": os.getenv("INFLUX_TELEMETRY_RANGE", "24h"),
            }
            return {"status": "success", "thread_id": thread, "reply": reply, **trace, "trace": trace}

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