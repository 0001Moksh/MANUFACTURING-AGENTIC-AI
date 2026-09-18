import asyncio
import json
import logging
import os
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import (
    AsyncSessionLocal,
    MachineAgentInvestigation,
    MachineAISummary,
    MachineIssue,
    MachineMonitoringState,
    MachineRecommendation,
)
from app.influx_telemetry import InfluxTelemetryError, get_machine_telemetry
from app.llm_gateway import execute_completion

logger = logging.getLogger("machine_monitoring")

WARNING_PERSISTENCE_SECONDS = float(os.getenv("MACHINE_WARNING_PERSISTENCE_SECONDS", "120"))
HIGH_RISK_PERSISTENCE_SECONDS = float(os.getenv("MACHINE_HIGH_RISK_PERSISTENCE_SECONDS", "120"))
RECOVERY_VERIFICATION_SECONDS = float(os.getenv("MACHINE_RECOVERY_VERIFICATION_SECONDS", "120"))
MONITORING_WINDOW_MINUTES = int(os.getenv("MACHINE_MONITORING_WINDOW_MINUTES", "120"))

DEFAULT_RECOMMENDATIONS = {
    "temperature": ["Check surrounding environment and cooling airflow", "Check for nearby heat sources", "Continue monitoring the temperature trend"],
    "vibration": ["Inspect mounting and loose components", "Check for abnormal mechanical vibration", "Continue monitoring the vibration trend"],
    "current": ["Check operating load", "Check electrical input and current behavior", "Monitor the current trend"],
    "power": ["Check load and power consumption", "Compare with the normal operating pattern", "Monitor the power trend"],
    "rpm": ["Check machine operating speed", "Check the speed and load relationship", "Monitor the RPM trend"],
}


def _now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _recommendations(metric: str) -> List[str]:
    configured = os.getenv("MACHINE_WARNING_RECOMMENDATIONS_JSON", "").strip()
    if configured:
        try:
            values = json.loads(configured)
            if isinstance(values, dict) and isinstance(values.get(metric), list):
                return [str(value) for value in values[metric]]
        except json.JSONDecodeError:
            logger.warning("Invalid MACHINE_WARNING_RECOMMENDATIONS_JSON configuration")
    return DEFAULT_RECOMMENDATIONS.get(metric, ["Continue monitoring the affected parameter"])


def _snapshot(telemetry: Dict[str, Any]) -> Dict[str, Any]:
    metrics = {}
    for metric in telemetry.get("liveMetrics", []):
        points = [point["v"] for point in metric.get("spark", []) if isinstance(point.get("v"), (int, float))]
        metrics[metric["key"]] = {
            "value": metric.get("value"),
            "status": metric.get("status", "normal").upper(),
            "unit": metric.get("unit"),
            "normal_range": metric.get("normalRange"),
            "warning_threshold": metric.get("warningThreshold"),
            "critical_threshold": metric.get("criticalThreshold"),
            "average": round(sum(points) / len(points), 3) if points else None,
            "minimum": min(points) if points else None,
            "maximum": max(points) if points else None,
            "samples": len(points),
            "trend": ("rising" if len(points) > 1 and points[-1] > points[0] else "falling" if len(points) > 1 and points[-1] < points[0] else "stable") if points else "unknown",
        }
    return {
        "machine_code": telemetry.get("code"),
        "machine_name": telemetry.get("name"),
        "operational_status": telemetry.get("status"),
        "source": "InfluxDB",
        "window_minutes": MONITORING_WINDOW_MINUTES,
        "metrics": metrics,
        "captured_at": _now().isoformat(),
    }


def _operational_state(snapshot: Dict[str, Any]) -> str:
    metrics = snapshot.get("metrics", {})
    available = [item for item in metrics.values() if item.get("value") is not None]
    if not available:
        return "OFFLINE"
    rpm = metrics.get("rpm", {}).get("value")
    power = metrics.get("power", {}).get("value")
    if rpm is not None and power is not None and rpm <= 0 and power <= 0:
        return "STOPPED"
    return "RUNNING"


def _state_from_snapshot(snapshot: Dict[str, Any]) -> str:
    states = [item.get("status") for item in snapshot.get("metrics", {}).values() if item.get("value") is not None]
    if any(state == "CRITICAL" for state in states):
        return "HIGH_RISK"
    if any(state == "WARNING" for state in states):
        return "WARNING"
    return "NORMAL"


