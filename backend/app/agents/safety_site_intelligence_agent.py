"""
Safety & Site Intelligence Multi-Agent Orchestrator — Deva (HSE & Quality Officer Assistant)
Created by Moksh Bhardwaj.

Unifies:
1. Safety & Quality Agent (80 specialized SQL tools)
2. PPE & Behavior Vision Agent (55 specialized Vision SQL tools)
Total: 135 specialized read-only tools across industrial site safety & quality.

LangGraph ReAct Multi-Agent with LiteLLM Gateway (Gemini primary / Groq fallback)
and MemorySaver multi-turn context.
"""
import asyncio
import os
from typing import Annotated, Literal, Optional

from langchain_core.messages import AIMessage, HumanMessage, SystemMessage
from langchain_litellm import ChatLiteLLM
from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph import START, StateGraph
from langgraph.graph.message import add_messages
from langgraph.prebuilt import ToolNode
from typing_extensions import TypedDict

# Import tools from both specialized sub-agents
from app.agents.safety_quality_agent import quality_inspection_tools
from app.agents.ppe_vision_agent import hse_vision_tools

# Combine all 135 specialized tools
# Use dict by tool name to prevent any accidental duplicate registrations
_tools_by_name = {}
for t in quality_inspection_tools + hse_vision_tools:
    _tools_by_name[t.name] = t

safety_site_intelligence_tools = list(_tools_by_name.values())

print(f"[Multi-Agent] Registered {len(safety_site_intelligence_tools)} combined Safety & Site Intelligence tools into LangGraph ToolNode.")

# ── Multi-Agent System Prompt ────────────────────────────────────────────────
SYSTEM_PROMPT = """You are Deva, the Safety & Site Intelligence Multi-Agent (HSE & Quality Officer Assistant) created by Moksh Bhardwaj.
Address the user as 'sir'.

You are the unified orchestrator over TWO specialized industrial intelligence domains:
1. PPE & Behavior Vision Intelligence: 55 tools monitoring CCTV cameras, hard hat/safety vest compliance, restricted hazard zone geofencing, worker fatigue, collapse incidents, camera health, and shift analytics.
2. Safety & Quality Intelligence: 80 tools monitoring quality audits, material defect analytics, concrete/welding tests, quality holds, vendor/subcontractor compliance, tolerance rules, and HSE standards.

Your core guidelines:
1. Automatically query the appropriate database tools whenever the user asks for violation logs, material inspections, CCTV anomalies, or site risk analytics.
2. If a query spans both PPE and quality inspection (e.g. site health check), execute tools across both domains and present a unified summary.
3. Present all data in clean, scannable Markdown tables with key highlights.
4. For general operational questions, answer directly and candidly in 1-2 concise lines. Keep all responses strictly brief, precise, professional, and to the point.
"""

# ── LiteLLM Gateway ──────────────────────────────────────────────────────────
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GROQ_API_KEY = os.getenv("GROQ_API_KEY")

_llm_primary = ChatLiteLLM(
    model="gemini/gemini-3.5-flash-lite",
    api_key=GEMINI_API_KEY,
    temperature=0,
)

_llm_fallback = ChatLiteLLM(
    model="groq/llama-3.3-70b-versatile",
    api_key=GROQ_API_KEY,
    temperature=0,
)


def _invoke_with_fallback(messages: list, tools=None):
    """LiteLLM Gateway: try Gemini 3.5 Flash Lite, fall back to Groq LLaMA 3.3 on any error."""
    primary = _llm_primary.bind_tools(tools) if tools else _llm_primary
    fallback = _llm_fallback.bind_tools(tools) if tools else _llm_fallback
    try:
        return primary.invoke(messages)
    except Exception as primary_err:
        print(f"[Safety & Site Multi-Agent GATEWAY] Primary failed: {str(primary_err)[:120]} -- switching to Groq.")
        return fallback.invoke(messages)


class SafetySiteIntelligenceState(TypedDict):
    messages: Annotated[list, add_messages]


def _agent_node(state: SafetySiteIntelligenceState):
    messages = state["messages"]
    if not any(isinstance(m, SystemMessage) for m in messages):
        messages = [SystemMessage(content=SYSTEM_PROMPT)] + messages
    response = _invoke_with_fallback(messages, tools=safety_site_intelligence_tools)
    return {"messages": [response]}


def _route_tools(state: SafetySiteIntelligenceState) -> Literal["tools", "__end__"]:
    last = state["messages"][-1]
    if getattr(last, "tool_calls", None):
        return "tools"
    return "__end__"


# ── Build LangGraph Graph ───────────────────────────────────────────────────
_workflow = StateGraph(SafetySiteIntelligenceState)
_workflow.add_node("agent", _agent_node)
_workflow.add_node("tools", ToolNode(safety_site_intelligence_tools))
_workflow.add_edge(START, "agent")
_workflow.add_conditional_edges("agent", _route_tools)
_workflow.add_edge("tools", "agent")

_memory = MemorySaver()
deva_safety_site_intelligence_agent = _workflow.compile(checkpointer=_memory)

print("[Multi-Agent] Deva Safety & Site Intelligence Multi-Agent Graph compiled successfully.")


# ── Public API ───────────────────────────────────────────────────────────────
async def run_safety_site_intelligence_conversation(message: str, thread_id: Optional[str] = None) -> dict:
    """Async entry-point for FastAPI endpoint."""
    config = {"configurable": {"thread_id": thread_id or "safety-site-intel-default"}}
    final_state = await asyncio.to_thread(
        lambda: deva_safety_site_intelligence_agent.invoke(
            {"messages": [HumanMessage(content=message)]},
            config=config,
        )
    )
    reply = ""
    for msg in final_state.get("messages", []):
        if isinstance(msg, AIMessage) and msg.content:
            reply = msg.content
    return {
        "reply": reply or "I could not generate a response at this time, sir.",
        "thread_id": thread_id or "safety-site-intel-default",
    }
