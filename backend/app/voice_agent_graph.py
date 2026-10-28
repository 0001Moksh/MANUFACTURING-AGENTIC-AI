"""Deva voice assistant: LangGraph multi-agent system with a Supervisor node.

                         +--> ppe_vision ----------+
                         +--> permit_to_work ------+
  START -> supervisor ---+--> safety_quality ------+--> finalize -> END
                         +--> incident_investigation
                         +--> maintenance ---------+
                         +--> general (utils + MAI router)

- supervisor : ek LLM call, user ka sawaal padhkar plan banata hai (kaunse agent(s), kya task).
               Greeting / small talk / disabled area ho to direct spoken reply deta hai (workers skip).
- workers    : har specialist ka apna ReAct loop + apna tool set (agent module se lazy import).
               Bade tool sets me per-sawaal top-K relevant tools hi LLM ko jaate hain.
- finalize   : 1 agent => uska answer seedha; 2+ agents => ek spoken reply me merge.

Admin control: get_enabled_agents / set_enabled_agents / agent_status (JSON file me persist),
ya per-request run_voice_agent_turn(..., enabled_agents=[...]).
"""

import ast
import asyncio
import importlib
import json
import logging
import math
import operator
import os
import re
import threading
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Optional
from zoneinfo import ZoneInfo

import litellm
from dotenv import load_dotenv
from langchain_core.messages import AIMessage, HumanMessage
from langchain_core.runnables import RunnableConfig
from langchain_core.tools import tool
from langchain_core.utils.function_calling import convert_to_openai_tool
from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph import END, START, MessagesState, StateGraph
from app.agents.prompt_guardrails import blocked_prompt_response, check_prompt_injection
from app.langsmith_tracing import graph_trace_config, trace_agent

load_dotenv()
litellm.suppress_debug_info = True
litellm.set_verbose = False
log = logging.getLogger("voice.agent")

_AGENTS_PKG = os.getenv("VOICE_AGENTS_PACKAGE", "app.agents")
_MAX_TOOL_CHARS = int(os.getenv("VOICE_MAX_TOOL_CHARS", "4000"))
_MAX_TOOLS_PER_AGENT = int(os.getenv("VOICE_MAX_TOOLS", "30"))
_MAX_TOOL_ROUNDS = int(os.getenv("VOICE_MAX_TOOL_ROUNDS", "4"))
_WORKER_TIMEOUT = float(os.getenv("VOICE_WORKER_TIMEOUT", "60"))
_MAX_PARALLEL_PLAN = 3


class VoiceAgentUnavailableError(RuntimeError):
    """Raised when no configured LLM provider can handle a request."""


# =============================================================================
# 1. AGENT REGISTRY + ADMIN SETTINGS
# =============================================================================
@dataclass(frozen=True)
class AgentSpec:
    key: str
    label: str
    description: str  # supervisor ko routing ke liye
    module: Optional[str]  # None => builtin tools
    attr: Optional[str]
    keywords: tuple  # LLM fail hone par heuristic routing