def _parse_agent_result(text: str, context: Dict[str, Any]) -> Dict[str, Any]:
    text = str(text or "").strip()
    if text.startswith("```json") and text.endswith("```"):
        text = text[7:-3].strip()
    elif text.startswith("```") and text.endswith("```"):
        text = text[3:-3].strip()
    try:
        parsed = json.loads(text)
        if isinstance(parsed, dict):
            return parsed
    except (TypeError, json.JSONDecodeError):
        pass
    return {
        "issue_title": "Persistent machine anomaly requires review",
        "issue_summary": "Telemetry remained outside configured limits; available evidence does not prove a definitive root cause.",
        "affected_parameters": [key for key, value in context["snapshot"]["metrics"].items() if value.get("status") in {"WARNING", "CRITICAL"}],
        "detected_condition": "Persistent configured threshold deviation",
        "possible_causes": ["Further inspection is required; telemetry alone is insufficient to identify a definitive cause."],
        "root_cause_confidence": 0.0,
        "risk_level": "HIGH",
        "recommended_actions": [],
        "immediate_actions": [],
        "corrective_actions": [],
        "preventive_actions": [],
        "evidence": context["snapshot"],
        "reasoning_summary": "Agent output was unavailable or not valid structured JSON.",
        "operator_instructions": ["Inspect the affected parameters and record the operator action."],
        "monitoring_requirements": ["Continue telemetry monitoring and verify recovery over the configured stabilization period."],
    }


def _response_text(response: Dict[str, Any]) -> str:
    content = response.get("text", "")
    if isinstance(content, str):
        return content.strip()
    if isinstance(content, list):
        parts = []
        for item in content:
            if isinstance(item, str):
                parts.append(item)
            elif isinstance(item, dict) and isinstance(item.get("text"), str):
                parts.append(item["text"])
        return "\n".join(parts).strip()
    return str(content or "").strip()


async def _generate_summary(session: AsyncSession, telemetry: Dict[str, Any], snapshot: Dict[str, Any]) -> None:
    machine_code = telemetry["code"]
    existing = (await session.execute(select(MachineAISummary).where(MachineAISummary.machine_code == machine_code))).scalars().first()
    if existing and not existing.summary_text.startswith("[LLM Response Not Available]"):
        return
    prompt = json.dumps({"machine": telemetry, "baseline": snapshot}, default=str)
    response = await execute_completion([
        {"role": "system", "content": "Create a concise machine monitoring baseline summary from the supplied telemetry. Do not invent history. Return JSON with summary_text and baseline_observations."},
        {"role": "user", "content": prompt},
    ], temperature=0.1)
    response_text = _response_text(response)
    parsed = _parse_agent_result(response_text, {"snapshot": snapshot})
    summary_text = parsed.get("summary_text") or (response_text if response_text else "")
    if not summary_text or summary_text == "Agent output was unavailable or not valid structured JSON.":
        summary_text = (
            f"[LLM Response Not Available]\n{telemetry.get('name', machine_code)} is monitored from InfluxDB over a {MONITORING_WINDOW_MINUTES}-minute configured window. "
            "Baseline observations are limited to the available telemetry samples and configured threshold context."
        )
        logger.warning("LLM returned no usable machine summary for %s; stored deterministic baseline", machine_code)
    summary_data = {
        "summary_text": str(summary_text),
        "baseline_context": snapshot,
        "model_name": response.get("model_used"),
    }
    if existing:
        existing.summary_text = summary_data["summary_text"]
        existing.baseline_context = summary_data["baseline_context"]
        existing.model_name = summary_data["model_name"]
        existing.generated_at = _now()
    else:
        session.add(MachineAISummary(machine_code=machine_code, **summary_data))
    logger.info("Stored machine AI summary for %s (response_chars=%d, model=%s)", machine_code, len(response_text), response.get("model_used", "unknown"))


async def _get_active_issue(session: AsyncSession, machine_code: str) -> Optional[MachineIssue]:
    return (await session.execute(
        select(MachineIssue).where(
            MachineIssue.machine_code == machine_code,
            MachineIssue.status.not_in(["RESOLVED"]),
        ).order_by(MachineIssue.detected_at.desc())
    )).scalars().first()


