"""LangGraph-backed Deva assistant for the authenticated web voice console."""

import ast
import json
import operator
import os
from datetime import datetime
from zoneinfo import ZoneInfo

import litellm
from dotenv import load_dotenv
from langchain_core.messages import AIMessage, HumanMessage, ToolMessage
from langchain_core.tools import tool
from langchain_core.utils.function_calling import convert_to_openai_tool
from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph import END, START, MessagesState, StateGraph
from langgraph.prebuilt import ToolNode

load_dotenv()
litellm.suppress_debug_info = True
litellm.set_verbose = False

_ALLOWED_BINARY = {
    ast.Add: operator.add,
    ast.Sub: operator.sub,
    ast.Mult: operator.mul,
    ast.Div: operator.truediv,
    ast.FloorDiv: operator.floordiv,
    ast.Mod: operator.mod,
    ast.Pow: operator.pow,
}
_ALLOWED_UNARY = {ast.UAdd: operator.pos, ast.USub: operator.neg}
_SYSTEM_PROMPT = """You are Deva, a friendly, concise multilingual assistant for manufacturing operations.
Reply naturally in the user's language: Hindi, Hinglish, or English. Understand Devanagari and Hindi written in Latin transliteration.
Use the calculator for arithmetic, local_time for time requests, assistant_capabilities for capability questions, and query_manufacturing_agent for plant operations, safety, camera, maintenance, or production questions.
Keep spoken replies concise and avoid markdown tables. Never claim that live plant data is available unless the manufacturing agent tool returns it."""


class VoiceAgentUnavailableError(RuntimeError):
    """Raised when no configured LLM provider can handle a request."""


def _safe_arithmetic(node: ast.AST) -> int | float:
    if isinstance(node, ast.Constant) and type(node.value) in (int, float):
        return node.value
    if isinstance(node, ast.BinOp) and type(node.op) in _ALLOWED_BINARY:
        right = _safe_arithmetic(node.right)
        if isinstance(node.op, ast.Pow) and abs(right) > 8:
            raise ValueError("Exponent is limited to 8.")
        value = _ALLOWED_BINARY[type(node.op)](_safe_arithmetic(node.left), right)
        if abs(value) > 10**15:
            raise ValueError("Result is too large.")
        return value
    if isinstance(node, ast.UnaryOp) and type(node.op) in _ALLOWED_UNARY:
        return _ALLOWED_UNARY[type(node.op)](_safe_arithmetic(node.operand))
    raise ValueError("Only basic arithmetic with numbers and parentheses is allowed.")


@tool
def calculate(expression: str) -> str:
    """Safely calculate arithmetic such as (12 + 8) * 3."""
    if len(expression) > 200:
        raise ValueError("Expression is too long.")
    return str(_safe_arithmetic(ast.parse(expression, mode="eval").body))


@tool
def local_time(timezone_name: str = "Asia/Kolkata") -> str:
    """Get the current local time in a named timezone; defaults to India."""
    try:
        current = datetime.now(ZoneInfo(timezone_name))
    except (KeyError, ValueError) as exc:
        raise ValueError(f"Unknown timezone: {timezone_name}") from exc
    return current.strftime("%A, %d %B %Y, %I:%M %p %Z")


@tool
def assistant_capabilities() -> str:
    """Describe what Deva can do in this application."""
    return (
        "I can converse in Hindi, Hinglish, and English; calculate arithmetic; tell local time; "
        "and route manufacturing, safety, camera, maintenance, and production questions to the "
        "connected MAI agents."
    )


@tool
async def query_manufacturing_agent(query: str) -> str:
    """Query connected MAI manufacturing, camera, safety, maintenance, or production agents for live data."""
    from app.voice.agent_router import execute_agent_query

    result = await execute_agent_query(query, agent_id="auto")
    return json.dumps(result, ensure_ascii=False)


_TOOLS = [calculate, local_time, assistant_capabilities, query_manufacturing_agent]
_TOOL_NODE = ToolNode(_TOOLS)
_OPENAI_TOOLS = [convert_to_openai_tool(item) for item in _TOOLS]
_MEMORY = MemorySaver()


def _model_chain() -> list[str]:
    gemini_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
    groq_key = os.getenv("GROQ_API_KEY")
    models: list[str] = []
    if gemini_key:
        models.append("gemini/gemini-2.5-flash")
    if groq_key:
        models.extend(["groq/llama-3.3-70b-versatile", "groq/openai/gpt-oss-20b"])
    if not models:
        raise VoiceAgentUnavailableError(
            "No voice-agent model is configured. Set GEMINI_API_KEY or GROQ_API_KEY in the backend environment."
        )
    return models


def _to_litellm_messages(history: list) -> list[dict]:
    messages: list[dict] = [{"role": "system", "content": _SYSTEM_PROMPT}]
    for item in history:
        if isinstance(item, HumanMessage):
            messages.append({"role": "user", "content": item.content})
        elif isinstance(item, AIMessage):
            message: dict = {"role": "assistant", "content": item.content or None}
            if item.tool_calls:
                message["tool_calls"] = [
                    {
                        "id": call["id"],
                        "type": "function",
                        "function": {
                            "name": call["name"],
                            "arguments": json.dumps(call["args"], ensure_ascii=False),
                        },
                    }
                    for call in item.tool_calls
                ]
            messages.append(message)
        elif isinstance(item, ToolMessage):
            messages.append(
                {
                    "role": "tool",
                    "tool_call_id": item.tool_call_id,
                    "content": str(item.content),
                }
            )
    return messages


async def _agent_node(state: MessagesState) -> dict:
    messages = _to_litellm_messages(state["messages"])
    errors: list[str] = []
    for model_name in _model_chain():
        try:
            response = await litellm.acompletion(
                model=model_name,
                messages=messages,
                tools=_OPENAI_TOOLS,
                tool_choice="auto",
                temperature=0.4,
                timeout=30,
                num_retries=0,
            )
            message = response.choices[0].message
            calls = []
            for call in getattr(message, "tool_calls", None) or []:
                raw_args = call.function.arguments or "{}"
                calls.append(
                    {
                        "name": call.function.name,
                        "args": json.loads(raw_args) if isinstance(raw_args, str) else raw_args,
                        "id": call.id,
                        "type": "tool_call",
                    }
                )
            return {"messages": [AIMessage(content=message.content or "", tool_calls=calls)]}
        except Exception as exc:
            errors.append(f"{model_name}: {type(exc).__name__}")
    raise VoiceAgentUnavailableError("All configured LLM providers failed: " + "; ".join(errors))


def _route_after_agent(state: MessagesState) -> str:
    last = state["messages"][-1]
    return "tools" if isinstance(last, AIMessage) and last.tool_calls else END


_builder = StateGraph(MessagesState)
_builder.add_node("agent", _agent_node)
_builder.add_node("tools", _TOOL_NODE)
_builder.add_edge(START, "agent")
_builder.add_conditional_edges("agent", _route_after_agent, {"tools": "tools", END: END})
_builder.add_edge("tools", "agent")
voice_agent_graph = _builder.compile(checkpointer=_MEMORY)


async def run_voice_agent_turn(message: str, thread_id: str) -> str:
    """Run one assistant turn, restoring prior conversation for the same thread."""
    result = await voice_agent_graph.ainvoke(
        {"messages": [HumanMessage(content=message)]},
        config={"configurable": {"thread_id": thread_id}},
    )
    return str(result["messages"][-1].content)