AGENT_SPECS = [
    AgentSpec(
        "ppe_vision", "PPE & Behavior Vision",
        "PPE (helmet, vest) violations, incident logs, active/unresolved alerts, restricted-zone breaches, zone risk scores, "
        "camera status, HSE rules, sites/plants, shift analytics, employees attendance, visitors, patrols, notifications, AI models.",
        f"{_AGENTS_PKG}.ppe_vision_agent", "hse_vision_tools",
        ("ppe", "helmet", "vest", "violation", "alert", "camera", "zone", "restricted", "hse", "rule", "plant",
         "site", "visitor", "patrol", "attendance", "shift", "risk", "notification", "incident", "hadsa", "chetavni"),
    ),
    AgentSpec(
        "permit_to_work", "Permit-to-Work",
        "Hot work, confined space, work-at-height permit context, high-risk work, escalation guidance, "
        "correlating HSE incidents with MES work orders and maintenance windows, safety posture and shift handover.",
        f"{_AGENTS_PKG}.permit_to_work_agent", "ptw_tools",
        ("permit", "hot work", "confined", "height", "escalat", "handover", "posture", "work order", "anumati"),
    ),
    AgentSpec(
        "safety_quality", "Safety & Quality",
        "Quality inspections, defects, rejections, quality holds, vendors/suppliers/subcontractors quality, "
        "material batches, concrete tests, quality standards and rules.",
        f"{_AGENTS_PKG}.safety_quality_agent", "quality_inspection_tools",
        ("quality", "inspection", "defect", "reject", "vendor", "supplier", "subcontractor", "batch", "concrete",
         "scrap", "hold", "gunvatta", "jaanch"),
    ),
    AgentSpec(
        "incident_investigation", "Incident & Investigation",
        "Forensic safety KPIs: TRIR, LTIFR, Zero Harm Index, chemical/oil spills and leaks, workforce fatigue, "
        "shift duration violations, missed guard patrols, movement anomalies, AI tracking confidence / false positives.",
        f"{_AGENTS_PKG}.incident_investigation_agent", "incident_investigation_tools",
        ("trir", "ltifr", "zero harm", "spill", "leak", "fatigue", "anomaly", "investigat", "confidence",
         "false positive", "heat", "thakan", "rissav"),
    ),
    AgentSpec(
        "maintenance", "Maintenance",
        "Total and active machine fleet counts, machine health and status, maintenance work orders and schedules, "
        "unresolved MES alerts and breakdowns.",
        f"{_AGENTS_PKG}.maintenance_agent", "mes_tools",
        ("machine", "मशीन", "maintenance", "breakdown", "mes", "downtime", "marammat", "kharab"),
    ),
    AgentSpec(
        "general", "General assistant",
        "Arithmetic, local time, questions about what Deva can do, and other plant/production questions "
        "that no specialist covers (via the connected MAI agents).",
        None, None,
        ("calculate", "time", "production", "capabilit", "kya kar sakte"),
    ),
]
AGENTS = {s.key: s for s in AGENT_SPECS}
AGENT_KEYS = [s.key for s in AGENT_SPECS]


def _normalize(keys) -> list[str]:
    wanted = set(keys or [])
    return [k for k in AGENT_KEYS if k in wanted]


_SETTINGS_FILE = Path(os.getenv("VOICE_AGENTS_FILE", str(Path(__file__).with_name("voice_agents.json"))))
_settings_lock = threading.Lock()


def _load_enabled() -> list[str]:
    try:
        data = json.loads(_SETTINGS_FILE.read_text(encoding="utf-8"))
        if isinstance(data.get("enabled"), list):
            return _normalize(data["enabled"])
    except FileNotFoundError:
        pass
    except Exception as exc:
        log.warning("voice agents settings unreadable (%s); using defaults", exc)
    env = os.getenv("VOICE_ENABLED_AGENTS")
    return _normalize(env.split(",")) if env else list(AGENT_KEYS)


_enabled: list[str] = _load_enabled()


def get_enabled_agents() -> list[str]:
    with _settings_lock:
        return list(_enabled)


def set_enabled_agents(keys) -> list[str]:
    """Admin settings update (persist hota hai). Unknown key par ValueError."""
    keys = list(keys)
    unknown = sorted(set(keys) - set(AGENT_KEYS))
    if unknown:
        raise ValueError(f"Unknown agent keys: {', '.join(unknown)}")
    clean = _normalize(keys)
    with _settings_lock:
        global _enabled
        _enabled = clean
        tmp = _SETTINGS_FILE.with_suffix(".tmp")
        tmp.write_text(json.dumps({"enabled": clean}, indent=2), encoding="utf-8")
        tmp.replace(_SETTINGS_FILE)
    return list(clean)


def agent_status() -> list[dict]:
    """Frontend/API ke liye: har agent ka label, enabled state, load status."""
    on = set(get_enabled_agents())
    return [
        {
            "key": s.key,
            "label": s.label,
            "description": s.description,
            "enabled": s.key in on,
            "tool_count": len(_TOOL_CACHE[s.key]) if s.key in _TOOL_CACHE else None,
            "load_error": _LOAD_ERRORS.get(s.key),
        }
        for s in AGENT_SPECS
    ]


def _resolve_enabled(config: Optional[RunnableConfig]) -> list[str]:
    override = ((config or {}).get("configurable") or {}).get("enabled_agents")
    return _normalize(override) if override is not None else get_enabled_agents()


