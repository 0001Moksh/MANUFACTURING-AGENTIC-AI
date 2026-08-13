import asyncio
import json
from typing import Any, AsyncGenerator, Dict

from app.agents import agent_workflow


MAINTENANCE_PREFIX = (
    "You are Deva, the Maintenance Assistant. "
    "Focus on machine health, maintenance windows, predictive alerts, and propose safe, read-only SQL queries to fetch required data. "
)


async def stream_maintenance(query: str, config: Dict[str, Any] = None) -> AsyncGenerator[Dict[str, Any], None]:
    """Stream maintenance workflow events.

    Tries to use the compiled LangGraph `app.stream` if available to yield events
    as they are produced. If streaming is not supported, falls back to running
    `run_agent_workflow` and yields a single completion event.
    """
    prefixed = MAINTENANCE_PREFIX + "\nUser Query: " + (query or "")

    # If compiled graph exposes `stream`, use it
    try:
        compiled_app = getattr(agent_workflow, "app", None)
        if compiled_app and hasattr(compiled_app, "stream"):
            # The compiled app's stream may be synchronous generator or async.
            stream = compiled_app.stream({"prompt": prefixed}, config=config or {}, stream_mode="values")
            # If stream is async generator
            if hasattr(stream, "__aiter__"):
                async for ev in stream:
                    yield ev
                return
            # Otherwise iterate synchronously in thread executor
            for ev in stream:
                yield ev
            return
    except Exception:
        # If streaming fails, fall back to single-run
        pass

    # Fallback: run full workflow and yield final state
    final = await agent_workflow.run_agent_workflow(prefixed, is_approved=False)
    yield {"messages": [{"type": "ai", "content": final.get("insights", "" )}], "final": final}
