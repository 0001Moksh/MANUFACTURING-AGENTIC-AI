"""Maintenance Agent wrapper
Provides a thin wrapper to run the existing LangGraph workflow with a
maintenance-focused system prompt so the same compiled graph can be reused
while tailoring behavior to maintenance use-cases.
"""
from typing import Optional
from app.agents.agent_workflow import run_agent_workflow


MAINTENANCE_PROMPT_PREFIX = (
    "You are Deva, the Maintenance Assistant. "
    "Focus on machine health, maintenance windows, predictive alerts, "
    "and propose safe, read-only SQL queries to fetch required data. "
    "When a write action is required, mark the response as requiring human approval. "
)


async def run_maintenance_workflow(query: str, is_approved: bool = False) -> dict:
    """Run the shared LangGraph workflow with a maintenance-focused prompt.

    This keeps server-side logic small and reuses the existing compiled
    workflow in `agent_workflow.py` while steering model output toward
    maintenance tasks.
    """
    prefixed = MAINTENANCE_PROMPT_PREFIX + "\nUser Query: " + (query or "")
    return await run_agent_workflow(prefixed, is_approved=is_approved)