# =============================================================================
# 2. BUILTIN TOOLS (general agent)
# =============================================================================
_ALLOWED_BINARY = {
    ast.Add: operator.add, ast.Sub: operator.sub, ast.Mult: operator.mul, ast.Div: operator.truediv,
    ast.FloorDiv: operator.floordiv, ast.Mod: operator.mod, ast.Pow: operator.pow,
}
_ALLOWED_UNARY = {ast.UAdd: operator.pos, ast.USub: operator.neg}


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
    """Describe what Deva can currently do, based on the specialist agents enabled by the admin."""
    areas = [AGENTS[k].label for k in get_enabled_agents() if k != "general"]
    base = "I can converse in Hindi, Hinglish and English, calculate arithmetic and tell local time."
    if not areas:
        return base + " No plant data agents are currently enabled."
    return base + " Enabled specialist agents: " + ", ".join(areas) + "."


@tool
async def query_manufacturing_agent(query: str) -> str:
    """Query connected MAI manufacturing, maintenance or production agents for live data not covered by other tools."""
    from app.voice.agent_router import execute_agent_query

    result = await execute_agent_query(query, agent_id="auto")
    return json.dumps(result, ensure_ascii=False)


_BUILTIN_TOOLS = {"general": [calculate, local_time, assistant_capabilities, query_manufacturing_agent]}

# =============================================================================
# 3. LAZY TOOL LOADING, TOOL SELECTION, SCHEMAS
# =============================================================================
_TOOL_CACHE: dict[str, list] = {}
_LOAD_ERRORS: dict[str, str] = {}
_load_lock = threading.RLock()


def _load_tools(key: str) -> list:
    """Blocking (pehli baar agent module import + DB connect). asyncio.to_thread se call karo."""
    with _load_lock:
        if key in _TOOL_CACHE:
            return _TOOL_CACHE[key]
        if key in _BUILTIN_TOOLS:
            _TOOL_CACHE[key] = list(_BUILTIN_TOOLS[key])
            return _TOOL_CACHE[key]
        spec = AGENTS[key]
        try:
            module = importlib.import_module(spec.module)
            tools = list(getattr(module, spec.attr))
            _LOAD_ERRORS.pop(key, None)
            log.info("Loaded %d tools for agent '%s'", len(tools), key)
        except Exception as exc:
            _LOAD_ERRORS[key] = f"{type(exc).__name__}: {exc}"
            log.error("Agent '%s' tools failed to load: %s", key, exc)
            tools = []
        _TOOL_CACHE[key] = tools
        return tools


def reload_agent_tools(key: Optional[str] = None) -> None:
    """Failed import dobara try karne ke liye."""
    with _load_lock:
        for k in [key] if key else list(_TOOL_CACHE):
            if k not in _BUILTIN_TOOLS:
                _TOOL_CACHE.pop(k, None)
                _LOAD_ERRORS.pop(k, None)
        _INDEX_CACHE.clear()


_STOP = {
    "the", "a", "an", "is", "are", "was", "were", "of", "for", "to", "in", "on", "at", "by", "and", "or", "me", "my",
    "show", "give", "tell", "list", "what", "which", "who", "how", "many", "much", "all", "any", "this", "that",
    "with", "from", "about", "please", "can", "you", "get", "fetch", "ka", "ki", "ke", "hai", "hain", "ho", "kya",
    "kitne", "kitna", "kitni", "batao", "bata", "dikhao", "mujhe", "mera", "meri", "aur", "se", "mein", "me", "par",
}
_SYNONYMS = {
    "suraksha": "safety", "hadsa": "incident", "durghatna": "incident", "karmchari": "employee", "mazdoor": "worker",
    "kharab": "breakdown", "marammat": "maintenance", "gunvatta": "quality", "jaanch": "inspection", "aaj": "today",
    "kal": "yesterday", "hafta": "week", "mahina": "month", "chetavni": "alert", "khatra": "risk", "kshetra": "zone",
    "anumati": "permit", "ulanghan": "violation", "rissav": "leak", "gira": "spill", "thakan": "fatigue",
    "mashin": "machine", "jacket": "vest", "sthiti": "status",
}
_INDEX_CACHE: dict[tuple, dict] = {}


