"""Shared LangSmith configuration for agent-level traces."""

import os
from typing import Any, Callable

from langsmith import traceable


def trace_agent(agent_name: str) -> Callable[[Any], Any]:
    """Create a named root trace while respecting LangSmith environment settings."""
    is_use_case = agent_name.lower().endswith(" usecase")
    tags = ["agent", agent_name]
    metadata = {
        "agent_name": agent_name,
        "langsmith_project": os.getenv("LANGSMITH_PROJECT", ""),
    }
    if is_use_case:
        tags.append("use-case")
        metadata["use_case"] = agent_name
    return traceable(
        name=agent_name,
        run_type="chain",
        tags=tags,
        metadata=metadata,
    )


def graph_trace_config(
    agent_name: str,
    thread_id: str,
    *,
    use_case_name: str | None = None,
    application: str | None = None,
    graph_name: str | None = None,
    extra_tags: list[str] | None = None,
) -> dict[str, Any]:
    """Build a LangGraph config with optional filterable use-case context."""
    config = {
        "configurable": {"thread_id": thread_id},
        "run_name": agent_name,
        "tags": ["agent", agent_name],
        "metadata": {
            "agent_name": agent_name,
            "langsmith_project": os.getenv("LANGSMITH_PROJECT", ""),
        },
    }
    if use_case_name:
        config["metadata"].update({
            "use_case": use_case_name,
            "application": application or agent_name,
            "graph": graph_name or agent_name,
            "thread_id": thread_id,
        })
    for tag in extra_tags or []:
        if tag not in config["tags"]:
            config["tags"].append(tag)
    return config
