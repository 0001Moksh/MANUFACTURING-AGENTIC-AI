import json
import logging
import os
from datetime import datetime
from typing import Any, Dict, Optional

from app.llm_gateway import execute_completion
from app.db import get_va_db
from app.agents.summary_agent_runner import run_summary_agent

logger = logging.getLogger("insights_summary_agent")


async def _fetch_va_snapshots(chart_id: str) -> Dict[str, Any]:
    """Attempt to fetch supporting rows from Video Analytics DB for richer context.
    Returns dict or empty if VA DB not configured.
    """
    try:
        async for session in get_va_db():
            # simple heuristic queries — adapt as needed for schema
            try:
                q = "SELECT id, camera_id, zone_id, class_name, confidence, created_at FROM alerts WHERE chart_id = :chart_id ORDER BY created_at DESC LIMIT 20"
                res = await session.execute(q, {"chart_id": chart_id})
                rows = res.fetchall()
                # convert to serializable form
                data = []
                for r in rows:
                    data.append({k: (v.isoformat() if hasattr(v, 'isoformat') else v) for k, v in dict(r).items()})
                return {"alerts": data}
            except Exception:
                # not fatal — just return empty
                return {}
    except Exception:
        return {}


async def generate_chart_summary(
    test_name: str,
    input_type: str,  # 'metadata' or 'image_text'
    length: str,  # 'short' | 'medium' | 'long'
    language: str,  # 'english' | 'hindi' | 'hinglish'
    metadata_payload: dict,
    image_file: bytes = None,
) -> Dict[str, Any]:
    """
    Generate a chart summary using the platform LLM gateway with provider fallbacks.

    Returns a dict matching the DB storage schema: summary_text, language, summary_length, metadata_snapshot, created_at
    """
    # Normalize inputs
    lang_map = {
        "english": "English",
        "hindi": "Hindi",
        "hinglish": "Hinglish",
    }
    length_map = {"short": "Short", "medium": "Medium", "long": "Long"}

    human_lang = lang_map.get(language.lower(), "English") if isinstance(language, str) else "English"
    human_len = length_map.get(length.lower(), "Medium") if isinstance(length, str) else "Medium"

    chart_id = metadata_payload.get("chart_id") or metadata_payload.get("id") or metadata_payload.get("chartId")

    # try to enrich with VA snapshots if possible
    va_context = {}
    if chart_id:
        try:
            va_context = await _fetch_va_snapshots(chart_id)
        except Exception:
            logger.debug("VA enrichment failed", exc_info=True)

    # Build prompt
    system_prompt = (
        "You are an enterprise analytics assistant. Produce a concise, professional markdown summary of the provided chart metadata and any supplemental telemetry. "
        "Do not use emojis. Use the requested language and length instructions. Include bullets and short recommendations when appropriate."
    )

    user_payload = {
        "test_name": test_name,
        "input_type": input_type,
        "length": human_len,
        "language": human_lang,
        "metadata": metadata_payload,
        "va_context": va_context,
    }

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": json.dumps(user_payload, default=str)},
    ]

    # Use the structured runner which can perform tool calls similar to the notebook's LangGraph flow
    try:
        runner_res = await run_summary_agent(
            test_name=test_name,
            input_type=input_type,
            length=human_len,
            language=human_lang,
            metadata=metadata_payload,
        )
        summary_text = runner_res.get("summary_text") or ""
        tool_logs = runner_res.get("tool_logs", [])
    except Exception as e:
        logger.exception("Runner failed")
        summary_text = f"ERROR: Runner failed: {str(e)}"
        tool_logs = []

    result = {
        "summary_text": summary_text,
        "language": human_lang,
        "summary_length": human_len,
        "metadata_snapshot": {**metadata_payload, "va_context_sample": va_context, "tool_logs": tool_logs},
        "created_at": datetime.utcnow().isoformat() + "Z",
    }

    return result