def _tokens(text: str) -> list[str]:
    out = []
    for w in re.findall(r"[a-z0-9]+", (text or "").lower()):
        w = _SYNONYMS.get(w, w)
        if w in _STOP or len(w) < 2:
            continue
        if len(w) > 3 and w.endswith("s") and not w.endswith("ss"):
            w = w[:-1]
        out.append(w)
    return out


def _select_tools(pool: list, query: str, k: int) -> list:
    """Pool me se query ke liye top-k tools (name match ka weight 2x, description ka 1x, IDF weighted)."""
    if len(pool) <= k:
        return list(pool)
    key = tuple(id(t) for t in pool)
    index = _INDEX_CACHE.get(key)
    if index is None:
        entries, df = [], {}
        for t in pool:
            name_tok = set(_tokens(t.name.replace("_", " ")))
            desc_tok = set(_tokens(t.description or "")) - name_tok
            for tok in name_tok | desc_tok:
                df[tok] = df.get(tok, 0) + 1
            entries.append((t, name_tok, desc_tok))
        n = len(pool)
        index = {"entries": entries, "idf": {tok: math.log(1 + n / (1 + c)) for tok, c in df.items()}}
        _INDEX_CACHE[key] = index
    q = set(_tokens(query))
    idf = index["idf"]
    scored = []
    for pos, (t, name_tok, desc_tok) in enumerate(index["entries"]):
        score = sum(idf.get(x, 0.0) * 2.0 for x in q & name_tok) + sum(idf.get(x, 0.0) for x in q & desc_tok)
        scored.append((-score, pos, t))
    scored.sort(key=lambda x: (x[0], x[1]))
    return [t for _, _, t in scored[:k]]


def _clean_schema(node):
    """anyOf[X, null] -> X, null defaults aur 'title' noise hatao (provider schema errors se bachne ke liye)."""
    if isinstance(node, list):
        return [_clean_schema(i) for i in node]
    if not isinstance(node, dict):
        return node
    if "anyOf" in node:
        options = [o for o in node["anyOf"] if not (isinstance(o, dict) and o.get("type") == "null")]
        if len(options) == 1:
            merged = {k: v for k, v in node.items() if k != "anyOf"}
            merged.update(options[0])
            return _clean_schema(merged)
    out = {}
    for key, value in node.items():
        if key == "properties" and isinstance(value, dict):
            out[key] = {pk: _clean_schema(pv) for pk, pv in value.items()}
        elif key == "title" or (key == "default" and value is None):
            continue
        else:
            out[key] = _clean_schema(value)
    return out


_SCHEMA_CACHE: dict[int, dict] = {}


def _openai_tool(t) -> dict:
    cached = _SCHEMA_CACHE.get(id(t))
    if cached is None:
        cached = _clean_schema(convert_to_openai_tool(t))
        _SCHEMA_CACHE[id(t)] = cached
    return cached


# =============================================================================
# 4. LLM HELPERS
# =============================================================================
def _model_chain() -> list[str]:
    gemini_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
    groq_key = os.getenv("GROQ_API_KEY")
    models: list[str] = []
    if gemini_key:
        models.append(os.getenv("VOICE_GEMINI_MODEL", "gemini/gemini-3.5-flash"))
    if groq_key:
        models.extend(["groq/llama-3.3-70b-versatile", "groq/openai/gpt-oss-20b"])
    if not models:
        raise VoiceAgentUnavailableError(
            "No voice-agent model is configured. Set GEMINI_API_KEY or GROQ_API_KEY in the backend environment."
        )
    return models


async def _llm_call(messages: list[dict], tools: Optional[list[dict]] = None, temperature: float = 0.2):
    """Provider fallback chain (Gemini -> Groq). Returns litellm message."""
    errors: list[str] = []
    for model_name in _model_chain():
        try:
            kwargs = dict(model=model_name, messages=messages, temperature=temperature, timeout=30, num_retries=0)
            if tools:
                kwargs["tools"] = tools
                kwargs["tool_choice"] = "auto"
            response = await litellm.acompletion(**kwargs)
            return response.choices[0].message
        except Exception as exc:
            errors.append(f"{model_name}: {type(exc).__name__}")
            log.warning("voice model %s failed: %s", model_name, str(exc)[:200])
    raise VoiceAgentUnavailableError("All configured LLM providers failed: " + "; ".join(errors))


