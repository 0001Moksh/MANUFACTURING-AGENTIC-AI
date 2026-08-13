import asyncio
import os
from concurrent.futures import ThreadPoolExecutor
from typing import Annotated, Literal, Optional
from typing_extensions import TypedDict

import pandas as pd
from sqlalchemy import text
from langchain_core.messages import AIMessage, BaseMessage, HumanMessage, SystemMessage
from langchain_core.tools import tool
from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph import START, StateGraph
from langgraph.graph.message import add_messages
from langgraph.prebuilt import ToolNode
from langchain_litellm import ChatLiteLLM

from app.db import AlertMaster, MachineMaster, WorkOrder, sync_mes_engine


SYSTEM_PROMPT = """You are Deva, a Smart IIoT Maintenance Assistant.
Address the user as 'sir'.

Use the available tools to answer questions about:
- machine health status
- predictive maintenance schedules / windows
- maintenance-related work orders
- unresolved alerts and breakdowns

If the user asks for a chart or visualization, you should still answer using the same tools, then provide a concise summary.
For machine health or work order questions, use the database tools to fetch live data before responding.
Keep replies concise, practical, and operational.
"""


class MaintenanceState(TypedDict):
    messages: Annotated[list, add_messages]


_executor = ThreadPoolExecutor(max_workers=4)


def _execute_query(query: str, params: dict = None) -> str:
    if sync_mes_engine is None:
        return "Error: Database session is unavailable."
    try:
        with sync_mes_engine.connect() as connection:
            result = connection.execute(text(query), params or {})
            rows = result.mappings().all()
            if not rows:
                return "No matching records found."
            return pd.DataFrame(rows).head(50).to_json(orient="records", date_format="iso", indent=2)
    except Exception as e:
        return f"Database Error: {str(e)}"


@tool
def get_machine_status(machine_code: Optional[str] = None, status: Optional[str] = None) -> str:
    """Fetch active machine status records, optionally filtered by machine code or status."""
    query = "SELECT TOP 50 MachineId, MachineCode, MachineName, MachineType, Status, CapacityPerHour FROM dbo.MachineMaster WHERE IsActive = 1"
    params = {}
    if machine_code:
        query += " AND MachineCode = :code"
        params["code"] = machine_code
    if status:
        query += " AND LOWER(Status) = LOWER(:status)"
        params["status"] = status
    return _execute_query(query, params)


@tool
def get_maintenance_windows(status: Optional[str] = None) -> str:
    """Fetch maintenance-related work orders and schedules, optionally filtered by status."""
    query = "SELECT TOP 50 * FROM dbo.WorkOrder WHERE 1=1"
    params = {}
    if status:
        query += " AND LOWER(Status) = LOWER(:status)"
        params["status"] = status
    query += " ORDER BY CreatedDate DESC"
    return _execute_query(query, params)


@tool
def get_active_maintenance_work_orders() -> str:
    """Fetch active maintenance work orders that need planning or execution."""
    query = """
        SELECT TOP 50 WorkOrderId, WorkOrderNumber, PlannedQty, CompletedQty, DueDate, Status, MachineId
        FROM dbo.WorkOrder
        WHERE Status IN ('Planned', 'In Progress', 'On Hold')
        ORDER BY CreatedDate DESC
    """
    return _execute_query(query)


@tool
def get_work_order_by_number(work_order_number: str) -> str:
    """Fetch a single work order by work order number."""
    query = "SELECT TOP 50 * FROM dbo.WorkOrder WHERE WorkOrderNumber = :wo"
    return _execute_query(query, {"wo": work_order_number})


@tool
def get_unresolved_alerts() -> str:
    """Fetch unresolved alerts tied to maintenance, safety, or operational issues."""
    query = """
        SELECT TOP 50 AlertId, AlertType, Severity, Title, Message, Source, MachineId, WorkOrderId, CreatedDate
        FROM dbo.AlertMaster
        WHERE IsResolved = 0
        ORDER BY CreatedDate DESC
    """
    return _execute_query(query)


@tool
def get_machine_health_summary() -> str:
    """Fetch a prioritized machine health summary for the current active fleet."""
    query = """
        SELECT TOP 50 MachineId, MachineCode, MachineName, MachineType, Status, CapacityPerHour
        FROM dbo.MachineMaster
        WHERE IsActive = 1
        ORDER BY CASE WHEN LOWER(Status) = 'maintenance' THEN 0
                      WHEN LOWER(Status) = 'offline' THEN 1
                      WHEN LOWER(Status) = 'idle' THEN 2
                      ELSE 3 END, MachineCode
    """
    return _execute_query(query)


mes_tools = [
    get_machine_status,
    get_machine_health_summary,
    get_maintenance_windows,
    get_active_maintenance_work_orders,
    get_work_order_by_number,
    get_unresolved_alerts,
]


GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GROQ_API_KEY = os.getenv("GROQ_API_KEY")

orchestrator_llm_primary = ChatLiteLLM(
    model="gemini/gemini-3.5-flash-lite",
    api_key=GEMINI_API_KEY,
    temperature=0,
)

orchestrator_llm_fallback = ChatLiteLLM(
    model="groq/llama-3.3-70b-versatile",
    api_key=GROQ_API_KEY,
    temperature=0,
)


def invoke_with_fallback(primary_llm, fallback_llm, messages: list, tools=None):
    llm_primary = primary_llm.bind_tools(tools) if tools else primary_llm
    llm_fallback = fallback_llm.bind_tools(tools) if tools else fallback_llm
    try:
        return llm_primary.invoke(messages)
    except Exception:
        return llm_fallback.invoke(messages)


def agent_node(state: MaintenanceState):
    messages = state["messages"]
    if not any(isinstance(m, SystemMessage) for m in messages):
        messages = [SystemMessage(content=SYSTEM_PROMPT)] + messages
    response = invoke_with_fallback(
        orchestrator_llm_primary,
        orchestrator_llm_fallback,
        messages,
        tools=mes_tools,
    )
    return {"messages": [response]}


def route_tools(state: MaintenanceState) -> Literal["tools", "__end__"]:
    last_message = state["messages"][-1]
    if getattr(last_message, "tool_calls", None):
        return "tools"
    return "__end__"


workflow = StateGraph(MaintenanceState)
workflow.add_node("agent", agent_node)
workflow.add_node("tools", ToolNode(mes_tools))
workflow.add_edge(START, "agent")
workflow.add_conditional_edges("agent", route_tools)
workflow.add_edge("tools", "agent")

memory = MemorySaver()
deva_maintenance_agent = workflow.compile(checkpointer=memory)


async def run_maintenance_conversation(message: str, thread_id: Optional[str] = None) -> dict:
    config = {"configurable": {"thread_id": thread_id or "maintenance-default"}}
    final_state = await asyncio.to_thread(
        lambda: deva_maintenance_agent.invoke(
            {"messages": [HumanMessage(content=message)]},
            config=config,
        )
    )

    final_text = ""
    for msg in final_state.get("messages", []):
        if isinstance(msg, AIMessage) and msg.content:
            final_text = msg.content

    return {
        "reply": final_text or "I could not generate a maintenance response.",
        "visuals": [],
    }
