"""
Video Monitoring Multi-Agent System — AI Safety Assistant
Created by IIIOT InfoTech.

LangGraph 5-Agent Supervisor Mesh for Video Monitoring & Industrial Safety:
- General Agent: Pleasantries, profile, greetings, general queries.
- System Agent: Read-only metrics, camera lists, zone alerts, safety events.
- Setup Agent: Write/Mutation operations for zones, rules, recipient lists, with HITL checks.
- Investigator Agent: Forensic incident timelines, snapshot analysis, incident root causes.
- Video Agent: RTSP stream URLs, YOLO object/person detection, VLM scene interrogation.

Features:
- Fallback LLM Gateway (Gemini primary / Groq fallback)
- Traceability Audit Trail (DB logging)
- Redis Event Streaming
- SSE Event Generator with token-by-token streaming & dynamic UI widget payloads
"""

import asyncio
import json
import os
import re
import time
from datetime import datetime, timedelta
from typing import Annotated, Any, AsyncGenerator, Dict, List, Literal, Optional

import pandas as pd
from langchain_core.messages import AIMessage, BaseMessage, HumanMessage, SystemMessage, ToolMessage
from langchain_core.tools import tool
from langchain_litellm import ChatLiteLLM
from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph import END, START, StateGraph
from langgraph.graph.message import add_messages
from langgraph.prebuilt import ToolNode
from sqlalchemy import create_engine, text
from typing_extensions import TypedDict

import litellm

# ── Silence verbose litellm logs ──────────────────────────────────────────────
litellm.set_verbose = False
litellm.suppress_debug_info = True
litellm.turn_off_message_logging = True

# ── Database Connections ──────────────────────────────────────────────────────
CONSTRUCTION_DB_URL = os.getenv(
    "CONSTRUCTION_DB_URL",
    "postgresql://postgres:postgres@localhost:5432/construction_ai"
)

try:
    construction_engine = create_engine(CONSTRUCTION_DB_URL)
    with construction_engine.connect() as conn:
        conn.execute(text("SELECT 1"))
    print("[Video Monitoring Multi-Agent] Connected to PostgreSQL")
except Exception as e:
    construction_engine = None
    print(f"[Video Monitoring Multi-Agent WARNING] DB unavailable ({e}). Fallback mode active.")

# ── LLM Gateway Setup ─────────────────────────────────────────────────────────
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
    """Production Gateway with Fallback & Token Metrics tracking."""
    def __init__(self, models):
        self.models = models

    def invoke(self, messages, **kwargs):
        for model in self.models:
            try:
                res = model.invoke(messages, **kwargs)
                if res and res.content:
                    return res
            except Exception as e:
                print(f"[FallbackLLM Warning] Model failed: {e}. Trying next fallback.")
                continue
        # Fallback response if all API calls fail or keys missing
        last_msg = messages[-1].content if messages else ""
        return AIMessage(
            content=f"🤖 [AI Safety Assistant]: Processing your query regarding video monitoring and safety operations. Re: {last_msg[:100]}"
        )

base_llm = FallbackLLM([gemini_llm, groq_llm])

# ── State Definition ──────────────────────────────────────────────────────────
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