def _parse_args(raw) -> dict:
    if isinstance(raw, dict):
        return raw
    try:
        parsed = json.loads(raw or "{}")
        return parsed if isinstance(parsed, dict) else {}
    except json.JSONDecodeError:
        return {}


def _extract_json(text: str) -> Optional[dict]:
    text = re.sub(r"```(?:json)?", "", text or "").strip()
    start, end = text.find("{"), text.rfind("}")
    if start == -1 or end <= start:
        return None
    try:
        data = json.loads(text[start : end + 1])
        return data if isinstance(data, dict) else None
    except json.JSONDecodeError:
        return None


def _stringify(output) -> str:
    if isinstance(output, str):
        text = output
    else:
        try:
            text = json.dumps(output, ensure_ascii=False, default=str)
        except Exception:
            text = str(output)
    if len(text) > _MAX_TOOL_CHARS:
        text = text[:_MAX_TOOL_CHARS] + "\n...[output truncated for voice response]"
    return text


def _last_human_text(messages: list) -> str:
    for m in reversed(messages):
        if isinstance(m, HumanMessage):
            return str(m.content)
    return ""


def _conversation_text(messages: list, limit: int) -> str:
    lines = []
    for m in messages[-limit:]:
        role = "User" if isinstance(m, HumanMessage) else "Deva"
        lines.append(f"{role}: {str(m.content)[:400]}")
    return "\n".join(lines)


# =============================================================================
# 5. STATE + SUPERVISOR NODE
# =============================================================================
class VoiceState(MessagesState):
    plan: list  # [{"agent": key, "task": str}]
    step: int
    results: list  # [{"agent": key, "answer": str}]
    direct_reply: str
    last_agents: list


_SUPERVISOR_PROMPT = """You are the Supervisor of Deva's multi-agent voice team (HSE / manufacturing assistant created by IIIOT InfoTech).
Route the user's latest message to the right specialist agent(s).

Enabled agents:
{enabled}

Disabled agents (switched off by admin): {disabled}
Agent(s) that handled the previous turn: {last_agents}

Rules:
- Normally pick exactly 1 agent. Pick 2 (max {max_plan}) only if the question clearly spans different domains.
- For each agent write a short self-contained task in English or the user's wording. Resolve pronouns like "uska" or "that" using the conversation.
- For greetings, thanks, small talk, off-topic questions, or questions that belong to a disabled agent, pick NO agent and write a short spoken direct_reply in the user's language (Hindi, Hinglish or English). Address the user as 'sir'. If the area is disabled, say politely it is switched off in the voice settings. No markdown, no emojis.
- Never answer plant data questions yourself.

Return ONLY a JSON object, nothing else:
{{"agents": [{{"name": "<agent key>", "task": "<task>"}}], "direct_reply": ""}}"""


def _heuristic_decision(text: str, enabled: list[str]) -> dict:
    """LLM routing fail ho to keyword scoring."""
    lower = text.lower()
    best, best_score = None, 0
    for key in enabled:
        score = sum(1 for kw in AGENTS[key].keywords if kw in lower)
        if score > best_score:
            best, best_score = key, score
    if best is None and "general" in enabled:
        best = "general"
    if best is None:
        return {"plan": [], "direct_reply": "Sir, the relevant voice capability is currently switched off or unavailable."}
    return {"plan": [{"agent": best, "task": text}], "direct_reply": ""}


async def _supervisor_decide(latest: str, history: str, enabled: list[str], last_agents: list) -> Optional[dict]:
    enabled_txt = "\n".join(f"- {k}: {AGENTS[k].description}" for k in enabled) or "(none)"
    disabled = [f"{k} ({AGENTS[k].label})" for k in AGENT_KEYS if k not in enabled]
    system = _SUPERVISOR_PROMPT.format(
        enabled=enabled_txt,
        disabled=", ".join(disabled) or "none",
        last_agents=", ".join(last_agents) or "none",
        max_plan=_MAX_PARALLEL_PLAN,
    )
    user = (f"Conversation so far:\n{history}\n\n" if history else "") + f"Latest user message:\n{latest}"
    msg = await _llm_call(
        [{"role": "system", "content": system}, {"role": "user", "content": user}], temperature=0.0
    )
    data = _extract_json(msg.content or "")
    if data is None:
        return None
    plan, seen = [], set()
    for item in data.get("agents") or []:
        name = item.get("name") if isinstance(item, dict) else str(item)
        if name in enabled and name not in seen:
            seen.add(name)
            task = (item.get("task") if isinstance(item, dict) else None) or latest
            plan.append({"agent": name, "task": str(task)})
        if len(plan) >= _MAX_PARALLEL_PLAN:
            break
    return {"plan": plan, "direct_reply": str(data.get("direct_reply") or "").strip()}