async def _create_issue(session: AsyncSession, machine_code: str, snapshot: Dict[str, Any], severity: str, now: datetime) -> MachineIssue:
    affected = [key for key, value in snapshot["metrics"].items() if value.get("status") in {"WARNING", "CRITICAL"}]
    issue = MachineIssue(
        machine_code=machine_code,
        title=f"{severity.title()} telemetry condition detected",
        severity=severity,
        status="INVESTIGATION" if severity == "HIGH_RISK" else "OPEN",
        affected_parameters=affected,
        detected_at=now,
        persistence_seconds=0,
        context=snapshot,
    )
    session.add(issue)
    await session.flush()
    if severity == "WARNING":
        for metric in affected:
            for action in _recommendations(metric):
                session.add(MachineRecommendation(machine_code=machine_code, issue_id=issue.id, action=action, category="IMMEDIATE"))
    logger.warning("Created %s machine issue %s for %s", severity, issue.id, machine_code)
    return issue


async def _investigate(session: AsyncSession, issue: MachineIssue, snapshot: Dict[str, Any], summary: Optional[MachineAISummary]) -> None:
    context = {
        "machine_code": issue.machine_code,
        "machine_summary": summary.summary_text if summary else None,
        "baseline": summary.baseline_context if summary else None,
        "snapshot": snapshot,
        "previous_issues": [],
        "previous_recommendations": [],
    }
    response = await execute_completion([
        {"role": "system", "content": "You are a machine monitoring agent. Analyze only supplied evidence. Return valid JSON with issue_title, issue_summary, affected_parameters, detected_condition, possible_causes, root_cause_confidence, risk_level, recommended_actions, immediate_actions, corrective_actions, preventive_actions, evidence, reasoning_summary, operator_instructions, monitoring_requirements."},
        {"role": "user", "content": json.dumps(context, default=str)},
    ], temperature=0.1, response_format={"type": "json_object"})
    result = _parse_agent_result(_response_text(response), context)
    issue.analysis = result
    issue.status = "RECOMMENDATION"
    investigation = MachineAgentInvestigation(machine_code=issue.machine_code, issue_id=issue.id, context=context, result=result, model_name=response.get("model_used"), status="COMPLETED")
    session.add(investigation)
    for category in ("immediate_actions", "corrective_actions", "preventive_actions"):
        for action in result.get(category, []) or []:
            session.add(MachineRecommendation(machine_code=issue.machine_code, issue_id=issue.id, action=str(action), category=category.replace("_actions", "").upper()))
    logger.info("Completed machine agent investigation for issue %s", issue.id)


async def monitor_machine(session: AsyncSession, telemetry: Dict[str, Any]) -> None:
    machine_code = telemetry["code"]
    now = _now()
    snapshot = _snapshot(telemetry)
    operational_state = _operational_state(snapshot)
    condition = _state_from_snapshot(snapshot)
    state = (await session.execute(select(MachineMonitoringState).where(MachineMonitoringState.machine_code == machine_code))).scalars().first()
    if not state:
        state = MachineMonitoringState(machine_code=machine_code)
        session.add(state)
        await session.flush()
    await _generate_summary(session, telemetry, snapshot)
    state.operational_state = operational_state
    state.parameter_states = {key: value["status"] for key, value in snapshot["metrics"].items()}
    state.last_snapshot = snapshot
    state.last_checked_at = now

    if operational_state in {"OFFLINE", "STOPPED"}:
        state.agent_state = "MONITORING"
        state.anomaly_started_at = None
        await session.commit()
        return

    if condition in {"WARNING", "HIGH_RISK"}:
        if not state.anomaly_started_at:
            state.anomaly_started_at = now
        elapsed = (now - state.anomaly_started_at).total_seconds()
        issue = await _get_active_issue(session, machine_code)
        required = HIGH_RISK_PERSISTENCE_SECONDS if condition == "HIGH_RISK" else WARNING_PERSISTENCE_SECONDS
        if condition == "WARNING" and not issue and elapsed >= required:
            issue = await _create_issue(session, machine_code, snapshot, "WARNING", now)
        if condition == "HIGH_RISK" and elapsed >= required:
            if not issue or issue.severity != "HIGH_RISK":
                issue = await _create_issue(session, machine_code, snapshot, "HIGH_RISK", now)
            issue.persistence_seconds = elapsed
            if issue.status in {"INVESTIGATION", "RE_OCCURRENCE"} and not issue.analysis:
                summary = (await session.execute(select(MachineAISummary).where(MachineAISummary.machine_code == machine_code))).scalars().first()
                state.agent_state = "INVESTIGATING"
                await _investigate(session, issue, snapshot, summary)
            else:
                state.agent_state = "AWAITING_OPERATOR_ACTION"
        else:
            state.agent_state = "WARNING_INVESTIGATION" if condition == "WARNING" else "HIGH_RISK_INVESTIGATION"
        await session.commit()
        return

    state.anomaly_started_at = None
    issue = await _get_active_issue(session, machine_code)
    if issue and issue.status not in {"RESOLVED"}:
        if not state.recovery_started_at:
            state.recovery_started_at = now
        if (now - state.recovery_started_at).total_seconds() >= RECOVERY_VERIFICATION_SECONDS:
            issue.status = "RESOLVED"
            issue.resolved_at = now
            state.agent_state = "RESOLVED"
            state.recovery_started_at = None
        else:
            state.agent_state = "VERIFYING"
    else:
        state.agent_state = "MONITORING"
    await session.commit()


