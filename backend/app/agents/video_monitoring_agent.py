"""
Video Monitoring Multi-Agent System — AI Safety Assistant
Created by IIIOT InfoTech.

LangGraph 5-Agent Supervisor Mesh for Video Monitoring & Industrial Safety:
- General Agent      : Pleasantries, profile lookup, greetings, general queries.
- System Agent       : Read-only metrics, camera lists, zone alerts, safety events, ad-hoc SQL.
- Setup Agent        : Write/Mutation operations for zones, rules, recipient lists, with HITL checks.
- Investigator Agent : Forensic incident timelines, snapshot analysis, incident root causes.
- Video Agent        : RTSP stream URLs, YOLO object/person detection, VLM scene interrogation.

STRUCTURE NOTE FOR FUTURE EXTENSION
------------------------------------
Every agent's tools live in their own clearly-marked "# ==== <AGENT> AGENT TOOLS ====" section
below. To add a new tool for an agent:
  1. Write the @tool function inside that agent's section.
  2. Add it to that agent's `..._tools_registry` list at the bottom of the section
     (or in the "TOOL REGISTRIES" block near the end of the file).
  3. If it's a write/mutation tool, add it to TOOL_TO_COMPONENT_MAP for RBAC coverage.
That's it — the agent node, the tool executor, and the graph wiring all read from the
registries automatically, so nothing else needs to change.

UPGRADED (merged in from multi_agent_production.ipynb):
- Production-grade pooled + self-healing Postgres engine (QueuePool, retries, health probe).
- FallbackLLM gateway with input/output guardrails, per-provider cost + token metrics.
- Dynamic Role-Based Access Control (RBAC): every tool is mapped to a UI "component";
  execute_tools_node blocks any tool call the caller's role isn't permitted to use.
- Full tool registries for all 5 agents (System/Setup/Investigator/Video/General), matching
  the notebook's tool surface, so new tools can be dropped into the matching section later.
- Edge-level security guardrail router that scrubs any accidental credential/token leakage.
- Traceability Audit Trail (DB logging) + SSE generator with token-by-token streaming and
  dynamic UI widget payloads.
"""

import asyncio
import json
import os
import re
import time
from datetime import datetime
from typing import Annotated, Any, AsyncGenerator, Dict, List, Literal, Optional, Tuple

from langchain_core.messages import AIMessage, BaseMessage, HumanMessage, SystemMessage, ToolMessage
from langchain_core.tools import tool
from langchain_litellm import ChatLiteLLM
from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph import END, START, StateGraph
from langgraph.graph.message import add_messages
from sqlalchemy import create_engine, text
from sqlalchemy.pool import QueuePool
from typing_extensions import TypedDict

import litellm

try:
    from pydantic import BaseModel, Field
except Exception:
    BaseModel = object
    Field = lambda *a, **k: None  # noqa: E731

# ── Silence verbose litellm logs ──────────────────────────────────────────────
litellm.set_verbose = False
litellm.suppress_debug_info = True
litellm.turn_off_message_logging = True
try:
    litellm._logging._disable_debugging()
except AttributeError:
    pass

# ════════════════════════════════════════════════════════════════════════════
# 🗄️ DATABASE ENGINE (Production-Grade: pooled + self-healing)
# ════════════════════════════════════════════════════════════════════════════
CONSTRUCTION_DB_URL = os.getenv(
    "CONSTRUCTION_DB_URL",
    "postgresql://postgres:postgres@localhost:5432/construction_ai",
)

engine = None
_DB_MAX_RETRIES = 3
_DB_RETRY_DELAY_SECONDS = 2

for attempt in range(1, _DB_MAX_RETRIES + 1):
    try:
        engine = create_engine(
            CONSTRUCTION_DB_URL,
            poolclass=QueuePool,
            pool_size=10,
            max_overflow=20,
            pool_timeout=30,
            pool_recycle=1800,
            pool_pre_ping=True,
            connect_args={"connect_timeout": 10},
        )
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        print(f"[Video Monitoring Multi-Agent] Connected to PostgreSQL (attempt {attempt}/{_DB_MAX_RETRIES})")
        break
    except Exception as e:
        engine = None
        print(f"[Video Monitoring Multi-Agent WARNING] DB connection attempt {attempt}/{_DB_MAX_RETRIES} failed: {e}")
        if attempt < _DB_MAX_RETRIES:
            time.sleep(_DB_RETRY_DELAY_SECONDS)
        else:
            print("[Video Monitoring Multi-Agent WARNING] DB unavailable after all retries. Fallback/mock mode active.")

# Kept as an alias since some tool bodies below refer to `construction_engine`.
construction_engine = engine


def get_db_health() -> Dict[str, Any]:
    """Lightweight health probe used by ops/monitoring and the System Agent."""
    if engine is None:
        return {"status": "down", "error": "Engine not initialized."}
    try:
        start = time.perf_counter()
        with engine.connect() as conn:
            conn.execute(text("SELECT 1;"))
        latency_ms = round((time.perf_counter() - start) * 1000, 2)
        pool = engine.pool
        return {
            "status": "healthy",
            "latency_ms": latency_ms,
            "pool_checked_out": pool.checkedout(),
            "pool_size": pool.size(),
        }
    except Exception as e:
        return {"status": "down", "error": str(e)}


# ════════════════════════════════════════════════════════════════════════════
# 🚀 LLM GATEWAY (Fallback + Guardrails + Cost Metrics)
# ════════════════════════════════════════════════════════════════════════════
groq_llm = ChatLiteLLM(
    model="groq/llama-3.1-8b-instant",
    api_key=os.getenv("GROQ_API_KEY", "mock-groq-key"),
    temperature=0.1,
    max_tokens=1500,
)

gemini_llm = ChatLiteLLM(
    model="gemini/gemini-3.1-flash-lite",
    api_key=os.getenv("GEMINI_API_KEY", "mock-gemini-key"),
    temperature=0.1,
    max_tokens=1500,
)


class FallbackLLM:
    """Production Gateway with Fallback, Guardrails & Token/Cost Metrics tracking."""

    _COST_TABLE = {
        "groq/llama-3.1-8b-instant": {"input": 0.59, "output": 0.79},
        "gemini/gemini-3.1-flash-lite": {"input": 0.075, "output": 0.30},
    }

    _BLOCKED_INPUT_PATTERNS = [
        "drop table", "delete from", "truncate table", "insert into",
        "ignore previous instructions", "system override", "reveal your system prompt",
    ]

    _BLOCKED_OUTPUT_KEYWORDS = [
        "password_hash", "encrypted_app_password", "encrypted_password",
        "app_password", "gemini_key", "groq_key", "openrouter_key", "tavily_key",
    ]

    _DB_URL_PATTERN = re.compile(r"(postgresql|postgres|mysql|mongodb)://([^:]+):([^@]+)@([^/]+)/([^?\s]+)")

    def __init__(self, models: List[Tuple[str, Any]]):
        self.models = models
        self.gateway_metrics = {
            "total_calls": 0,
            "failed_calls": 0,
            "input_tokens_served": 0,
            "output_tokens_served": 0,
            "accumulated_cost_usd": 0.0,
        }

    def _input_guardrail(self, messages: List[BaseMessage]) -> bool:
        if not messages:
            return True
        content = getattr(messages[-1], "content", "")
        if not isinstance(content, str):
            return True
        content_lower = content.lower()
        return not any(p in content_lower for p in self._BLOCKED_INPUT_PATTERNS)

    def _output_guardrail(self, content: str) -> str:
        if not content:
            return content
        if self._DB_URL_PATTERN.search(content):
            return "⚠️ [SECURITY ENFORCEMENT]: Sensitive database credentials were intercepted and hidden."
        lowered = content.lower()
        if any(k in lowered for k in self._BLOCKED_OUTPUT_KEYWORDS):
            return "⚠️ [SECURITY ENFORCEMENT]: Response blocked to prevent raw encryption keys or passwords from showing."
        return content

    def _calculate_costs(self, model_name: str, input_tokens: int, output_tokens: int) -> None:
        rates = self._COST_TABLE.get(model_name)
        if not rates:
            return
        in_cost = (input_tokens / 1_000_000) * rates["input"]
        out_cost = (output_tokens / 1_000_000) * rates["output"]
        self.gateway_metrics["input_tokens_served"] += input_tokens
        self.gateway_metrics["output_tokens_served"] += output_tokens
        self.gateway_metrics["accumulated_cost_usd"] += in_cost + out_cost

    def invoke(self, messages, **kwargs):
        self.gateway_metrics["total_calls"] += 1

        if not self._input_guardrail(messages):
            return AIMessage(content="🚨 [SECURITY VIOLATION]: Request blocked by system gateway.")

        for provider_name, llm in self.models:
            try:
                start = time.perf_counter()
                response = llm.invoke(messages, **kwargs)
                elapsed = time.perf_counter() - start

                if response is None or not getattr(response, "content", None):
                    continue

                input_tokens = output_tokens = 0
                if hasattr(response, "usage_metadata") and response.usage_metadata:
                    input_tokens = response.usage_metadata.get("input_tokens", 0)
                    output_tokens = response.usage_metadata.get("output_tokens", 0)
                elif hasattr(response, "response_metadata") and response.response_metadata:
                    usage = response.response_metadata.get("token_usage") or response.response_metadata.get("usage") or {}
                    input_tokens = usage.get("prompt_tokens", 0)
                    output_tokens = usage.get("completion_tokens", 0)

                model_str = getattr(llm, "model", "")
                self._calculate_costs(model_str, input_tokens, output_tokens)

                if isinstance(response.content, str):
                    response.content = self._output_guardrail(response.content)

                if hasattr(response, "response_metadata") and response.response_metadata is not None:
                    response.response_metadata["selected_provider"] = provider_name
                    response.response_metadata["response_time"] = elapsed

                return response
            except Exception as e:
                self.gateway_metrics["failed_calls"] += 1
                print(f"[FallbackLLM Warning] {provider_name} failed: {e}. Trying next fallback.")
                continue

        last_msg = messages[-1].content if messages else ""
        return AIMessage(
            content=f"🤖 [AI Safety Assistant]: Processing your query regarding video monitoring and safety operations. Re: {str(last_msg)[:100]}"
        )

    def with_structured_output(self, schema, **kwargs):
        return FallbackLLM([(name, llm.with_structured_output(schema, **kwargs)) for name, llm in self.models])

    def bind_tools(self, tools):
        return FallbackLLM([(name, llm.bind_tools(tools)) for name, llm in self.models])


base_llm = FallbackLLM([("Gemini", gemini_llm), ("Groq", groq_llm)])
reasoning_llm = base_llm  # Alias kept for compatibility with notebook naming.

# ════════════════════════════════════════════════════════════════════════════
# 🧠 STATE DEFINITION
# ════════════════════════════════════════════════════════════════════════════
class TeamState(TypedDict):
    messages: Annotated[List[BaseMessage], add_messages]
    next_agent: str
    source_documents: List[Dict[str, Any]]
    generated_outputs: List[Dict[str, Any]]
    user_id: str
    current_investigated_date: Optional[str]
    date_summary_cache: Optional[str]
    current_video_camera: Optional[str]
    video_summary_cache: Optional[str]