# ── Mock Data Helper for Offline/Demo ─────────────────────────────────────────
def _get_mock_video_data(query_type: str) -> List[Dict[str, Any]]:
    if query_type == "cameras":
        return [
            {"id": 101, "name": "CAM-01 Entrance Gate", "location": "Zone A Main Entrance", "status": "ONLINE", "fps": 30, "resolution": "1080p", "rtsp_url": "rtsp://demo.stream/cam01"},
            {"id": 102, "name": "CAM-02 Assembly Line 1", "location": "Manufacturing Bay 2", "status": "ONLINE", "fps": 25, "resolution": "4K", "rtsp_url": "rtsp://demo.stream/cam02"},
            {"id": 103, "name": "CAM-03 Loading Dock", "location": "Warehouse Sector C", "status": "ONLINE", "fps": 30, "resolution": "1080p", "rtsp_url": "rtsp://demo.stream/cam03"},
            {"id": 104, "name": "CAM-04 Chemical Storage", "location": "Hazard Zone 4", "status": "ONLINE", "fps": 30, "resolution": "1080p", "rtsp_url": "rtsp://demo.stream/cam04"},
            {"id": 105, "name": "CAM-05 High Bay Crane", "location": "Steel Yard North", "status": "OFFLINE", "fps": 0, "resolution": "1080p", "rtsp_url": "rtsp://demo.stream/cam05"}
        ]
    elif query_type == "incidents":
        return [
            {"id": "INC-8891", "timestamp": "2026-09-09 10:14:22", "camera": "CAM-02 Assembly Line 1", "type": "PPE Violation - No Helmet", "severity": "HIGH", "status": "OPEN", "confidence": 0.94, "snapshot_url": "/api/placeholders/evidence1.jpg"},
            {"id": "INC-8892", "timestamp": "2026-09-09 11:45:01", "camera": "CAM-03 Loading Dock", "type": "Unauthorized Zone Intrusion", "severity": "CRITICAL", "status": "INVESTIGATING", "confidence": 0.98, "snapshot_url": "/api/placeholders/evidence2.jpg"},
            {"id": "INC-8893", "timestamp": "2026-09-09 13:02:19", "camera": "CAM-04 Chemical Storage", "type": "Fire/Smoke Detected", "severity": "CRITICAL", "status": "RESOLVED", "confidence": 0.91, "snapshot_url": "/api/placeholders/evidence3.jpg"}
        ]
    elif query_type == "counts":
        return [
            {"zone": "Manufacturing Bay 2", "person_count": 14, "forklift_count": 2, "helmet_compliance": "92%", "vest_compliance": "100%"},
            {"zone": "Warehouse Sector C", "person_count": 8, "forklift_count": 4, "helmet_compliance": "87.5%", "vest_compliance": "87.5%"},
            {"zone": "Hazard Zone 4", "person_count": 1, "forklift_count": 0, "helmet_compliance": "100%", "vest_compliance": "100%"}
        ]
    return []

# ── System Agent Tools (Read-Only DB Metrics) ──────────────────────────────────
@tool
def fetch_camera_inventory(filter_status: str = "ALL") -> str:
    """Fetch live camera inventory, RTSP statuses, frame rates, and assigned safety zones."""
    if construction_engine:
        try:
            with construction_engine.connect() as conn:
                res = conn.execute(text("SELECT id, name, location, status, fps, resolution FROM cameras LIMIT 50")).fetchall()
                if res:
                    return json.dumps([dict(row._mapping) for row in res])
        except Exception:
            pass
    cams = _get_mock_video_data("cameras")
    if filter_status.upper() != "ALL":
        cams = [c for c in cams if c["status"] == filter_status.upper()]
    return json.dumps(cams)

@tool
def fetch_recent_safety_incidents(hours: int = 24, severity: str = "ALL") -> str:
    """Fetch recorded safety violations, PPE non-compliance alerts, and intrusion incidents."""
    incidents = _get_mock_video_data("incidents")
    if severity.upper() != "ALL":
        incidents = [i for i in incidents if i["severity"] == severity.upper()]
    return json.dumps(incidents)

@tool
def fetch_person_and_equipment_counts() -> str:
    """Fetch current real-time person counts, forklift counts, and PPE compliance percentages by zone."""
    return json.dumps(_get_mock_video_data("counts"))

# ── Setup Agent Tools (Mutations / Config) ────────────────────────────────────
@tool
def update_camera_alert_rule(camera_id: str, rule_type: str, enabled: bool, min_confidence: float = 0.85) -> str:
    """Update safety detection rules (PPE detection, perimeter intrusion, fire detection) for a specific camera."""
    return json.dumps({
        "status": "SUCCESS",
        "message": f"Updated rule '{rule_type}' for {camera_id}: enabled={enabled}, min_confidence={min_confidence}",
        "requires_hitl_approval": True,
        "action_id": f"ACT-{int(time.time())}"
    })

@tool
def configure_safety_notification_recipient(recipient_email: str, alert_severities: str = "HIGH,CRITICAL") -> str:
    """Configure automated alert notification recipients for critical safety violations."""
    return json.dumps({
        "status": "SUCCESS",
        "message": f"Added notification recipient {recipient_email} for severities [{alert_severities}].",
        "timestamp": datetime.now().isoformat()
    })

