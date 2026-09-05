import json
import logging
from typing import Any, Dict, List

from sqlalchemy import text

from app.llm_gateway import execute_completion
from app.guardrails_firewall import validate_query_safety
from app.db import get_va_db, get_db

logger = logging.getLogger("summary_agent_runner")


async def _exec_sql_on_va(query: str) -> str:
    # Validate query safety
    if not validate_query_safety(query):
        return "ERROR: Query blocked by guardrails."
    try:
        async for session in get_va_db():
            res = await session.execute(text(query))
            rows = res.fetchall()
            # Normalize
            out = []
            for r in rows:
                try:
                    out.append({k: (v.isoformat() if hasattr(v, 'isoformat') else v) for k, v in dict(r).items()})
                except Exception:
                    out.append(dict(r))
            return json.dumps(out, default=str)
    except Exception as e:
        logger.exception("VA SQL execution failed")
        return f"ERROR: {str(e)}"


async def _exec_sql_on_platform(query: str, db_session_generator) -> str:
    if not validate_query_safety(query):
        return "ERROR: Query blocked by guardrails."
    try:
        async for session in db_session_generator():
            res = await session.execute(text(query))
            rows = res.fetchall()
            out = []
            for r in rows:
                try:
                    out.append({k: (v.isoformat() if hasattr(v, 'isoformat') else v) for k, v in dict(r).items()})
                except Exception:
                    out.append(dict(r))
            return json.dumps(out, default=str)
    except Exception as e:
        logger.exception("Platform SQL execution failed")
        return f"ERROR: {str(e)}"


async def run_summary_agent(
    test_name: str,
    input_type: str,
    length: str,
    language: str,
    metadata: Dict[str, Any],
    max_iterations: int = 3,
) -> Dict[str, Any]:
    """Run a simplified LangGraph-style loop:
    - send prompt to LLM
    - if LLM returns structured JSON with `tool_calls`, execute them and re-call LLM
    - return final summary and tool call logs
    """
    system_prompt = (
        "You are an analytics dashboard assistant. When you need database data, return JSON with a 'tool_calls' list. "
        "Each tool_call entry should be {\"name\": string, \"args\": {\"query_string\": string}}.\n"
        "Otherwise return the final markdown summary as plain text."
    )

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": json.dumps({"test_name": test_name, "input_type": input_type, "length": length, "language": language, "metadata": metadata}, default=str)}
    ]

    tool_logs: List[Dict[str, Any]] = []
    last_text = None

    for iteration in range(max_iterations):
        resp = await execute_completion(messages, model="auto", temperature=0.2)
        text = resp.get("text") if isinstance(resp, dict) else str(resp)
        last_text = text

        # Try to parse JSON from text
        parsed = None
        try:
            parsed = json.loads(text)
        except Exception:
            parsed = None

        if parsed and isinstance(parsed, dict) and parsed.get("tool_calls"):
            # Execute tool calls sequentially
            for tc in parsed.get("tool_calls", []):
                name = tc.get("name")
                args = tc.get("args", {}) or {}
                query = args.get("query_string") or args.get("sql")
                result_text = ""
                if not query:
                    result_text = "ERROR: no query provided"
                else:
                    # Choose target DB heuristically
                    if name and name.lower().startswith("get_") and any(k in name.lower() for k in ("alert", "incident", "hse", "anomaly", "zone", "camera")):
                        result_text = await _exec_sql_on_va(query)
                    else:
                        # Default to platform DB
                        result_text = await _exec_sql_on_platform(query, get_db)

                tool_logs.append({"tool": name, "query": query, "result_preview": (result_text[:1000] + "..." if len(result_text) > 1000 else result_text)})
                # Append tool result for LLM context
                messages.append({"role": "tool", "content": json.dumps({"tool": name, "result": result_text})})
            # Continue loop to ask LLM to synthesize with tool results
            continue

        # No tool calls — assume final summary
        return {"summary_text": last_text, "tool_logs": tool_logs}

    # Max iterations reached — return last text
    return {"summary_text": last_text or "", "tool_logs": tool_logs}