async def _supervisor_node(state: VoiceState, config: RunnableConfig) -> dict:
    enabled = _resolve_enabled(config)
    messages = state["messages"]
    latest = _last_human_text(messages)
    history = _conversation_text(messages[:-1], 6)
    try:
        decision = await _supervisor_decide(latest, history, enabled, state.get("last_agents") or [])
    except Exception as exc:
        log.warning("supervisor LLM failed (%s); heuristic routing", type(exc).__name__)
        decision = None
    if decision is None or (not decision["plan"] and not decision["direct_reply"]):
        decision = _heuristic_decision(latest, enabled)
    log.info("supervisor plan: %s", [p["agent"] for p in decision["plan"]] or "direct")
    return {"plan": decision["plan"], "step": 0, "results": [], "direct_reply": decision["direct_reply"]}


# =============================================================================
# 6. WORKER AGENTS (ReAct loop per specialist)
# =============================================================================
_WORKER_PROMPT = """You are Deva's {label} specialist agent, part of a multi-agent voice team created by IIIOT InfoTech.
Address the user as 'sir'. Reply in the user's language (Hindi, Hinglish or English).
Your domain: {description}

Rules:
- For live data always call the matching tool. Tools are read-only. Never guess or invent data.
- If a tool returns an error, an offline database or no records, say so plainly.
- If a tool call fails because of arguments, fix the arguments and retry once.
- Your answer is spoken aloud: 2 to 4 short sentences, no markdown, no tables, no bullet symbols, no emojis.
- For long result lists speak the total count and only the top 3 to 5 items, then offer more details.
- Say numbers and times naturally."""


async def _run_worker(key: str, task: str, context: str) -> str:
    spec = AGENTS[key]
    tools = await asyncio.to_thread(_load_tools, key)
    if not tools:
        why = _LOAD_ERRORS.get(key, "no tools registered")
        return f"Sir, the {spec.label} agent is unavailable right now ({why[:120]})."

    by_name = {t.name: t for t in tools}
    schemas = [_openai_tool(t) for t in _select_tools(tools, task, _MAX_TOOLS_PER_AGENT)]
    user = (f"Recent conversation:\n{context}\n\n" if context else "") + f"Task from supervisor:\n{task}"
    messages: list[dict] = [
        {"role": "system", "content": _WORKER_PROMPT.format(label=spec.label, description=spec.description)},
        {"role": "user", "content": user},
    ]

    async def run_call(call) -> dict:
        target = by_name.get(call.function.name)
        if target is None:
            out = f"Error: unknown tool '{call.function.name}'."
        else:
            try:
                out = await target.ainvoke(_parse_args(call.function.arguments))
            except Exception as exc:
                out = f"Tool error ({type(exc).__name__}): {exc}"
        return {"role": "tool", "tool_call_id": call.id, "content": _stringify(out)}

    for _ in range(_MAX_TOOL_ROUNDS):
        msg = await _llm_call(messages, schemas)
        calls = getattr(msg, "tool_calls", None) or []
        if not calls:
            return (msg.content or "").strip()
        messages.append(
            {
                "role": "assistant",
                "content": msg.content or None,
                "tool_calls": [
                    {
                        "id": c.id,
                        "type": "function",
                        "function": {"name": c.function.name, "arguments": c.function.arguments or "{}"},
                    }
                    for c in calls
                ],
            }
        )
        messages.extend(await asyncio.gather(*(run_call(c) for c in calls)))

    # tool rounds khatam: bina tools ke final answer
    msg = await _llm_call(messages, None)
    return (msg.content or "").strip()