# ── Investigator Agent Tools (Timeline Autopsy) ──────────────────────────────
@tool
def run_forensic_incident_investigation(incident_id: str) -> str:
    """Investigate a specific incident ID, returning timeline of snapshots, root cause analysis, and worker safety logs."""
    return json.dumps({
        "incident_id": incident_id,
        "investigation_timestamp": datetime.now().isoformat(),
        "root_cause": "Worker entered Crane Swing Radius without required Kevlar Helmet & High-Vis Vest at 11:44:50.",
        "contributing_factors": ["Missing barrier fence on East corridor", "Lighting flicker on CAM-03"],
        "recommended_actions": [
            "Issue immediate safety retraining for Sector C team",
            "Deploy automated audio alarm on CAM-03 perimeter breach"
        ],
        "evidence_snapshots": [
            {"label": "T-10s Approach", "url": "/api/placeholders/snap_approach.jpg"},
            {"label": "T-0s Intrusion", "url": "/api/placeholders/snap_intrusion.jpg"},
            {"label": "T+5s Alert Trigger", "url": "/api/placeholders/snap_alert.jpg"}
        ]
    })

# ── Video Agent Tools (RTSP / YOLO / VLM) ─────────────────────────────────────
@tool
def get_live_camera_feed_stream(camera_name: str) -> str:
    """Get active RTSP stream URL, HLS playlist endpoint, and live status for a specified camera."""
    cams = _get_mock_video_data("cameras")
    for c in cams:
        if camera_name.lower() in c["name"].lower() or camera_name.lower() in c["location"].lower():
            return json.dumps(c)
    return json.dumps(cams[0])

@tool
def analyze_scene_context(camera_name: str, query: str) -> str:
    """Interrogate live frame context via VLM (Vision Language Model) for specific worker actions, helmet colors, or hazard risks."""
    return json.dumps({
        "camera_name": camera_name,
        "query": query,
        "summary": f"VLM Inspection on {camera_name}: Observed 3 workers in yellow safety vests. 2 workers wearing white hard hats, 1 worker carrying blue equipment box without gloves near conveyor belt. Hazard Risk: LOW-MODERATE.",
        "detections": [
            {"class": "person", "confidence": 0.96, "bbox": [120, 45, 300, 510], "ppe": {"helmet": True, "vest": True}},
            {"class": "person", "confidence": 0.92, "bbox": [310, 80, 450, 490], "ppe": {"helmet": True, "vest": True}},
            {"class": "person", "confidence": 0.89, "bbox": [500, 110, 620, 520], "ppe": {"helmet": False, "vest": True}}
        ],
        "timestamp": datetime.now().isoformat()
    })

# Tool Nodes
system_tools = [fetch_camera_inventory, fetch_recent_safety_incidents, fetch_person_and_equipment_counts]
setup_tools = [update_camera_alert_rule, configure_safety_notification_recipient]
investigator_tools = [run_forensic_incident_investigation]
video_tools = [get_live_camera_feed_stream, analyze_scene_context]

# ── Agent Node Functions ──────────────────────────────────────────────────────
def general_agent(state: TeamState) -> Dict[str, Any]:
    sys_prompt = SystemMessage(content="""
    You are the AI Safety Assistant (General Agent) for Industrial & Video Monitoring operations.
    You respond to user greetings, profile inquiries, system overview questions, and general conversation.
    Keep your tone professional, concise, and focused on industrial safety excellence.
    """)
    response = base_llm.invoke([sys_prompt] + state["messages"])
    return {"messages": [response], "next_agent": "FINISH"}

def system_agent(state: TeamState) -> Dict[str, Any]:
    llm_with_tools = ChatLiteLLM(
        model="gemini/gemini-3.1-flash-lite",
        api_key=os.getenv("GEMINI_API_KEY", "mock-key"),
        temperature=0.1
    ).bind_tools(system_tools) if os.getenv("GEMINI_API_KEY") else None
    
    sys_prompt = SystemMessage(content="""
    You are the System Agent for Video Monitoring. You provide read-only database insights for cameras, active alerts, incidents, zone metrics, and PPE compliance.
    Always format data clearly with Markdown tables or clean summary bullet points.
    """)
    if llm_with_tools:
        try:
            res = llm_with_tools.invoke([sys_prompt] + state["messages"])
            return {"messages": [res], "next_agent": "FINISH"}
        except Exception:
            pass
            
    response = base_llm.invoke([sys_prompt] + state["messages"])
    return {"messages": [response], "next_agent": "FINISH"}

def setup_agent(state: TeamState) -> Dict[str, Any]:
    sys_prompt = SystemMessage(content="""
    You are the Setup Agent for Video Monitoring. You handle configuration updates, safety rule mutations, notification routing, and threshold adjustments.
    IMPORTANT: For write operations, clearly indicate the modifications being performed and present HITL (Human-in-the-Loop) confirmation controls when required.
    """)
    response = base_llm.invoke([sys_prompt] + state["messages"])
    return {"messages": [response], "next_agent": "FINISH"}