async def run_machine_monitoring_cycle() -> None:
    try:
        telemetry = await asyncio.to_thread(get_machine_telemetry)
    except InfluxTelemetryError as exc:
        logger.warning("Machine monitoring skipped because InfluxDB is unavailable: %s", exc)
        return
    except Exception:
        logger.exception("Unexpected machine telemetry failure")
        return
    async with AsyncSessionLocal() as session:
        try:
            await monitor_machine(session, telemetry)
        except Exception:
            await session.rollback()
            logger.exception("Machine monitoring cycle failed for %s", telemetry.get("code"))


async def get_machine_ai_payload(session: AsyncSession, machine_code: str) -> Dict[str, Any]:
    summary = (await session.execute(select(MachineAISummary).where(MachineAISummary.machine_code == machine_code))).scalars().first()
    state = (await session.execute(select(MachineMonitoringState).where(MachineMonitoringState.machine_code == machine_code))).scalars().first()
    issues = (await session.execute(select(MachineIssue).where(MachineIssue.machine_code == machine_code).order_by(MachineIssue.detected_at.desc()).limit(20))).scalars().all()
    issue_ids = [issue.id for issue in issues]
    recommendations = (await session.execute(select(MachineRecommendation).where(MachineRecommendation.machine_code == machine_code).order_by(MachineRecommendation.generated_at.desc()).limit(50))).scalars().all()
    investigations = (await session.execute(select(MachineAgentInvestigation).where(MachineAgentInvestigation.machine_code == machine_code).order_by(MachineAgentInvestigation.created_at.desc()).limit(20))).scalars().all()

    def issue_json(issue: MachineIssue) -> Dict[str, Any]:
        return {"id": issue.id, "title": issue.title, "severity": issue.severity, "status": issue.status, "affected_parameters": issue.affected_parameters or [], "detected_at": issue.detected_at.isoformat(), "resolved_at": issue.resolved_at.isoformat() if issue.resolved_at else None, "persistence_seconds": issue.persistence_seconds, "analysis": issue.analysis}

    return {
        "machine_code": machine_code,
        "summary": {"text": summary.summary_text, "generated_at": summary.generated_at.isoformat(), "baseline": summary.baseline_context} if summary else None,
        "state": {"operational_state": state.operational_state, "agent_state": state.agent_state, "parameter_states": state.parameter_states or {}, "last_checked_at": state.last_checked_at.isoformat()} if state else None,
        "active_issue": next((issue_json(issue) for issue in issues if issue.status != "RESOLVED"), None),
        "issues": [issue_json(issue) for issue in issues],
        "recommendations": [{"id": item.id, "issue_id": item.issue_id, "action": item.action, "category": item.category, "status": item.status, "generated_at": item.generated_at.isoformat(), "operator_action": item.operator_action, "verification": item.verification} for item in recommendations if item.issue_id in issue_ids],
        "agent_history": [{"id": item.id, "issue_id": item.issue_id, "status": item.status, "created_at": item.created_at.isoformat(), "model_name": item.model_name, "result": item.result} for item in investigations],
    }