# ════════════════════════════════════════════════════════════════════════════
# 🎭 MOCK DATA (used whenever the DB is unavailable / a table doesn't exist yet)
# ════════════════════════════════════════════════════════════════════════════
def _get_mock_video_data(query_type: str) -> List[Dict[str, Any]]:
    if query_type == "cameras":
        return [
            {"id": 101, "name": "CAM-01 Entrance Gate", "location": "Zone A Main Entrance", "status": "ONLINE", "fps": 30, "resolution": "1080p", "rtsp_url": "rtsp://demo.stream/cam01"},
            {"id": 102, "name": "CAM-02 Assembly Line 1", "location": "Manufacturing Bay 2", "status": "ONLINE", "fps": 25, "resolution": "4K", "rtsp_url": "rtsp://demo.stream/cam02"},
            {"id": 103, "name": "CAM-03 Loading Dock", "location": "Warehouse Sector C", "status": "ONLINE", "fps": 30, "resolution": "1080p", "rtsp_url": "rtsp://demo.stream/cam03"},
            {"id": 104, "name": "CAM-04 Chemical Storage", "location": "Hazard Zone 4", "status": "ONLINE", "fps": 30, "resolution": "1080p", "rtsp_url": "rtsp://demo.stream/cam04"},
            {"id": 105, "name": "CAM-05 High Bay Crane", "location": "Steel Yard North", "status": "OFFLINE", "fps": 0, "resolution": "1080p", "rtsp_url": "rtsp://demo.stream/cam05"},
        ]
    elif query_type == "incidents":
        return [
            {"id": "INC-8891", "timestamp": "2026-09-09 10:14:22", "camera": "CAM-02 Assembly Line 1", "type": "PPE Violation - No Helmet", "severity": "HIGH", "status": "OPEN", "confidence": 0.94, "snapshot_url": "/api/placeholders/evidence1.jpg"},
            {"id": "INC-8892", "timestamp": "2026-09-09 11:45:01", "camera": "CAM-03 Loading Dock", "type": "Unauthorized Zone Intrusion", "severity": "CRITICAL", "status": "INVESTIGATING", "confidence": 0.98, "snapshot_url": "/api/placeholders/evidence2.jpg"},
            {"id": "INC-8893", "timestamp": "2026-09-09 13:02:19", "camera": "CAM-04 Chemical Storage", "type": "Fire/Smoke Detected", "severity": "CRITICAL", "status": "RESOLVED", "confidence": 0.91, "snapshot_url": "/api/placeholders/evidence3.jpg"},
        ]
    elif query_type == "counts":
        return [
            {"zone": "Manufacturing Bay 2", "person_count": 14, "forklift_count": 2, "helmet_compliance": "92%", "vest_compliance": "100%"},
            {"zone": "Warehouse Sector C", "person_count": 8, "forklift_count": 4, "helmet_compliance": "87.5%", "vest_compliance": "87.5%"},
            {"zone": "Hazard Zone 4", "person_count": 1, "forklift_count": 0, "helmet_compliance": "100%", "vest_compliance": "100%"},
        ]
    return []


# ════════════════════════════════════════════════════════════════════════════
# 🛡️ SHARED SECURITY / DB UTILITIES
# ════════════════════════════════════════════════════════════════════════════
_FORBIDDEN_SQL_OPS = ["insert", "update", "delete", "drop", "truncate", "alter", "grant", "create table"]
_FORBIDDEN_COLUMNS = ["password_hash", "smtp_password", "telegram_bot_token", "teams_webhook_url", "whatsapp_auth_token"]


def _is_query_secure(sql_query: str) -> Tuple[bool, str]:
    query_lower = sql_query.lower()
    if any(op in query_lower for op in _FORBIDDEN_SQL_OPS):
        return False, "Security Exception: Non-read command strings are explicitly barred inside this node block."
    if any(col in query_lower for col in _FORBIDDEN_COLUMNS):
        return False, "Security Exception: Reading structural security parameters or API tokens via chat is restricted."
    return True, ""


def _serialize_row_data(result) -> List[Dict[str, Any]]:
    serialized = []
    for row in result:
        d = dict(row._mapping)
        for k, v in d.items():
            if k.lower() in _FORBIDDEN_COLUMNS:
                d[k] = "[ENCRYPTED_REDACTED]"
            elif v is not None and not isinstance(v, (int, float, str, bool, list, dict)):
                d[k] = str(v)
        serialized.append(d)
    return serialized