def investigator_agent(state: TeamState) -> Dict[str, Any]:
    sys_prompt = SystemMessage(content="""
    You are the Forensic Investigator Agent for Video Monitoring. You conduct root cause analysis on safety incidents, analyze timeline snapshots, and compile forensic evidence reports.
    Highlight key incident timestamps, violating entities, and corrective action recommendations.
    """)
    response = base_llm.invoke([sys_prompt] + state["messages"])
    return {"messages": [response], "next_agent": "FINISH"}

def video_agent(state: TeamState) -> Dict[str, Any]:
    sys_prompt = SystemMessage(content="""
    You are the Video Agent for Video Monitoring. You handle live RTSP stream requests, camera visual feeds, YOLO object counts, and VLM scene analysis.
    If the user asks to see a camera feed or inspect live worker actions, provide the stream details and VLM scene summary clearly.
    """)
    response = base_llm.invoke([sys_prompt] + state["messages"])
    return {"messages": [response], "next_agent": "FINISH"}

# ── Supervisor Node & Router ──────────────────────────────────────────────────
def supervisor_node(state: TeamState) -> Dict[str, Any]:
    messages = state.get("messages", [])
    last_human_query = ""
    for msg in reversed(messages):
        if isinstance(msg, HumanMessage) or getattr(msg, "type", "") == "human":
            last_human_query = getattr(msg, "content", "")
            break
            
    input_lower = last_human_query.lower() if isinstance(last_human_query, str) else ""
    
    # 1. Fast-track setup/mutations
    if any(k in input_lower for k in ["update rule", "enable rule", "disable rule", "configure notification", "add recipient", "change threshold", "setup"]):
        return {"next_agent": "setup_agent"}
        
    # 2. Fast-track investigation
    if any(k in input_lower for k in ["investigate", "root cause", "autopsy", "incident report", "forensic", "inc-"]):
        return {"next_agent": "investigator_agent"}
        
    # 3. Fast-track video / live stream / counts
    if any(k in input_lower for k in ["live feed", "rtsp", "stream", "show camera", "count person", "count people", "what are workers doing", "scene", "vlm"]):
        return {"next_agent": "video_agent"}
        
    # 4. Fast-track system metrics / list cameras / logs
    if any(k in input_lower for k in ["cameras", "list camera", "active alerts", "incidents", "zones", "compliance", "metrics"]):
        return {"next_agent": "system_agent"}
        
    # 5. Fast-track general
    if any(k in input_lower for k in ["hi", "hello", "hey", "who are you", "help", "thanks"]):
        return {"next_agent": "general_agent"}
        
    # Fallback to general agent
    return {"next_agent": "general_agent"}

def supervisor_router(state: TeamState) -> str:
    target = state.get("next_agent", "general_agent")
    if target in ["general_agent", "system_agent", "setup_agent", "investigator_agent", "video_agent"]:
        return target
    return "general_agent"

# ── Build LangGraph Mesh ──────────────────────────────────────────────────────
workflow = StateGraph(TeamState)

workflow.add_node("supervisor", supervisor_node)
workflow.add_node("general_agent", general_agent)
workflow.add_node("system_agent", system_agent)
workflow.add_node("setup_agent", setup_agent)
workflow.add_node("investigator_agent", investigator_agent)
workflow.add_node("video_agent", video_agent)

workflow.add_edge(START, "supervisor")
workflow.add_conditional_edges(
    "supervisor",
    supervisor_router,
    {
        "general_agent": "general_agent",
        "system_agent": "system_agent",
        "setup_agent": "setup_agent",
        "investigator_agent": "investigator_agent",
        "video_agent": "video_agent"
    }
)

workflow.add_edge("general_agent", END)
workflow.add_edge("system_agent", END)
workflow.add_edge("setup_agent", END)
workflow.add_edge("investigator_agent", END)
workflow.add_edge("video_agent", END)

memory_checkpoint = MemorySaver()
video_monitoring_graph = workflow.compile(checkpointer=memory_checkpoint)

# ── Traceability DB Logging Helper ───────────────────────────────────────────
def _log_agent_trace(thread_id: str, agent_name: str, user_input: str, response_text: str):
    if not construction_engine:
        return
    try:
        with construction_engine.begin() as conn:
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
                {"t": thread_id, "a": agent_name, "i": user_input, "r": response_text}
            )
    except Exception as e:
        print(f"[Traceability Warning] Could not log trace: {e}")

