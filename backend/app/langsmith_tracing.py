"""Shared LangSmith configuration for agent-level traces."""

import os
from typing import Any, Callable

from langsmith import traceable


def trace_agent(agent_name: str) -> Callable[[Any], Any]:
    """Create a named root trace while respecting LangSmith environment settings."""
    return traceable(
        name=agent_name,
        run_type="chain",
        tags=["agent", agent_name],
        metadata={"agent_name": agent_name},
    )


def graph_trace_config(agent_name: str, thread_id: str) -> dict[str, Any]:
    """Build the LangGraph config used to group child runs under an agent trace."""
    return {
        "configurable": {"thread_id": thread_id},
        "run_name": agent_name,
        "tags": ["agent", agent_name],
        "metadata": {
            "agent_name": agent_name,
            "langsmith_project": os.getenv("LANGSMITH_PROJECT", ""),
        },
    }