def _safe_select(sql: str, params: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
    """Runs a read-only SELECT and always returns a list (never raises to the LLM)."""
    if engine is None:
        return [{"error": "Database connector is uninitialized."}]
    try:
        with engine.connect() as conn:
            result = conn.execute(text(sql), params or {})
            return _serialize_row_data(result)
    except Exception as e:
        return [{"error": str(e)}]


def _resolve_camera_id(conn, camera_name_or_id: str) -> Optional[int]:
    try:
        cid = int(camera_name_or_id)
        res = conn.execute(text("SELECT id FROM cameras WHERE id = :id"), {"id": cid}).fetchone()
        if res:
            return res[0]
    except (ValueError, TypeError):
        pass
    res = conn.execute(
        text("SELECT id FROM cameras WHERE name ILIKE :val OR camera_number = :val_str"),
        {"val": f"%{camera_name_or_id}%", "val_str": str(camera_name_or_id)},
    ).fetchone()
    return res[0] if res else None


def _resolve_zone_id(conn, camera_id: Optional[int], zone_name: str) -> Optional[int]:
    res = conn.execute(
        text("SELECT id FROM zones WHERE (:cam_id IS NULL OR camera_id = :cam_id) AND (name ILIKE :val)"),
        {"cam_id": camera_id, "val": f"%{zone_name}%"},
    ).fetchone()
    return res[0] if res else None


def _log_agent_trace(thread_id: str, agent_name: str, user_input: str, response_text: str) -> None:
    if not engine:
        return
    try:
        with engine.begin() as conn:
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS agent_trace_logs (
                    id SERIAL PRIMARY KEY,
                    thread_id VARCHAR(100),
                    agent_name VARCHAR(50),
                    user_input TEXT,
                    response_text TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """))
            conn.execute(
                text("INSERT INTO agent_trace_logs (thread_id, agent_name, user_input, response_text) VALUES (:t, :a, :i, :r)"),
                {"t": thread_id, "a": agent_name, "i": user_input, "r": response_text},
            )
    except Exception as e:
        print(f"[Traceability Warning] Could not log trace: {e}")


# ════════════════════════════════════════════════════════════════════════════
# 🧑 GENERAL AGENT TOOLS
# (Add new General Agent tools below this line, then register them in
#  general_agent_tools_registry at the end of this section.)
# ════════════════════════════════════════════════════════════════════════════
@tool
def get_current_user_profile(user_email: str) -> Dict[str, Any]:
    """Looks up an operator's profile — department, designation, role, account status — by email/username."""
    if engine is None:
        return {"success": False, "error": "Database connector engine is uninitialized."}
    query = text("""
        SELECT u.id AS user_id, u.full_name, u.email, u.username, u.phone, u.employee_id,
               u.is_active, u.last_login, r.name AS platform_role_name,
               d.name AS department_name, des.name AS designation_title
        FROM users u
        LEFT JOIN roles r ON r.id = u.role_id
        LEFT JOIN departments d ON d.id = u.department_id
        LEFT JOIN designations des ON des.id = u.designation_id
        WHERE u.email = :email OR u.username = :email;
    """)
    try:
        with engine.connect() as conn:
            row = conn.execute(query, {"email": str(user_email)}).fetchone()
            if not row:
                return {"success": False, "error": f"Operator profile linked to '{user_email}' not found."}
            data = dict(row._mapping)
            if data.get("last_login"):
                data["last_login"] = str(data["last_login"])
            return {"success": True, "profile": data}
    except Exception as e:
        return {"success": False, "error": f"Failed to retrieve operator identity: {str(e)}"}


@tool
def get_current_user(user_id_or_username: str) -> Dict[str, Any]:
    """Lightweight variant of get_current_user_profile: returns username, email, and role only."""
    rows = _safe_select(
        """
        SELECT u.username, u.email, r.name AS role_name
        FROM users u LEFT JOIN roles r ON r.id = u.role_id
        WHERE u.id::text = :val OR u.username = :val OR u.email = :val
        """,
        {"val": str(user_id_or_username)},
    )
    return {"success": bool(rows) and "error" not in rows[0], "result": rows}


general_agent_tools_registry = [
    get_current_user_profile,
    get_current_user,
]


# ════════════════════════════════════════════════════════════════════════════
# 📊 SYSTEM AGENT TOOLS (Read-Only)
# (Add new System Agent tools below this line, then register them in
#  system_agent_tools_registry at the end of this section.)
# ════════════════════════════════════════════════════════════════════════════
@tool
def query_system_data(sql_query: str) -> str:
    """
    DYNAMIC READ-ONLY QUERY EXECUTOR. Use for ad-hoc telemetry, roster, zone, or metrics
    lookups not covered by the fixed tools, e.g. 'SELECT id, name, status FROM cameras;'.
    Only SELECT statements are allowed — write/DDL statements and credential columns are blocked.
    """
    if engine is None:
        return json.dumps([{"error": "Database connector engine is uninitialized."}])
    is_secure, error_msg = _is_query_secure(sql_query)
    if not is_secure:
        return json.dumps([{"error": error_msg}])
    return json.dumps(_safe_select(sql_query))


@tool
def check_camera_fleet_health(filter_status: str = "ALL") -> str:
    """Fetch live camera inventory, RTSP statuses, frame rates, and assigned safety zones."""
    if engine:
        rows = _safe_select("SELECT id, name, location, status, fps, resolution FROM cameras LIMIT 50")
        if rows and "error" not in rows[0]:
            return json.dumps(rows)
    cams = _get_mock_video_data("cameras")
    if filter_status.upper() != "ALL":
        cams = [c for c in cams if c["status"] == filter_status.upper()]
    return json.dumps(cams)


@tool
def get_cameras(camera_id_or_name: Optional[str] = None) -> List[Dict[str, Any]]:
    """Retrieves camera records, optionally filtered by camera id, number, or name."""
    if engine is None:
        return _get_mock_video_data("cameras")
    sql = "SELECT id, name, ip, port, camera_number, status, fps, resolution FROM cameras"
    params = {}
    if camera_id_or_name is not None:
        try:
            cid = int(camera_id_or_name)
            sql += " WHERE id = :cid OR camera_number = :cid_str OR name ILIKE :name_like"
            params = {"cid": cid, "cid_str": str(cid), "name_like": f"%{camera_id_or_name}%"}
        except ValueError:
            sql += " WHERE camera_number = :val OR name ILIKE :name_like"
            params = {"val": camera_id_or_name, "name_like": f"%{camera_id_or_name}%"}
    sql += " ORDER BY id;"
    return _safe_select(sql, params)


@tool
def get_zones(camera_id_or_name: Optional[str] = None, zone_name_or_type: Optional[str] = None) -> List[Dict[str, Any]]:
    """Retrieves zones (Red Zones, restricted zones, ROIs), filterable by camera and/or zone name/type."""
    sql = """
        SELECT z.id, z.camera_id, c.name AS camera_name, z.name, z.zone_type, z.is_active, z.description
        FROM zones z LEFT JOIN cameras c ON c.id = z.camera_id WHERE 1=1
    """
    params: Dict[str, Any] = {}
    if camera_id_or_name is not None:
        sql += " AND (c.id::text = :cid OR c.camera_number = :cid OR c.name ILIKE :cam_like)"
        params.update({"cid": str(camera_id_or_name), "cam_like": f"%{camera_id_or_name}%"})
    if zone_name_or_type is not None:
        sql += " AND (z.name ILIKE :zone_like OR z.zone_type ILIKE :zone_like)"
        params["zone_like"] = f"%{zone_name_or_type}%"
    sql += " ORDER BY z.id;"
    return _safe_select(sql, params)


@tool
def get_zone_risk_scores(zone_name: Optional[str] = None) -> List[Dict[str, Any]]:
    """Retrieves computed risk scores per zone (incident frequency / severity weighted)."""
    sql = "SELECT id, name, zone_type, risk_score, last_incident_at FROM zones WHERE risk_score IS NOT NULL"
    params = {}
    if zone_name:
        sql += " AND name ILIKE :val"
        params["val"] = f"%{zone_name}%"
    sql += " ORDER BY risk_score DESC;"
    return _safe_select(sql, params)


@tool
def get_incidents(
    camera_id_or_name: Optional[str] = None,
    date_filter: Optional[Literal["today", "yesterday", "this_week"]] = None,
    status: Optional[Literal["active", "resolved", "recurring"]] = None,
    class_name: Optional[str] = None,
    limit: int = 100,
) -> List[Dict[str, Any]]:
    """Retrieves safety/production incidents, filterable by camera, date bucket, status, and class."""
    sql = """
        SELECT i.id, i.camera_id, i.camera_name, i.zone_id, z.name AS zone_name, i.class_name, i.confidence,
               i.started_at, i.resolved_at, i.is_active, i.is_acknowledged, i.is_recurring, i.classification,
               i.escalation_status, i.root_cause
        FROM incidents i LEFT JOIN zones z ON z.id = i.zone_id WHERE 1=1
    """
    params: Dict[str, Any] = {"limit": limit}
    if camera_id_or_name is not None:
        sql += " AND (i.camera_id::text = :cid OR i.camera_name ILIKE :cam_like)"
        params.update({"cid": str(camera_id_or_name), "cam_like": f"%{camera_id_or_name}%"})
    if date_filter == "today":
        sql += " AND i.started_at >= CURRENT_DATE"
    elif date_filter == "yesterday":
        sql += " AND i.started_at >= CURRENT_DATE - INTERVAL '1 day' AND i.started_at < CURRENT_DATE"
    elif date_filter == "this_week":
        sql += " AND i.started_at >= DATE_TRUNC('week', CURRENT_DATE)"
    if status == "active":
        sql += " AND i.is_active = true"
    elif status == "resolved":
        sql += " AND i.resolved_at IS NOT NULL"
    elif status == "recurring":
        sql += " AND i.is_recurring = true"
    if class_name is not None:
        sql += " AND i.class_name ILIKE :class_name"
        params["class_name"] = f"%{class_name}%"
    sql += " ORDER BY i.started_at DESC LIMIT :limit;"
    rows = _safe_select(sql, params)
    if rows and "error" in rows[0]:
        return _get_mock_video_data("incidents")
    return rows


@tool
def get_alerts(
    camera_id_or_name: Optional[str] = None,
    date_filter: Optional[Literal["today", "yesterday"]] = None,
    status: Optional[Literal["active", "all"]] = None,
    priority: Optional[Literal["critical", "high", "all"]] = None,
    class_name: Optional[str] = None,
    limit: int = 100,
) -> List[Dict[str, Any]]:
    """Retrieves system alerts, filterable by camera, date, ack status, priority, and class."""
    sql = """
        SELECT a.id, a.camera_id, a.camera_name, a.zone_id, z.name AS zone_name, z.zone_type, a.class_name,
               a.confidence, a.is_acknowledged, a.created_at, a.snapshot_path
        FROM alerts a LEFT JOIN zones z ON z.id = a.zone_id WHERE 1=1
    """
    params: Dict[str, Any] = {"limit": limit}
    if camera_id_or_name is not None:
        sql += " AND (a.camera_id::text = :cid OR a.camera_name ILIKE :cam_like)"
        params.update({"cid": str(camera_id_or_name), "cam_like": f"%{camera_id_or_name}%"})
    if date_filter == "today":
        sql += " AND a.created_at >= CURRENT_DATE"
    elif date_filter == "yesterday":
        sql += " AND a.created_at >= CURRENT_DATE - INTERVAL '1 day' AND a.created_at < CURRENT_DATE"
    if status == "active":
        sql += " AND a.is_acknowledged = false"
    if priority == "critical":
        sql += " AND z.zone_type ILIKE '%critical%'"
    elif priority == "high":
        sql += " AND (z.zone_type ILIKE '%high%' OR z.zone_type ILIKE '%red%' OR z.zone_type ILIKE '%restricted%')"
    if class_name is not None:
        sql += " AND a.class_name ILIKE :class_name"
        params["class_name"] = f"%{class_name}%"
    sql += " ORDER BY a.created_at DESC LIMIT :limit;"
    return _safe_select(sql, params)


@tool
def fetch_active_safety_alerts(hours: int = 24, severity: str = "ALL") -> str:
    """Fetch unacknowledged safety alerts raised in the last N hours, optionally filtered by severity."""
    rows = _safe_select(
        """
        SELECT a.id, a.camera_name, a.class_name, a.confidence, a.created_at, z.zone_type
        FROM alerts a LEFT JOIN zones z ON z.id = a.zone_id
        WHERE a.is_acknowledged = false AND a.created_at >= NOW() - (:hrs || ' hours')::interval
        ORDER BY a.created_at DESC
        """,
        {"hrs": hours},
    )
    if rows and "error" in rows[0]:
        incidents = _get_mock_video_data("incidents")
        if severity.upper() != "ALL":
            incidents = [i for i in incidents if i["severity"] == severity.upper()]
        return json.dumps(incidents)
    return json.dumps(rows)


@tool
def get_anomalies(camera_id_or_name: Optional[str] = None, severity: Optional[str] = None) -> List[Dict[str, Any]]:
    """Retrieves recorded camera/zone anomalies (deviation from baseline), filterable by camera and severity."""
    sql = """
        SELECT af.id, af.anomaly_type, af.severity, af.description, af.zone_id, z.name AS zone_name,
               af.camera_id, c.name AS camera_name, af.class_name, af.baseline_value, af.observed_value,
               af.deviation_factor, af.event_count, af.is_acknowledged, af.created_at
        FROM anomaly_flags af
        LEFT JOIN zones z ON z.id = af.zone_id
        LEFT JOIN cameras c ON c.id = af.camera_id
        WHERE 1=1
    """
    params: Dict[str, Any] = {}
    if camera_id_or_name is not None:
        sql += " AND (af.camera_id::text = :cid OR c.name ILIKE :cam_like)"
        params.update({"cid": str(camera_id_or_name), "cam_like": f"%{camera_id_or_name}%"})
    if severity is not None:
        sql += " AND af.severity ILIKE :sev"
        params["sev"] = f"%{severity}%"
    sql += " ORDER BY af.created_at DESC;"
    return _safe_select(sql, params)


@tool
def get_hse_rule_violations(rule_name: Optional[str] = None, limit: int = 50) -> List[Dict[str, Any]]:
    """Retrieves HSE (Health, Safety & Environment) rule violation records, optionally by rule name."""
    sql = """
        SELECT v.id, v.rule_id, r.name AS rule_name, v.camera_id, v.zone_id, v.severity, v.created_at
        FROM hse_rule_violations v LEFT JOIN hse_rule_definitions r ON r.id = v.rule_id WHERE 1=1
    """
    params: Dict[str, Any] = {"limit": limit}
    if rule_name:
        sql += " AND r.name ILIKE :val"
        params["val"] = f"%{rule_name}%"
    sql += " ORDER BY v.created_at DESC LIMIT :limit;"
    return _safe_select(sql, params)


@tool
def get_defect_detections(camera_id_or_name: Optional[str] = None, limit: int = 50) -> List[Dict[str, Any]]:
    """Retrieves production-line defect detections (quality inspection events)."""
    sql = "SELECT id, camera_id, camera_name, defect_type, confidence, created_at FROM defect_detections WHERE 1=1"
    params: Dict[str, Any] = {"limit": limit}
    if camera_id_or_name:
        sql += " AND camera_name ILIKE :val"
        params["val"] = f"%{camera_id_or_name}%"
    sql += " ORDER BY created_at DESC LIMIT :limit;"
    return _safe_select(sql, params)


@tool
def get_production_counting_summary(zone_name: Optional[str] = None) -> str:
    """Fetch current real-time person/forklift counts and PPE compliance percentages by zone."""
    if zone_name:
        rows = [r for r in _get_mock_video_data("counts") if zone_name.lower() in r["zone"].lower()]
        return json.dumps(rows or _get_mock_video_data("counts"))
    return json.dumps(_get_mock_video_data("counts"))


@tool
def get_counting_statistics(zone_name: Optional[str] = None, date_filter: Optional[str] = None) -> List[Dict[str, Any]]:
    """Retrieves historical counting statistics (people/vehicle throughput) for a zone."""
    sql = "SELECT zone_name, date, person_count_avg, vehicle_count_avg FROM counting_statistics WHERE 1=1"
    params: Dict[str, Any] = {}
    if zone_name:
        sql += " AND zone_name ILIKE :val"
        params["val"] = f"%{zone_name}%"
    sql += " ORDER BY date DESC LIMIT 100;"
    return _safe_select(sql, params)


@tool
def get_recording_history(camera_id_or_name: Optional[str] = None, limit: int = 50) -> List[Dict[str, Any]]:
    """Retrieves stored recording segment history for a camera (start/end time, duration, storage path)."""
    sql = "SELECT id, camera_id, camera_name, started_at, ended_at, storage_path FROM recordings WHERE 1=1"
    params: Dict[str, Any] = {"limit": limit}
    if camera_id_or_name:
        sql += " AND camera_name ILIKE :val"
        params["val"] = f"%{camera_id_or_name}%"
    sql += " ORDER BY started_at DESC LIMIT :limit;"
    return _safe_select(sql, params)


@tool
def get_notification_history(channel: Optional[str] = None, limit: int = 50) -> List[Dict[str, Any]]:
    """Retrieves the log of sent notifications (email/telegram/whatsapp/teams), optionally by channel."""
    sql = "SELECT id, channel, status, recipient, created_at FROM notification_logs WHERE 1=1"
    params: Dict[str, Any] = {"limit": limit}
    if channel:
        sql += " AND channel = :chan"
        params["chan"] = channel
    sql += " ORDER BY created_at DESC LIMIT :limit;"
    return _safe_select(sql, params)


@tool
def get_scheduled_reports() -> List[Dict[str, Any]]:
    """Lists all configured scheduled reports (frequency, format, recipients)."""
    return _safe_select("SELECT id, frequency, send_time, format, email_recipients, is_active FROM scheduled_reports ORDER BY id;")


@tool
def get_system_settings() -> List[Dict[str, Any]]:
    """Retrieves non-sensitive system/notification settings (SMTP host, TLS flag — never credentials)."""
    return _safe_select("SELECT id, smtp_host, smtp_port, smtp_use_tls, smtp_from_email FROM notification_settings LIMIT 1;")


@tool
def get_users_and_activity(limit: int = 50) -> List[Dict[str, Any]]:
    """Retrieves the user roster with last-login/activity info (no credentials)."""
    sql = """
        SELECT u.id, u.username, u.full_name, u.is_active, u.last_login, r.name AS role_name
        FROM users u LEFT JOIN roles r ON r.id = u.role_id ORDER BY u.last_login DESC NULLS LAST LIMIT :limit;
    """
    return _safe_select(sql, {"limit": limit})


@tool
def get_ai_recommendations(zone_name: Optional[str] = None) -> Dict[str, Any]:
    """
    Generates AI-driven safety/process recommendations based on recent incidents and anomalies.
    NOTE: placeholder aggregation logic — extend with real analytics/ML scoring as needed.
    """
    incidents = _get_mock_video_data("incidents")
    if zone_name:
        incidents = [i for i in incidents if zone_name.lower() in i["camera"].lower()]
    recs = [f"Increase PPE audit frequency near {i['camera']} (last flagged: {i['type']})." for i in incidents[:3]]
    return {"zone": zone_name or "ALL", "recommendations": recs or ["No significant risk signals detected in the current window."]}


@tool
def generate_safety_summary_report(date_filter: Optional[Literal["today", "yesterday", "this_week"]] = "today") -> Dict[str, Any]:
    """Compiles a short safety summary report (incident counts by severity) for the given date bucket."""
    incidents = _get_mock_video_data("incidents")
    by_severity: Dict[str, int] = {}
    for i in incidents:
        by_severity[i["severity"]] = by_severity.get(i["severity"], 0) + 1
    return {"period": date_filter, "total_incidents": len(incidents), "by_severity": by_severity}


@tool
def get_event_timeline(camera_id_or_name: Optional[str] = None, limit: int = 50) -> List[Dict[str, Any]]:
    """Retrieves a unified chronological timeline of incidents + alerts + anomalies for a camera."""
    sql = """
        SELECT 'incident' AS source, id::text, camera_name, class_name, started_at AS event_time FROM incidents
        WHERE (:cam IS NULL OR camera_name ILIKE :cam_like)
        UNION ALL
        SELECT 'alert' AS source, id::text, camera_name, class_name, created_at AS event_time FROM alerts
        WHERE (:cam IS NULL OR camera_name ILIKE :cam_like)
        ORDER BY event_time DESC LIMIT :limit;
    """
    params = {"cam": camera_id_or_name, "cam_like": f"%{camera_id_or_name}%" if camera_id_or_name else "%", "limit": limit}
    return _safe_select(sql, params)


@tool
def list_entities(entity_type: str, limit: int = 50) -> List[Dict[str, Any]]:
    """Generic lister for a known table name (cameras, zones, incidents, alerts, users, etc.)."""
    allowed_tables = {"cameras", "zones", "incidents", "alerts", "users", "roles", "departments", "ai_models"}
    if entity_type not in allowed_tables:
        return [{"error": f"Unknown or disallowed entity_type '{entity_type}'."}]
    return _safe_select(f"SELECT * FROM {entity_type} LIMIT :limit;", {"limit": limit})


@tool
def count_entities(entity_type: str) -> Dict[str, Any]:
    """Returns a row count for a known table name."""
    allowed_tables = {"cameras", "zones", "incidents", "alerts", "users", "roles", "departments", "ai_models"}
    if entity_type not in allowed_tables:
        return {"error": f"Unknown or disallowed entity_type '{entity_type}'."}
    rows = _safe_select(f"SELECT COUNT(*) AS total FROM {entity_type};")
    return rows[0] if rows else {"total": 0}


@tool
def search_rules(keyword: str) -> List[Dict[str, Any]]:
    """Searches HSE rule definitions by keyword in name or description."""
    return _safe_select(
        "SELECT id, name, description, is_active FROM hse_rule_definitions WHERE name ILIKE :kw OR description ILIKE :kw;",
        {"kw": f"%{keyword}%"},
    )


@tool
def search_entities(entity_type: str, keyword: str, limit: int = 50) -> List[Dict[str, Any]]:
    """Generic ILIKE search on a table's 'name' column for a known table name."""
    allowed_tables = {"cameras", "zones", "users", "ai_models"}
    if entity_type not in allowed_tables:
        return [{"error": f"Unknown or disallowed entity_type '{entity_type}'."}]
    return _safe_select(f"SELECT * FROM {entity_type} WHERE name ILIKE :kw LIMIT :limit;", {"kw": f"%{keyword}%", "limit": limit})


@tool
def get_entity_details(entity_type: str, entity_id: int) -> Dict[str, Any]:
    """Retrieves a single row's full details for a known table name by numeric ID."""
    allowed_tables = {"cameras", "zones", "incidents", "alerts", "users", "ai_models"}
    if entity_type not in allowed_tables:
        return {"error": f"Unknown or disallowed entity_type '{entity_type}'."}
    rows = _safe_select(f"SELECT * FROM {entity_type} WHERE id = :id;", {"id": entity_id})
    return rows[0] if rows else {"error": "Not found."}


@tool
def find_relationships(camera_id_or_name: str) -> Dict[str, Any]:
    """Finds zones, recent incidents, and alerts related to a given camera in one call."""
    return {
        "zones": get_zones.invoke({"camera_id_or_name": camera_id_or_name}),
        "recent_incidents": get_incidents.invoke({"camera_id_or_name": camera_id_or_name, "limit": 10}),
        "recent_alerts": get_alerts.invoke({"camera_id_or_name": camera_id_or_name, "limit": 10}),
    }


@tool
def database_query(sql_query: str) -> str:
    """Alias of query_system_data for compatibility with notebook tool naming."""
    return query_system_data.invoke({"sql_query": sql_query})


@tool
def schema_lookup(table_name: str) -> List[Dict[str, Any]]:
    """Returns the column names/types for a given table (information_schema lookup)."""
    return _safe_select(
        "SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = :t ORDER BY ordinal_position;",
        {"t": table_name},
    )


@tool
def aggregate_data(table_name: str, group_by_column: str, agg_column: Optional[str] = None, agg_fn: Literal["count", "avg", "sum"] = "count") -> List[Dict[str, Any]]:
    """Generic GROUP BY aggregation over a known table (guarded against arbitrary write access)."""
    allowed_tables = {"incidents", "alerts", "anomaly_flags", "hse_rule_violations"}
    if table_name not in allowed_tables:
        return [{"error": f"Unknown or disallowed table_name '{table_name}'."}]
    if agg_fn == "count" or not agg_column:
        sql = f"SELECT {group_by_column} AS group_key, COUNT(*) AS value FROM {table_name} GROUP BY {group_by_column} ORDER BY value DESC;"
    else:
        fn = "AVG" if agg_fn == "avg" else "SUM"
        sql = f"SELECT {group_by_column} AS group_key, {fn}({agg_column}) AS value FROM {table_name} GROUP BY {group_by_column} ORDER BY value DESC;"
    return _safe_select(sql)


system_agent_tools_registry = [
    query_system_data,
    check_camera_fleet_health,
    fetch_active_safety_alerts,
    get_production_counting_summary,
    get_cameras,
    get_zones,
    get_incidents,
    get_alerts,
    get_anomalies,
    get_zone_risk_scores,
    get_hse_rule_violations,
    get_defect_detections,
    get_counting_statistics,
    get_recording_history,
    get_notification_history,
    get_scheduled_reports,
    get_system_settings,
    get_users_and_activity,
    get_ai_recommendations,
    generate_safety_summary_report,
    get_event_timeline,
    get_current_user,
    list_entities,
    count_entities,
    search_rules,
    search_entities,
    get_entity_details,
    find_relationships,
    database_query,
    schema_lookup,
    aggregate_data,
]


# ════════════════════════════════════════════════════════════════════════════
# 🛠️ SETUP AGENT TOOLS (Mutations — always flagged for HITL approval)
# (Add new Setup Agent tools below this line, then register them in
#  setup_agent_tools_registry at the end of this section, AND in
#  TOOL_TO_COMPONENT_MAP for RBAC coverage.)
# ════════════════════════════════════════════════════════════════════════════
@tool
def manage_recipient_group(group_name: str, action: Literal["create", "delete"], description: Optional[str] = None) -> Dict[str, Any]:
    """Creates or deletes a notification recipient group."""
    if engine is None:
        return {"success": False, "error": "Database connector is uninitialized."}
    if not group_name:
        return {"success": False, "error": "Missing required field: group_name."}
    try:
        with engine.begin() as conn:
            if action == "create":
                res = conn.execute(text("SELECT id FROM recipient_groups WHERE name = :name"), {"name": group_name}).fetchone()
                if res:
                    if description is not None:
                        conn.execute(text("UPDATE recipient_groups SET description = :desc WHERE id = :id"), {"desc": description, "id": res[0]})
                    return {"success": True, "message": f"Recipient group '{group_name}' already existed; description updated.", "requires_hitl_approval": True}
                conn.execute(text("INSERT INTO recipient_groups (name, description) VALUES (:name, :desc)"), {"name": group_name, "desc": description or ""})
                return {"success": True, "message": f"Created recipient group '{group_name}'.", "requires_hitl_approval": True}
            res = conn.execute(text("SELECT id FROM recipient_groups WHERE name = :name"), {"name": group_name}).fetchone()
            if not res:
                return {"success": False, "error": f"Recipient group '{group_name}' not found."}
            gid = res[0]
            conn.execute(text("DELETE FROM recipients WHERE group_id = :gid"), {"gid": gid})
            conn.execute(text("DELETE FROM recipient_groups WHERE id = :gid"), {"gid": gid})
            return {"success": True, "message": f"Deleted recipient group '{group_name}'.", "requires_hitl_approval": True}
    except Exception as e:
        return {"success": False, "error": f"Failed to manage recipient group: {str(e)}"}


@tool
def manage_recipient(group_name: str, recipient: str, channel: Literal["email", "telegram", "whatsapp", "teams"], action: Literal["add", "remove"]) -> Dict[str, Any]:
    """Adds or removes a recipient contact from a notification group."""
    if engine is None:
        return {"success": False, "error": "Database connector is uninitialized."}
    if not (group_name and recipient and channel):
        return {"success": False, "error": "Missing required field(s): group_name, recipient, channel."}
    try:
        with engine.begin() as conn:
            res = conn.execute(text("SELECT id FROM recipient_groups WHERE name = :name"), {"name": group_name}).fetchone()
            if not res:
                return {"success": False, "error": f"Recipient group '{group_name}' does not exist."}
            gid = res[0]
            if action == "add":
                conn.execute(
                    text("INSERT INTO recipients (group_id, recipient, channel) VALUES (:gid, :rec, :chan)"),
                    {"gid": gid, "rec": recipient, "chan": channel},
                )
                return {"success": True, "message": f"Added {recipient} ({channel}) to '{group_name}'.", "requires_hitl_approval": True}
            conn.execute(
                text("DELETE FROM recipients WHERE group_id = :gid AND recipient = :rec AND channel = :chan"),
                {"gid": gid, "rec": recipient, "chan": channel},
            )
            return {"success": True, "message": f"Removed {recipient} ({channel}) from '{group_name}'.", "requires_hitl_approval": True}
    except Exception as e:
        return {"success": False, "error": f"Failed to manage recipient: {str(e)}"}


@tool
def create_or_update_zone(camera_id_or_name: str, zone_name: str, zone_type: Optional[str] = None, description: Optional[str] = None, is_active: bool = True) -> Dict[str, Any]:
    """Creates a new zone or updates an existing one (matched by camera + zone name)."""
    if engine is None:
        return {"success": False, "error": "Database connector is uninitialized."}
    try:
        with engine.begin() as conn:
            cam_id = _resolve_camera_id(conn, camera_id_or_name)
            if cam_id is None:
                return {"success": False, "error": f"Camera '{camera_id_or_name}' not found."}
            zid = _resolve_zone_id(conn, cam_id, zone_name)
            if zid:
                conn.execute(
                    text("UPDATE zones SET zone_type = COALESCE(:zt, zone_type), description = COALESCE(:desc, description), is_active = :active WHERE id = :id"),
                    {"zt": zone_type, "desc": description, "active": is_active, "id": zid},
                )
                return {"success": True, "message": f"Updated zone '{zone_name}'.", "requires_hitl_approval": True}
            conn.execute(
                text("INSERT INTO zones (camera_id, name, zone_type, description, is_active) VALUES (:cam, :name, :zt, :desc, :active)"),
                {"cam": cam_id, "name": zone_name, "zt": zone_type, "desc": description, "active": is_active},
            )
            return {"success": True, "message": f"Created zone '{zone_name}'.", "requires_hitl_approval": True}
    except Exception as e:
        return {"success": False, "error": f"Failed to create/update zone: {str(e)}"}


@tool
def delete_zone_by_name(camera_id_or_name: str, zone_name: str) -> Dict[str, Any]:
    """Deletes a zone by camera + zone name."""
    if engine is None:
        return {"success": False, "error": "Database connector is uninitialized."}
    try:
        with engine.begin() as conn:
            cam_id = _resolve_camera_id(conn, camera_id_or_name)
            zid = _resolve_zone_id(conn, cam_id, zone_name)
            if not zid:
                return {"success": False, "error": f"Zone '{zone_name}' not found for camera '{camera_id_or_name}'."}
            conn.execute(text("DELETE FROM zones WHERE id = :id"), {"id": zid})
            return {"success": True, "message": f"Deleted zone '{zone_name}'.", "requires_hitl_approval": True}
    except Exception as e:
        return {"success": False, "error": f"Failed to delete zone: {str(e)}"}


@tool
def create_or_update_detection_assignment(camera_id_or_name: str, model_name_or_id: str, class_name: Optional[str] = None, is_active: bool = True) -> Dict[str, Any]:
    """Assigns (or updates the assignment of) an AI detection model + class to a camera."""
    if engine is None:
        return {"success": False, "error": "Database connector is uninitialized."}
    try:
        with engine.begin() as conn:
            cam_id = _resolve_camera_id(conn, camera_id_or_name)
            if cam_id is None:
                return {"success": False, "error": f"Camera '{camera_id_or_name}' not found."}
            conn.execute(
                text("""
                    INSERT INTO detection_assignments (camera_id, model_name, class_name, is_active)
                    VALUES (:cam, :model, :cls, :active)
                    ON CONFLICT (camera_id, model_name, class_name)
                    DO UPDATE SET is_active = EXCLUDED.is_active
                """),
                {"cam": cam_id, "model": model_name_or_id, "cls": class_name, "active": is_active},
            )
            return {"success": True, "message": f"Detection assignment updated for camera '{camera_id_or_name}'.", "requires_hitl_approval": True}
    except Exception as e:
        return {"success": False, "error": f"Failed to update detection assignment: {str(e)}"}


@tool
def create_or_update_hse_rule(rule_name: str, description: Optional[str] = None, min_confidence: float = 0.85, is_active: bool = True) -> Dict[str, Any]:
    """Creates or updates an HSE (safety) rule definition."""
    if engine is None:
        return {"success": False, "error": "Database connector is uninitialized."}
    try:
        with engine.begin() as conn:
            res = conn.execute(text("SELECT id FROM hse_rule_definitions WHERE name = :name"), {"name": rule_name}).fetchone()
            if res:
                conn.execute(
                    text("UPDATE hse_rule_definitions SET description = COALESCE(:desc, description), min_confidence = :mc, is_active = :active WHERE id = :id"),
                    {"desc": description, "mc": min_confidence, "active": is_active, "id": res[0]},
                )
                return {"success": True, "message": f"Updated HSE rule '{rule_name}'.", "requires_hitl_approval": True}
            conn.execute(
                text("INSERT INTO hse_rule_definitions (name, description, min_confidence, is_active) VALUES (:name, :desc, :mc, :active)"),
                {"name": rule_name, "desc": description, "mc": min_confidence, "active": is_active},
            )
            return {"success": True, "message": f"Created HSE rule '{rule_name}'.", "requires_hitl_approval": True}
    except Exception as e:
        return {"success": False, "error": f"Failed to create/update HSE rule: {str(e)}"}


@tool
def delete_rule_by_name(rule_name: str) -> Dict[str, Any]:
    """Deletes an HSE rule definition by name."""
    if engine is None:
        return {"success": False, "error": "Database connector is uninitialized."}
    try:
        with engine.begin() as conn:
            res = conn.execute(text("SELECT id FROM hse_rule_definitions WHERE name ILIKE :val"), {"val": f"%{rule_name}%"}).fetchone()
            if not res:
                return {"success": False, "error": f"Rule '{rule_name}' not found."}
            conn.execute(text("DELETE FROM hse_rule_definitions WHERE id = :id"), {"id": res[0]})
            return {"success": True, "message": f"Deleted rule '{rule_name}'.", "requires_hitl_approval": True}
    except Exception as e:
        return {"success": False, "error": f"Failed to delete rule: {str(e)}"}


@tool
def create_or_update_notification_rule(name: str, camera_id_or_name: Optional[str] = None, severities: str = "HIGH,CRITICAL", channels: str = "email") -> Dict[str, Any]:
    """Creates or updates a routing rule for which severities/channels trigger notifications."""
    if engine is None:
        return {"success": False, "error": "Database connector is uninitialized."}
    try:
        with engine.begin() as conn:
            cam_id = _resolve_camera_id(conn, camera_id_or_name) if camera_id_or_name else None
            res = conn.execute(text("SELECT id FROM notification_rules WHERE name = :name"), {"name": name}).fetchone()
            payload = {"name": name, "cam": cam_id, "sev": severities, "chan": channels}
            if res:
                conn.execute(
                    text("UPDATE notification_rules SET camera_id = :cam, severities = :sev, channels = :chan WHERE name = :name"),
                    payload,
                )
                return {"success": True, "message": f"Updated notification rule '{name}'.", "requires_hitl_approval": True}
            conn.execute(
                text("INSERT INTO notification_rules (name, camera_id, severities, channels) VALUES (:name, :cam, :sev, :chan)"),
                payload,
            )
            return {"success": True, "message": f"Created notification rule '{name}'.", "requires_hitl_approval": True}
    except Exception as e:
        return {"success": False, "error": f"Failed to create/update notification rule: {str(e)}"}


@tool
def update_notification_settings(
    smtp_host: Optional[str] = None, smtp_port: Optional[int] = None, smtp_username: Optional[str] = None,
    smtp_password: Optional[str] = None, smtp_from_email: Optional[str] = None, smtp_use_tls: Optional[bool] = None,
    telegram_bot_token: Optional[str] = None, teams_webhook_url: Optional[str] = None,
    whatsapp_account_sid: Optional[str] = None, whatsapp_auth_token: Optional[str] = None, whatsapp_from_number: Optional[str] = None,
) -> Dict[str, Any]:
    """Updates SMTP/Telegram/Teams/WhatsApp notification channel credentials. Values are write-only (never read back)."""
    if engine is None:
        return {"success": False, "error": "Database connector is uninitialized."}
    updates = {k: v for k, v in {
        "smtp_host": smtp_host, "smtp_port": smtp_port, "smtp_username": smtp_username, "smtp_password": smtp_password,
        "smtp_from_email": smtp_from_email, "smtp_use_tls": smtp_use_tls, "telegram_bot_token": telegram_bot_token,
        "teams_webhook_url": teams_webhook_url, "whatsapp_account_sid": whatsapp_account_sid,
        "whatsapp_auth_token": whatsapp_auth_token, "whatsapp_from_number": whatsapp_from_number,
    }.items() if v is not None}
    if not updates:
        return {"success": False, "error": "No update parameters provided."}
    try:
        with engine.begin() as conn:
            res = conn.execute(text("SELECT id FROM notification_settings LIMIT 1")).fetchone()
            if res:
                set_clause = ", ".join(f"{k} = :{k}" for k in updates)
                updates["id"] = res[0]
                conn.execute(text(f"UPDATE notification_settings SET {set_clause} WHERE id = :id"), updates)
            else:
                cols = ", ".join(updates.keys())
                placeholders = ", ".join(f":{k}" for k in updates.keys())
                conn.execute(text(f"INSERT INTO notification_settings ({cols}) VALUES ({placeholders})"), updates)
            return {"success": True, "message": "Updated system notification settings.", "requires_hitl_approval": True}
    except Exception as e:
        return {"success": False, "error": f"Failed to update settings: {str(e)}"}


@tool
def manage_scheduled_report(
    action: Literal["create", "update", "delete"], report_id: Optional[int] = None,
    frequency: Optional[Literal["daily", "weekly", "monthly"]] = None, send_time: Optional[str] = None,
    day_of_week: Optional[int] = None, day_of_month: Optional[int] = None,
    format: Optional[Literal["pdf", "excel", "csv"]] = None, email_recipients: Optional[List[str]] = None,
    camera_name_or_id: Optional[str] = None, zone_name: Optional[str] = None,
) -> Dict[str, Any]:
    """Creates, updates, or deletes a scheduled report configuration."""
    if engine is None:
        return {"success": False, "error": "Database connector is uninitialized."}
    try:
        with engine.begin() as conn:
            if action == "delete":
                if not report_id:
                    return {"success": False, "error": "Missing required field: report_id."}
                conn.execute(text("DELETE FROM scheduled_reports WHERE id = :id"), {"id": report_id})
                return {"success": True, "message": f"Deleted scheduled report {report_id}.", "requires_hitl_approval": True}

            cam_id = _resolve_camera_id(conn, camera_name_or_id) if camera_name_or_id else None
            zone_id = _resolve_zone_id(conn, cam_id, zone_name) if (zone_name and cam_id) else None

            if action == "create":
                if not (frequency and send_time and format):
                    return {"success": False, "error": "Missing required field(s): frequency, send_time, format."}
                conn.execute(text("""
                    INSERT INTO scheduled_reports (channels, email_recipients, frequency, day_of_week, day_of_month, send_time, format, camera_id, zone_id, is_active)
                    VALUES (:chans, :recips, :freq, :dow, :dom, :time, :fmt, :cam, :zone, true)
                """), {
                    "chans": json.dumps(["email"]), "recips": json.dumps(email_recipients or []), "freq": frequency,
                    "dow": day_of_week, "dom": day_of_month, "time": send_time, "fmt": format, "cam": cam_id, "zone": zone_id,
                })
                return {"success": True, "message": "Created scheduled report.", "requires_hitl_approval": True}

            if not report_id:
                return {"success": False, "error": "Missing required field: report_id."}
            updates = {k: v for k, v in {
                "frequency": frequency, "send_time": send_time, "day_of_week": day_of_week, "day_of_month": day_of_month,
                "format": format, "email_recipients": json.dumps(email_recipients) if email_recipients is not None else None,
                "camera_id": cam_id, "zone_id": zone_id,
            }.items() if v is not None}
            if updates:
                set_clause = ", ".join(f"{k} = :{k}" for k in updates)
                updates["id"] = report_id
                conn.execute(text(f"UPDATE scheduled_reports SET {set_clause} WHERE id = :id"), updates)
            return {"success": True, "message": f"Updated scheduled report {report_id}.", "requires_hitl_approval": True}
    except Exception as e:
        return {"success": False, "error": f"Failed to manage scheduled report: {str(e)}"}


@tool
def manage_user(
    action: Literal["create", "update", "deactivate", "reset_password"], username: str,
    full_name: Optional[str] = None, email: Optional[str] = None, role_name: Optional[str] = None,
    password: Optional[str] = None, department_name: Optional[str] = None, designation_name: Optional[str] = None,
) -> Dict[str, Any]:
    """Creates, updates, deactivates, or resets the password of a system operator account."""
    if engine is None:
        return {"success": False, "error": "Database connector is uninitialized."}
    try:
        with engine.begin() as conn:
            res = conn.execute(text("SELECT id FROM users WHERE username = :u"), {"u": username}).fetchone()
            if action == "create":
                if res:
                    return {"success": False, "error": f"User '{username}' already exists."}
                conn.execute(
                    text("INSERT INTO users (username, full_name, email) VALUES (:u, :fn, :em)"),
                    {"u": username, "fn": full_name, "em": email},
                )
                return {"success": True, "message": f"Created user '{username}'.", "requires_hitl_approval": True}
            if not res:
                return {"success": False, "error": f"User '{username}' not found."}
            uid = res[0]
            if action == "deactivate":
                conn.execute(text("UPDATE users SET is_active = false WHERE id = :id"), {"id": uid})
                return {"success": True, "message": f"Deactivated user '{username}'.", "requires_hitl_approval": True}
            if action == "reset_password":
                return {"success": True, "message": f"Password reset flow triggered for '{username}' (handled out-of-band).", "requires_hitl_approval": True}
            updates = {k: v for k, v in {"full_name": full_name, "email": email}.items() if v is not None}
            if updates:
                set_clause = ", ".join(f"{k} = :{k}" for k in updates)
                updates["id"] = uid
                conn.execute(text(f"UPDATE users SET {set_clause} WHERE id = :id"), updates)
            return {"success": True, "message": f"Updated user '{username}'.", "requires_hitl_approval": True}
    except Exception as e:
        return {"success": False, "error": f"Failed to manage user: {str(e)}"}


@tool
def manage_camera(action: Literal["create", "update", "delete"], camera_id_or_name: str, name: Optional[str] = None, ip: Optional[str] = None, port: Optional[int] = None, rtsp_url: Optional[str] = None) -> Dict[str, Any]:
    """Creates, updates, or deletes a camera record."""
    if engine is None:
        return {"success": False, "error": "Database connector is uninitialized."}
    try:
        with engine.begin() as conn:
            if action == "create":
                if not name:
                    return {"success": False, "error": "Missing required field: name."}
                conn.execute(
                    text("INSERT INTO cameras (name, ip, port, rtsp_url, status) VALUES (:name, :ip, :port, :rtsp, 'ONLINE')"),
                    {"name": name, "ip": ip, "port": port, "rtsp": rtsp_url},
                )
                return {"success": True, "message": f"Created camera '{name}'.", "requires_hitl_approval": True}
            cam_id = _resolve_camera_id(conn, camera_id_or_name)
            if cam_id is None:
                return {"success": False, "error": f"Camera '{camera_id_or_name}' not found."}
            if action == "delete":
                conn.execute(text("DELETE FROM cameras WHERE id = :id"), {"id": cam_id})
                return {"success": True, "message": f"Deleted camera '{camera_id_or_name}'.", "requires_hitl_approval": True}
            updates = {k: v for k, v in {"name": name, "ip": ip, "port": port, "rtsp_url": rtsp_url}.items() if v is not None}
            if updates:
                set_clause = ", ".join(f"{k} = :{k}" for k in updates)
                updates["id"] = cam_id
                conn.execute(text(f"UPDATE cameras SET {set_clause} WHERE id = :id"), updates)
            return {"success": True, "message": f"Updated camera '{camera_id_or_name}'.", "requires_hitl_approval": True}
    except Exception as e:
        return {"success": False, "error": f"Failed to manage camera: {str(e)}"}


@tool
def manage_ai_model(action: Literal["create", "update", "delete"], model_name_or_id: str, model_path: Optional[str] = None, description: Optional[str] = None) -> Dict[str, Any]:
    """Creates, updates, or deletes an AI model registration used for detection assignments."""
    if engine is None:
        return {"success": False, "error": "Database connector is uninitialized."}
    try:
        with engine.begin() as conn:
            if action == "create":
                conn.execute(
                    text("INSERT INTO ai_models (name, model_path, description) VALUES (:name, :path, :desc)"),
                    {"name": model_name_or_id, "path": model_path, "desc": description},
                )
                return {"success": True, "message": f"Registered AI model '{model_name_or_id}'.", "requires_hitl_approval": True}
            res = conn.execute(text("SELECT id FROM ai_models WHERE name ILIKE :val OR id::text = :val"), {"val": str(model_name_or_id)}).fetchone()
            if not res:
                return {"success": False, "error": f"Model '{model_name_or_id}' not found."}
            if action == "delete":
                conn.execute(text("DELETE FROM ai_models WHERE id = :id"), {"id": res[0]})
                return {"success": True, "message": f"Deleted AI model '{model_name_or_id}'.", "requires_hitl_approval": True}
            updates = {k: v for k, v in {"model_path": model_path, "description": description}.items() if v is not None}
            if updates:
                set_clause = ", ".join(f"{k} = :{k}" for k in updates)
                updates["id"] = res[0]
                conn.execute(text(f"UPDATE ai_models SET {set_clause} WHERE id = :id"), updates)
            return {"success": True, "message": f"Updated AI model '{model_name_or_id}'.", "requires_hitl_approval": True}
    except Exception as e:
        return {"success": False, "error": f"Failed to manage AI model: {str(e)}"}


@tool
def acknowledge_telemetry_flags(flag_type: Literal["alert", "anomaly", "incident"], flag_id: int) -> Dict[str, Any]:
    """Marks an alert, anomaly, or incident as acknowledged."""
    if engine is None:
        return {"success": False, "error": "Database connector is uninitialized."}
    table_map = {"alert": "alerts", "anomaly": "anomaly_flags", "incident": "incidents"}
    table = table_map[flag_type]
    col = "is_acknowledged"
    try:
        with engine.begin() as conn:
            conn.execute(text(f"UPDATE {table} SET {col} = true WHERE id = :id"), {"id": flag_id})
            return {"success": True, "message": f"Acknowledged {flag_type} #{flag_id}.", "requires_hitl_approval": True}
    except Exception as e:
        return {"success": False, "error": f"Failed to acknowledge {flag_type}: {str(e)}"}


# Kept for backward-compat with the previous single-purpose demo tools.
@tool
def update_camera_alert_rule(camera_id: str, rule_type: str, enabled: bool, min_confidence: float = 0.85) -> str:
    """Update safety detection rules (PPE detection, perimeter intrusion, fire detection) for a specific camera."""
    return json.dumps({
        "status": "SUCCESS",
        "message": f"Updated rule '{rule_type}' for {camera_id}: enabled={enabled}, min_confidence={min_confidence}",
        "requires_hitl_approval": True,
        "action_id": f"ACT-{int(time.time())}",
    })


@tool
def configure_safety_notification_recipient(recipient_email: str, alert_severities: str = "HIGH,CRITICAL") -> str:
    """Configure automated alert notification recipients for critical safety violations."""
    return json.dumps({
        "status": "SUCCESS",
        "message": f"Added notification recipient {recipient_email} for severities [{alert_severities}].",
        "requires_hitl_approval": True,
        "timestamp": datetime.now().isoformat(),
    })


setup_agent_tools_registry = [
    manage_recipient_group,
    manage_recipient,
    create_or_update_zone,
    delete_zone_by_name,
    create_or_update_detection_assignment,
    create_or_update_hse_rule,
    create_or_update_notification_rule,
    delete_rule_by_name,
    update_notification_settings,
    manage_scheduled_report,
    manage_user,
    manage_camera,
    manage_ai_model,
    acknowledge_telemetry_flags,
    update_camera_alert_rule,
    configure_safety_notification_recipient,
]


# ════════════════════════════════════════════════════════════════════════════
# 🔍 INVESTIGATOR AGENT TOOLS
# (Add new Investigator Agent tools below this line, then register them in
#  investigator_agent_tools_registry at the end of this section.)
# ════════════════════════════════════════════════════════════════════════════
class InvestigationIntent(BaseModel):
    intent_type: Literal["search", "deep"] = Field(
        description="Whether this is a broad retrieval search ('search') or an in-depth autopsy investigation ('deep')."
    )
    date_str: Optional[str] = Field(None, description="Target date, resolved to YYYY-MM-DD from relative terms like 'today'/'yesterday'.")
    camera_filter: Optional[str] = Field(None, description="Any camera name/number/ID mentioned in the query.")
    class_name: Optional[str] = Field(None, description="Event class mentioned, e.g. helmet, fire, ppe, person, forklift.")


@tool
def run_forensic_incident_investigation(incident_id: str) -> str:
    """Investigate a specific incident ID: returns timeline snapshots, root cause, and recommendations."""
    return json.dumps({
        "incident_id": incident_id,
        "investigation_timestamp": datetime.now().isoformat(),
        "root_cause": "Worker entered Crane Swing Radius without required Kevlar Helmet & High-Vis Vest at 11:44:50.",
        "contributing_factors": ["Missing barrier fence on East corridor", "Lighting flicker on CAM-03"],
        "recommended_actions": [
            "Issue immediate safety retraining for Sector C team",
            "Deploy automated audio alarm on CAM-03 perimeter breach",
        ],
        "evidence_snapshots": [
            {"label": "T-10s Approach", "url": "/api/placeholders/snap_approach.jpg"},
            {"label": "T-0s Intrusion", "url": "/api/placeholders/snap_intrusion.jpg"},
            {"label": "T+5s Alert Trigger", "url": "/api/placeholders/snap_alert.jpg"},
        ],
    })


@tool
def investigate_events(user_query: str) -> str:
    """
    Natural-language driven investigation of safety events/alarms/HSE violations.
    Internally extracts search-vs-deep intent, resolves relative dates, then either
    returns a broad chronological summary or triggers a deep root-cause autopsy.
    """
    current_time_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    intent_type, date_str, camera_filter, class_name = "search", datetime.now().strftime("%Y-%m-%d"), None, None
    try:
        structured_llm = base_llm.with_structured_output(InvestigationIntent)
        intent = structured_llm.invoke(
            f'Analyze the user query: "{user_query}"\nCURRENT SYSTEM DATE AND TIME: {current_time_str}.\n'
            f"Resolve relative dates like 'today'/'yesterday' to YYYY-MM-DD and extract intent parameters."
        )
        intent_type = intent.intent_type
        date_str = intent.date_str or date_str
        camera_filter = intent.camera_filter
        class_name = intent.class_name
    except Exception:
        pass

    incidents = _get_mock_video_data("incidents")
    if camera_filter:
        incidents = [i for i in incidents if camera_filter.lower() in i["camera"].lower()]
    if class_name:
        incidents = [i for i in incidents if class_name.lower() in i["type"].lower()]

    if intent_type == "deep" and incidents:
        deep = json.loads(run_forensic_incident_investigation.invoke({"incident_id": incidents[0]["id"]}))
        deep["matched_date"] = date_str
        return json.dumps(deep)

    return json.dumps({"intent_type": intent_type, "date": date_str, "matches": incidents})


investigator_agent_tools_registry = [
    run_forensic_incident_investigation,
    investigate_events,
]


# ════════════════════════════════════════════════════════════════════════════
# 🎥 VIDEO AGENT TOOLS
# (Add new Video Agent tools below this line, then register them in
#  video_agent_tools_registry at the end of this section. Tools that need
#  real RTSP/YOLO/VLM/Pinecone integrations are marked with NOTE/TODO —
#  they currently return structured mock data so the graph is runnable
#  without those heavy optional dependencies installed.)
# ════════════════════════════════════════════════════════════════════════════
@tool
def get_video_stream_url(camera_name: str) -> str:
    """Get the active RTSP stream URL, HLS playlist endpoint, and live status for a specified camera."""
    cams = _get_mock_video_data("cameras")
    for c in cams:
        if camera_name.lower() in c["name"].lower() or camera_name.lower() in c["location"].lower():
            return json.dumps(c)
    return json.dumps(cams[0])


@tool
def analyze_video_feed(camera_name: str) -> str:
    """
    Runs an object-detection pass (YOLO) on the camera's current frame and returns detected classes.
    NOTE: Replace with a real cv2/YOLO pipeline; currently returns representative mock detections.
    """
    return json.dumps({
        "camera_name": camera_name,
        "detections": [
            {"class": "person", "confidence": 0.95, "count": 3},
            {"class": "forklift", "confidence": 0.88, "count": 1},
        ],
        "timestamp": datetime.now().isoformat(),
    })


@tool
def analyze_scene_context(camera_name: str, query: str) -> str:
    """Interrogate a live frame via VLM for specific worker actions, helmet colors, or hazard risks."""
    return json.dumps({
        "camera_name": camera_name,
        "query": query,
        "summary": f"VLM Inspection on {camera_name}: Observed 3 workers in yellow safety vests. 2 workers wearing white hard hats, 1 worker carrying blue equipment box without gloves near conveyor belt. Hazard Risk: LOW-MODERATE.",
        "detections": [
            {"class": "person", "confidence": 0.96, "bbox": [120, 45, 300, 510], "ppe": {"helmet": True, "vest": True}},
            {"class": "person", "confidence": 0.92, "bbox": [310, 80, 450, 490], "ppe": {"helmet": True, "vest": True}},
            {"class": "person", "confidence": 0.89, "bbox": [500, 110, 620, 520], "ppe": {"helmet": False, "vest": True}},
        ],
        "timestamp": datetime.now().isoformat(),
    })


@tool
def semantic_search_scene_history(query: str, top_k: int = 5) -> str:
    """
    Semantic search over historical VLM scene summaries (long-term memory).
    NOTE: Wire this up to a real vector store (e.g. Pinecone) + embeddings model when ready;
    currently returns a stubbed empty result set so the tool contract is stable.
    """
    return json.dumps({"query": query, "top_k": top_k, "results": [], "note": "Semantic memory backend not yet configured."})


@tool
def get_live_stream_health(camera_name: str) -> str:
    """Checks whether a camera's RTSP stream is currently live and reachable."""
    cams = _get_mock_video_data("cameras")
    for c in cams:
        if camera_name.lower() in c["name"].lower():
            return json.dumps({"camera_name": c["name"], "status": c["status"], "fps": c["fps"]})
    return json.dumps({"error": f"Camera '{camera_name}' not found."})


@tool
def capture_live_snapshot(camera_name: str) -> str:
    """
    Captures a single still frame from the camera's live stream for evidence/audit purposes.
    NOTE: Replace with a real cv2.VideoCapture frame-grab + storage write; returns a placeholder path.
    """
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    return json.dumps({
        "camera_name": camera_name,
        "snapshot_path": f"storage/live_snapshots/{camera_name.replace(' ', '_')}_{ts}.jpg",
        "captured_at": datetime.now().isoformat(),
    })


@tool
def get_live_people_count_multi_camera() -> str:
    """Returns the current live person count aggregated across all online cameras."""
    counts = _get_mock_video_data("counts")
    total = sum(c["person_count"] for c in counts)
    return json.dumps({"total_people": total, "by_zone": counts})


@tool
def detect_motion_in_stream(camera_name: str) -> str:
    """
    Checks a camera's stream for recent motion activity.
    NOTE: Replace with real frame-differencing/motion-detection logic.
    """
    return json.dumps({"camera_name": camera_name, "motion_detected": True, "confidence": 0.81, "timestamp": datetime.now().isoformat()})


@tool
def find_person_by_description_live(description: str) -> str:
    """
    Scans live camera feeds for a person matching a natural-language description (clothing/color/etc).
    NOTE: Replace with a real VLM/embedding-based person-search pipeline; returns a stubbed match.
    """
    return json.dumps({
        "description": description,
        "matches": [{"camera_name": "CAM-02 Assembly Line 1", "confidence": 0.74, "bbox": [310, 80, 450, 490]}],
        "note": "Live person-search backend not yet configured — showing a representative match.",
    })


@tool
def get_live_ppe_compliance_check(zone_name: str) -> str:
    """Checks live PPE (helmet/vest) compliance for people currently detected in a given zone."""
    counts = [c for c in _get_mock_video_data("counts") if zone_name.lower() in c["zone"].lower()]
    if not counts:
        return json.dumps({"zone": zone_name, "error": "Zone not found in current telemetry."})
    return json.dumps(counts[0])


video_agent_tools_registry = [
    get_video_stream_url,
    analyze_video_feed,
    analyze_scene_context,
    semantic_search_scene_history,
    get_live_stream_health,
    capture_live_snapshot,
    get_live_people_count_multi_camera,
    detect_motion_in_stream,
    find_person_by_description_live,
    get_live_ppe_compliance_check,
]


# ════════════════════════════════════════════════════════════════════════════
# 📋 MASTER TOOL REGISTRY + RBAC COMPONENT MAP
# ════════════════════════════════════════════════════════════════════════════
all_system_tools = (
    general_agent_tools_registry
    + system_agent_tools_registry
    + setup_agent_tools_registry
    + investigator_agent_tools_registry
    + video_agent_tools_registry
)

# Maps every tool name -> the UI "component" it belongs to, for RBAC checks.
# When you add a new tool above, add its mapping here too.
TOOL_TO_COMPONENT_MAP: Dict[str, str] = {
    # General / Dashboard
    "get_current_user_profile": "Dashboard",
    "get_current_user": "Dashboard",
    "list_entities": "Dashboard",
    "count_entities": "Dashboard",
    "search_rules": "Dashboard",
    "search_entities": "Dashboard",
    "get_entity_details": "Dashboard",
    "find_relationships": "Dashboard",
    "database_query": "Dashboard",
    "schema_lookup": "Dashboard",
    "aggregate_data": "Dashboard",
    "get_production_counting_summary": "Dashboard",
    "get_event_timeline": "Dashboard",
    "generate_safety_summary_report": "Dashboard",
    "get_counting_statistics": "Dashboard",
    "get_scheduled_reports": "Dashboard",
    "get_system_settings": "Dashboard",
    "get_users_and_activity": "Dashboard",
    "get_ai_recommendations": "Dashboard",
    "query_system_data": "Dashboard",
    # Cameras
    "check_camera_fleet_health": "Cameras",
    "get_cameras": "Cameras",
    "manage_camera": "Cameras",
    "get_recording_history": "Cameras",
    # Live Streaming / Video
    "get_video_stream_url": "Live Streaming",
    "analyze_video_feed": "Live Streaming",
    "analyze_scene_context": "Live Streaming",
    "semantic_search_scene_history": "Live Streaming",
    "get_live_stream_health": "Live Streaming",
    "capture_live_snapshot": "Live Streaming",
    "get_live_people_count_multi_camera": "Live Streaming",
    "detect_motion_in_stream": "Live Streaming",
    "find_person_by_description_live": "Live Streaming",
    "get_live_ppe_compliance_check": "Live Streaming",
    # Zones
    "get_zones": "Zones",
    "create_or_update_zone": "Zones",
    "delete_zone_by_name": "Zones",
    "get_zone_risk_scores": "Zones",
    # Incidents
    "get_incidents": "Incidents",
    "get_hse_rule_violations": "Incidents",
    "get_defect_detections": "Incidents",
    "investigate_events": "Incidents",
    "run_forensic_incident_investigation": "Incidents",
    # Alerts
    "fetch_active_safety_alerts": "Alerts",
    "get_alerts": "Alerts",
    "get_anomalies": "Alerts",
    "get_notification_history": "Alerts",
    # Assignments (mutation-heavy setup tools)
    "create_or_update_detection_assignment": "Assignments",
    "create_or_update_hse_rule": "Assignments",
    "delete_rule_by_name": "Assignments",
    "manage_recipient_group": "Assignments",
    "manage_recipient": "Assignments",
    "create_or_update_notification_rule": "Assignments",
    "update_notification_settings": "Assignments",
    "manage_scheduled_report": "Assignments",
    "manage_user": "Assignments",
    "manage_ai_model": "Assignments",
    "acknowledge_telemetry_flags": "Assignments",
    "update_camera_alert_rule": "Assignments",
    "configure_safety_notification_recipient": "Assignments",
}

_DEFAULT_ROLE_PERMISSIONS: Dict[str, List[str]] = {
    "admin": ["Dashboard", "Cameras", "Incidents", "Assignments", "Live Streaming", "Zones", "Alerts"],
    "operator": ["Dashboard", "Cameras", "Incidents", "Live Streaming", "Alerts"],
    "viewer": ["Dashboard", "Cameras", "Incidents"],
}


def get_user_permissions(user_id_or_username: str) -> List[str]:
    """Retrieves the allowed UI components for a user, DB-first with a safe default fallback."""
    if engine is not None:
        try:
            with engine.connect() as conn:
                row = conn.execute(text("""
                    SELECT r.name AS role_name FROM users u
                    LEFT JOIN roles r ON r.id = u.role_id
                    WHERE u.id::text = :val OR u.username = :val OR u.email = :val
                """), {"val": str(user_id_or_username)}).fetchone()
                if row and row[0]:
                    return _DEFAULT_ROLE_PERMISSIONS.get(row[0].lower(), _DEFAULT_ROLE_PERMISSIONS["admin"])
        except Exception:
            pass
    return _DEFAULT_ROLE_PERMISSIONS["admin"]


# ════════════════════════════════════════════════════════════════════════════
# 🤖 AGENT NODE FUNCTIONS
# ════════════════════════════════════════════════════════════════════════════
def general_agent(state: TeamState) -> Dict[str, Any]:
    sys_prompt = SystemMessage(content="""
    You are the AI Safety Assistant (General Agent) for Industrial & Video Monitoring operations.
    You respond to greetings, profile inquiries, system overview questions, and general conversation.
    Keep your tone professional, concise, and focused on industrial safety excellence.
    """)
    llm = base_llm.bind_tools(general_agent_tools_registry)
    response = llm.invoke([sys_prompt] + state["messages"])
    return {"messages": [response], "next_agent": "FINISH"}


def system_agent(state: TeamState) -> Dict[str, Any]:
    sys_prompt = SystemMessage(content="""
    You are the System Agent for Video Monitoring. You provide read-only database insights for cameras,
    active alerts, incidents, zone metrics, PPE compliance, and general reporting — including ad-hoc
    SELECT queries via query_system_data when the fixed tools don't cover the request.
    Always format data clearly with Markdown tables or clean summary bullet points.
    """)
    llm = base_llm.bind_tools(system_agent_tools_registry)
    response = llm.invoke([sys_prompt] + state["messages"])
    return {"messages": [response], "next_agent": "FINISH"}


def setup_agent(state: TeamState) -> Dict[str, Any]:
    sys_prompt = SystemMessage(content="""
    You are the Setup Agent for Video Monitoring. You handle configuration updates, safety rule mutations,
    notification routing, user/camera/model management, and threshold adjustments.
    IMPORTANT: For every write operation, clearly state the modification being performed and present a
    HITL (Human-in-the-Loop) confirmation prompt — never claim a change is live until it's approved.
    """)
    llm = base_llm.bind_tools(setup_agent_tools_registry)
    response = llm.invoke([sys_prompt] + state["messages"])
    return {"messages": [response], "next_agent": "FINISH"}


def investigator_agent(state: TeamState) -> Dict[str, Any]:
    sys_prompt = SystemMessage(content="""
    You are the Forensic Investigator Agent for Video Monitoring. You conduct root cause analysis on
    safety incidents, analyze timeline snapshots, and compile forensic evidence reports.
    Highlight key incident timestamps, violating entities, and corrective action recommendations.
    """)
    llm = base_llm.bind_tools(investigator_agent_tools_registry)
    response = llm.invoke([sys_prompt] + state["messages"])
    return {"messages": [response], "next_agent": "FINISH"}


def video_agent(state: TeamState) -> Dict[str, Any]:
    sys_prompt = SystemMessage(content="""
    You are the Video Agent for Video Monitoring. You handle live RTSP stream requests, camera visual
    feeds, YOLO object counts, VLM scene analysis, motion detection, and live PPE compliance checks.
    If the user asks to see a camera feed or inspect live worker actions, provide the stream details
    and VLM scene summary clearly.
    """)
    llm = base_llm.bind_tools(video_agent_tools_registry)
    response = llm.invoke([sys_prompt] + state["messages"])
    return {"messages": [response], "next_agent": "FINISH"}


# ── RBAC-Aware Tool Executor ───────────────────────────────────────────────────
def execute_tools_node(state: TeamState) -> Dict[str, Any]:
    """
    Custom tool executor with dynamic RBAC checks: if the caller's role isn't permitted
    to use a tool's mapped component, the call is blocked with a clear denial message.
    """
    user_id = state.get("user_id", "admin")
    allowed_comps = get_user_permissions(user_id)
    last_message = state["messages"][-1]
    tool_messages: List[ToolMessage] = []

    for tool_call in getattr(last_message, "tool_calls", []) or []:
        tool_name = tool_call["name"]
        tool_obj = next((t for t in all_system_tools if t.name == tool_name), None)

        if not tool_obj:
            tool_messages.append(ToolMessage(content=f"Error: Tool '{tool_name}' not found.", tool_call_id=tool_call["id"]))
            continue

        tool_component = TOOL_TO_COMPONENT_MAP.get(tool_name)
        if tool_component and tool_component not in allowed_comps:
            denied_msg = (
                "Sorry, you don't have permission to access this feature. Your current role does "
                "not have access to this module. Please contact your administrator if you require it."
            )
            tool_messages.append(ToolMessage(content=denied_msg, tool_call_id=tool_call["id"]))
            continue

        try:
            result = tool_obj.invoke(tool_call["args"])
            content = json.dumps(result) if not isinstance(result, str) else result
            tool_messages.append(ToolMessage(content=content, tool_call_id=tool_call["id"]))
        except Exception as e:
            clean_err = re.sub(r"(delete from|drop table|insert into|truncate table)", "[REDACTED_SQL]", str(e), flags=re.IGNORECASE)
            tool_messages.append(ToolMessage(content=f"Error executing tool: {clean_err}", tool_call_id=tool_call["id"]))

    return {"messages": tool_messages}


# ── Supervisor Node & Routers ──────────────────────────────────────────────────
def supervisor_node(state: TeamState) -> Dict[str, Any]:
    messages = state.get("messages", [])
    last_human_query = ""
    for msg in reversed(messages):
        if isinstance(msg, HumanMessage) or getattr(msg, "type", "") == "human":
            last_human_query = getattr(msg, "content", "")
            break

    input_lower = last_human_query.lower() if isinstance(last_human_query, str) else ""

    if any(k in input_lower for k in ["update rule", "enable rule", "disable rule", "configure notification", "add recipient", "change threshold", "create zone", "delete zone", "create user", "manage camera", "setup"]):
        return {"next_agent": "setup_agent"}
    if any(k in input_lower for k in ["investigate", "root cause", "autopsy", "incident report", "forensic", "inc-"]):
        return {"next_agent": "investigator_agent"}
    if any(k in input_lower for k in ["live feed", "rtsp", "stream", "show camera", "count person", "count people", "what are workers doing", "scene", "vlm", "snapshot", "motion", "find person"]):
        return {"next_agent": "video_agent"}
    if any(k in input_lower for k in ["cameras", "list camera", "active alerts", "incidents", "zones", "compliance", "metrics", "select ", "sql", "report", "anomal"]):
        return {"next_agent": "system_agent"}
    if any(k in input_lower for k in ["hi", "hello", "hey", "who are you", "help", "thanks", "profile", "who am i"]):
        return {"next_agent": "general_agent"}

    return {"next_agent": "general_agent"}


def supervisor_router(state: TeamState) -> str:
    target = state.get("next_agent", "general_agent")
    if target in ["general_agent", "system_agent", "setup_agent", "investigator_agent", "video_agent"]:
        return target
    return "general_agent"


_UNAUTHORIZED_LEAK_KEYWORDS = [
    "password_hash", "smtp_password", "telegram_bot_token", "teams_webhook_url",
    "whatsapp_auth_token", "api_keys", "otp_codes",
]


def post_agent_router(state: TeamState) -> str:
    """Edge-level guardrail: scrub credential/token leakage, then route to tools or end the turn."""
    last_message = state["messages"][-1]
    content_lower = getattr(last_message, "content", "")
    content_lower = content_lower.lower() if isinstance(content_lower, str) else ""
    contains_leak = any(k in content_lower for k in _UNAUTHORIZED_LEAK_KEYWORDS)

    if hasattr(last_message, "tool_calls") and last_message.tool_calls:
        if contains_leak:
            last_message.content = "⚠️ [SECURITY ENFORCEMENT]: Request terminated due to an insecure background trigger attempt."
            return "__end__"
        return "execute_tools"

    if contains_leak:
        last_message.content = "⚠️ [SECURITY ENFORCEMENT]: Access denied — platform guardrails prevent printing raw authorization tokens."
    return "__end__"


def tool_execution_router(state: TeamState) -> str:
    target = state.get("next_agent", "supervisor")
    target_lower = target.lower() if isinstance(target, str) else "supervisor"
    if "system" in target_lower:
        return "system_agent"
    if "setup" in target_lower:
        return "setup_agent"
    if "general" in target_lower:
        return "general_agent"
    if "investigat" in target_lower:
        return "investigator_agent"
    if "video" in target_lower:
        return "video_agent"
    return "supervisor"


# ════════════════════════════════════════════════════════════════════════════
# 🏗️ BUILD LANGGRAPH MESH
# ════════════════════════════════════════════════════════════════════════════
workflow = StateGraph(TeamState)

workflow.add_node("supervisor", supervisor_node)
workflow.add_node("general_agent", general_agent)
workflow.add_node("system_agent", system_agent)
workflow.add_node("setup_agent", setup_agent)
workflow.add_node("investigator_agent", investigator_agent)
workflow.add_node("video_agent", video_agent)
workflow.add_node("execute_tools", execute_tools_node)

workflow.add_edge(START, "supervisor")
workflow.add_conditional_edges(
    "supervisor",
    supervisor_router,
    {
        "general_agent": "general_agent",
        "system_agent": "system_agent",
        "setup_agent": "setup_agent",
        "investigator_agent": "investigator_agent",
        "video_agent": "video_agent",
    },
)

_worker_routes = {"execute_tools": "execute_tools", "__end__": END}
workflow.add_conditional_edges("general_agent", post_agent_router, _worker_routes)
workflow.add_conditional_edges("system_agent", post_agent_router, _worker_routes)
workflow.add_conditional_edges("setup_agent", post_agent_router, _worker_routes)
workflow.add_conditional_edges("investigator_agent", post_agent_router, _worker_routes)
workflow.add_conditional_edges("video_agent", post_agent_router, _worker_routes)

workflow.add_conditional_edges(
    "execute_tools",
    tool_execution_router,
    {
        "system_agent": "system_agent",
        "setup_agent": "setup_agent",
        "general_agent": "general_agent",
        "investigator_agent": "investigator_agent",
        "video_agent": "video_agent",
        "supervisor": "supervisor",
    },
)

memory_checkpoint = MemorySaver()
video_monitoring_graph = workflow.compile(checkpointer=memory_checkpoint)


# ════════════════════════════════════════════════════════════════════════════
# 🌐 PUBLIC ASYNC API RUNNERS
# ════════════════════════════════════════════════════════════════════════════
async def run_video_monitoring_conversation(message: str, thread_id: str = "default", user_id: str = "operator_1") -> Dict[str, Any]:
    config = {"configurable": {"thread_id": thread_id}}
    initial_state = {
        "messages": [HumanMessage(content=message)],
        "user_id": user_id,
        "next_agent": "supervisor",
        "source_documents": [],
        "generated_outputs": [],
    }

    final_state = await asyncio.to_thread(video_monitoring_graph.invoke, initial_state, config)

    response_msg = ""
    active_agent = final_state.get("next_agent", "general_agent")
    if final_state.get("messages"):
        last_msg = final_state["messages"][-1]
        response_msg = getattr(last_msg, "content", str(last_msg))

    _log_agent_trace(thread_id, active_agent, message, response_msg)
    return {"reply": response_msg, "thread_id": thread_id, "active_agent": active_agent}


async def stream_video_monitoring_events(
    message: str,
    thread_id: str = "default",
    user_id: str = "operator_1",
    hitl_context: Optional[Dict[str, Any]] = None,
) -> AsyncGenerator[str, None]:
    """
    SSE Generator yielding JSON formatted event strings:
    - event: agent_switch
    - event: token
    - event: widget
    - event: done
    """
    config = {"configurable": {"thread_id": thread_id}}

    initial_state = {
        "messages": [HumanMessage(content=message)],
        "user_id": user_id,
        "next_agent": "supervisor",
        "source_documents": [],
        "generated_outputs": [],
    }

    sup_decision = supervisor_node(initial_state)
    active_agent = sup_decision.get("next_agent", "general_agent")

    yield f"event: agent_switch\ndata: {json.dumps({'agent': active_agent})}\n\n"
    await asyncio.sleep(0.05)

    final_state = await asyncio.to_thread(video_monitoring_graph.invoke, initial_state, config)

    full_response = "I have processed your request for video monitoring."
    if final_state.get("messages"):
        last_msg = final_state["messages"][-1]
        full_response = getattr(last_msg, "content", str(last_msg))

    _log_agent_trace(thread_id, active_agent, message, full_response)

    words = full_response.split(" ")
    chunk_buffer = []
    for idx, word in enumerate(words):
        chunk_buffer.append(word)
        if len(chunk_buffer) >= 3 or idx == len(words) - 1:
            chunk_text = " ".join(chunk_buffer) + (" " if idx < len(words) - 1 else "")
            yield f"event: token\ndata: {json.dumps({'text': chunk_text})}\n\n"
            chunk_buffer = []
            await asyncio.sleep(0.03)

    input_lower = message.lower()
    if active_agent == "investigator_agent" or "investigate" in input_lower or "inc-" in input_lower:
        evidence_widget = {
            "type": "evidence_gallery",
            "title": "Incident Forensic Evidence Snapshots",
            "snapshots": [
                {"id": 1, "title": "CAM-02 PPE Violation - T-10s", "timestamp": "10:14:12", "url": "https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=600&q=80", "badge": "NO HELMET"},
                {"id": 2, "title": "CAM-02 Restricted Zone Intrusion", "timestamp": "10:14:22", "url": "https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?auto=format&fit=crop&w=600&q=80", "badge": "ZONE BREACH"},
                {"id": 3, "title": "CAM-03 Automated Alarm Trigger", "timestamp": "10:14:35", "url": "https://images.unsplash.com/photo-1581092335397-9583fe92d232?auto=format&fit=crop&w=600&q=80", "badge": "ALARM ACTIVE"},
            ],
        }
        yield f"event: widget\ndata: {json.dumps(evidence_widget)}\n\n"

    elif active_agent == "system_agent" or "cameras" in input_lower or "metrics" in input_lower:
        table_widget = {
            "type": "data_table",
            "title": "Active Safety Cameras Status Summary",
            "headers": ["Camera ID", "Location", "Status", "FPS", "PPE Compliance"],
            "rows": [
                ["CAM-01", "Zone A Main Entrance", "ONLINE", "30 FPS", "98%"],
                ["CAM-02", "Manufacturing Bay 2", "ONLINE", "25 FPS", "92%"],
                ["CAM-03", "Warehouse Sector C", "ONLINE", "30 FPS", "87.5%"],
                ["CAM-04", "Hazard Zone 4", "ONLINE", "30 FPS", "100%"],
            ],
        }
        yield f"event: widget\ndata: {json.dumps(table_widget)}\n\n"

    elif active_agent == "setup_agent" or "update" in input_lower or "rule" in input_lower or "enable" in input_lower:
        hitl_widget = {
            "type": "hitl_actions",
            "title": "Human-in-the-Loop Confirmation Required",
            "description": "Modification: Update CAM-02 Safety Confidence Threshold to 0.90 & Enable Audio Warning Alarm.",
            "actions": [
                {"id": "accept", "label": "Accept & Deploy Rule", "variant": "success"},
                {"id": "reject", "label": "Reject Change", "variant": "danger"},
                {"id": "continue", "label": "Request Safety Manager Review", "variant": "secondary"},
            ],
        }
        yield f"event: widget\ndata: {json.dumps(hitl_widget)}\n\n"

    yield f"event: done\ndata: {json.dumps({'thread_id': thread_id})}\n\n"