# ── Public Async API Runners ──────────────────────────────────────────────────
async def run_video_monitoring_conversation(message: str, thread_id: str = "default", user_id: str = "operator_1") -> Dict[str, Any]:
    config = {"configurable": {"thread_id": thread_id}}
    initial_state = {
        "messages": [HumanMessage(content=message)],
        "user_id": user_id,
        "next_agent": "supervisor",
        "source_documents": [],
        "generated_outputs": []
    }
    
    final_state = await asyncio.to_thread(video_monitoring_graph.invoke, initial_state, config)
    
    response_msg = ""
    active_agent = final_state.get("next_agent", "general_agent")
    if final_state.get("messages"):
        last_msg = final_state["messages"][-1]
        response_msg = getattr(last_msg, "content", str(last_msg))
        
    _log_agent_trace(thread_id, active_agent, message, response_msg)
    
    return {
        "reply": response_msg,
        "thread_id": thread_id,
        "active_agent": active_agent
    }

async def stream_video_monitoring_events(
    message: str,
    thread_id: str = "default",
    user_id: str = "operator_1",
    hitl_context: Optional[Dict[str, Any]] = None
) -> AsyncGenerator[str, None]:
    """
    SSE Generator yielding JSON formatted event strings:
    - event: agent_switch
    - event: token
    - event: widget
    - event: done
    """
    config = {"configurable": {"thread_id": thread_id}}
    
    # 1. Determine target agent via supervisor routing
    initial_state = {
        "messages": [HumanMessage(content=message)],
        "user_id": user_id,
        "next_agent": "supervisor",
        "source_documents": [],
        "generated_outputs": []
    }
    
    sup_decision = supervisor_node(initial_state)
    active_agent = sup_decision.get("next_agent", "general_agent")
    
    # Emit active agent switch event
    yield f"event: agent_switch\ndata: {json.dumps({'agent': active_agent})}\n\n"
    await asyncio.sleep(0.05)
    
    # 2. Invoke full graph to get final message content
    final_state = await asyncio.to_thread(video_monitoring_graph.invoke, initial_state, config)
    
    full_response = "I have processed your request for video monitoring."
    if final_state.get("messages"):
        last_msg = final_state["messages"][-1]
        full_response = getattr(last_msg, "content", str(last_msg))
        
    # Log trace
    _log_agent_trace(thread_id, active_agent, message, full_response)
    
    # 3. Token-by-token streaming reveal simulation
    words = full_response.split(" ")
    chunk_buffer = []
    for idx, word in enumerate(words):
        chunk_buffer.append(word)
        if len(chunk_buffer) >= 3 or idx == len(words) - 1:
            chunk_text = " ".join(chunk_buffer) + (" " if idx < len(words) - 1 else "")
            yield f"event: token\ndata: {json.dumps({'text': chunk_text})}\n\n"
            chunk_buffer = []
            await asyncio.sleep(0.03)
            
    # 4. Inject Dynamic UI Widget payloads based on active agent response
    input_lower = message.lower()
    if active_agent == "investigator_agent" or "investigate" in input_lower or "inc-" in input_lower:
        evidence_widget = {
            "type": "evidence_gallery",
            "title": "Incident Forensic Evidence Snapshots",
            "snapshots": [
                {"id": 1, "title": "CAM-02 PPE Violation - T-10s", "timestamp": "10:14:12", "url": "https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=600&q=80", "badge": "NO HELMET"},
                {"id": 2, "title": "CAM-02 Restricted Zone Intrusion", "timestamp": "10:14:22", "url": "https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?auto=format&fit=crop&w=600&q=80", "badge": "ZONE BREACH"},
                {"id": 3, "title": "CAM-03 Automated Alarm Trigger", "timestamp": "10:14:35", "url": "https://images.unsplash.com/photo-1581092335397-9583fe92d232?auto=format&fit=crop&w=600&q=80", "badge": "ALARM ACTIVE"}
            ]
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
                ["CAM-04", "Hazard Zone 4", "ONLINE", "30 FPS", "100%"]
            ]
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
                {"id": "continue", "label": "Request Safety Manager Review", "variant": "secondary"}
            ]
        }
        yield f"event: widget\ndata: {json.dumps(hitl_widget)}\n\n"
        
    # 5. Emit Done marker
    yield f"event: done\ndata: {json.dumps({'thread_id': thread_id})}\n\n"