def _make_worker_node(key: str):
    spec = AGENTS[key]

    async def node(state: VoiceState, config: RunnableConfig) -> dict:
        step = state.get("step", 0)
        item = state["plan"][step]
        context = _conversation_text(state["messages"][:-1], 4)
        try:
            answer = await asyncio.wait_for(_run_worker(key, item["task"], context), timeout=_WORKER_TIMEOUT)
        except asyncio.TimeoutError:
            answer = f"Sir, the {spec.label} agent is taking too long right now. Please try again."
        answer = answer or f"Sir, I could not get a clear answer from the {spec.label} agent."
        results = list(state.get("results") or []) + [{"agent": key, "answer": answer}]
        return {"results": results, "step": step + 1}

    node.__name__ = f"{key}_node"
    return node


# =============================================================================
# 7. FINALIZE + GRAPH
# =============================================================================
async def _finalize_node(state: VoiceState) -> dict:
    results = state.get("results") or []
    if not results:
        reply = state.get("direct_reply") or "Sir, I could not process that request."
    elif len(results) == 1:
        reply = results[0]["answer"]
    else:
        question = _last_human_text(state["messages"])
        parts = "\n\n".join(f"[{AGENTS[r['agent']].label}]\n{r['answer']}" for r in results)
        try:
            msg = await _llm_call(
                [
                    {
                        "role": "system",
                        "content": "Combine the specialist answers into ONE spoken reply of 2 to 4 short sentences, in the "
                        "user's language (Hindi, Hinglish or English). Address the user as 'sir'. Keep every number and "
                        "fact exactly as given. No markdown, no emojis.",
                    },
                    {"role": "user", "content": f"User question: {question}\n\nSpecialist answers:\n{parts}"},
                ],
                temperature=0.2,
            )
            reply = (msg.content or "").strip() or " ".join(r["answer"] for r in results)
        except Exception:
            reply = " ".join(r["answer"] for r in results)
    return {
        "messages": [AIMessage(content=reply)],
        "last_agents": [r["agent"] for r in results],
        "plan": [],
        "step": 0,
        "results": [],
        "direct_reply": "",
    }


def _route_next(state: VoiceState) -> str:
    plan, step = state.get("plan") or [], state.get("step", 0)
    return plan[step]["agent"] if step < len(plan) else "finalize"


_builder = StateGraph(VoiceState)
_builder.add_node("supervisor", _supervisor_node)
for _key in AGENT_KEYS:
    _builder.add_node(_key, _make_worker_node(_key))
_builder.add_node("finalize", _finalize_node)

_targets = {k: k for k in AGENT_KEYS}
_targets["finalize"] = "finalize"
_builder.add_edge(START, "supervisor")
_builder.add_conditional_edges("supervisor", _route_next, _targets)
for _key in AGENT_KEYS:
    _builder.add_conditional_edges(_key, _route_next, _targets)
_builder.add_edge("finalize", END)

voice_agent_graph = _builder.compile(checkpointer=MemorySaver())


# =============================================================================
# 8. PUBLIC API
# =============================================================================
@trace_agent("Voice Assistant Deva usecase")
async def run_voice_agent_turn(message: str, thread_id: str, enabled_agents: Optional[list[str]] = None) -> str:
    """Run one assistant turn through supervisor -> specialist agent(s) -> finalize.

    enabled_agents=None => admin settings (get_enabled_agents) use hoti hain.
    """
    blocked, reason, details = check_prompt_injection(message)
    if blocked:
        return blocked_prompt_response(
            "Voice Assistant Deva usecase",
            reason,
            details,
            thread_id,
        )["reply"]

    config = graph_trace_config(
        "Voice Assistant Deva usecase",
        thread_id,
        use_case_name="Voice Assistant Deva usecase",
        application="Voice Assistant Deva",
        graph_name="Voice Assistant Deva",
        extra_tags=["voice-assistant", "deva", "use-case:voice-assistant-deva"],
    )
    configurable: dict = config["configurable"]
    if enabled_agents is not None:
        configurable["enabled_agents"] = list(enabled_agents)
    result = await voice_agent_graph.ainvoke(
        {"messages": [HumanMessage(content=message)]},
        config={**config, "configurable": configurable},
    )
    return str(result["messages"][-1].content)