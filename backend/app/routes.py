import asyncio
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, status, Request
from fastapi.responses import JSONResponse, StreamingResponse
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
import jwt
import bcrypt
import json
from pydantic import BaseModel
from sqlalchemy import select, update, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db, AsyncSessionLocal, User, AlertMaster, WorkOrder, MachineMaster, InventoryByLot, mes_db_status, AgentReportingSettings
from app.llm_gateway import execute_completion, get_usage_audit
from app.guardrails_firewall import validate_query_safety
from app.agents.agent_workflow import run_agent_workflow, AgentState
from app.agents.maintenance_agent import run_maintenance_conversation
from app.agents.safety_quality_agent import run_safety_quality_conversation
from app.email_service import send_pdf_report_email
from app.voice.manager import VoiceConversationManager

router = APIRouter()

SECRET_KEY = "IIOT_MANUFACTURING_SECRET_KEY_JWT"
ALGORITHM = "HS256"

# Models for Request/Response
class LoginRequest(BaseModel):
    username: str
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str
    role: str
    site: str

class QueryRequest(BaseModel):
    query: str
    model: str = "auto"
    email_to: Optional[str] = None
    agent: Optional[str] = None

class ApproveRequest(BaseModel):
    state: Dict[str, Any]

class RuleCreate(BaseModel):
    condition: str
    action: str

class AgentToggleRequest(BaseModel):
    name: str
    enabled: bool

class MaintenanceChatRequest(BaseModel):
    message: str
    thread_id: Optional[str] = None

class SafetyQualityChatRequest(BaseModel):
    message: str
    thread_id: Optional[str] = None

# In-memory set of active agents
active_agents = {
    "Operations Agent", "Maintenance Agent", "Safety & Quality Agent", "Energy Agent",
    "ESG & Compliance Agent", "Finance Agent", "PPE & Behavior Vision Agent",
    "Permit-to-Work Agent", "Incident & Investigation Agent", "Environmental Compliance Agent",
    "Predictive Safety Intelligence Agent", "Contractor & Asset Risk Agent", "AI Spill/Leak Detection Agent"
}

# In-memory store for paused workflows (HITL)
paused_workflows: Dict[str, AgentState] = {}

# In-memory custom rules created via Admin Console
custom_rules = [
    {"id": 1, "trigger": "IF", "condition": "permit expires within 2h AND is not renewed", "action": "notify Permit Holder + Shift Supervisor (SMS + App) within 5 min; escalate to HSE Head if unacknowledged in 15 min."},
    {"id": 2, "trigger": "IF", "condition": "predicted equipment failure probability exceeds 80%", "action": "raise a work order in SAP and notify the Maintenance Lead automatically."},
    {"id": 3, "trigger": "IF", "condition": "a PPE violation is detected twice in the same zone within 1 hour", "action": "notify the Site Safety Officer and log a formal incident."},
    {"id": 4, "trigger": "IF", "condition": "SO₂ reading exceeds the regulatory limit for 10 minutes", "action": "notify the Environmental Compliance Agent owner and auto-generate a report."}
]

# --- WEBSOCKET CONNECTION MANAGER ---

class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        print(f"WebSocket client connected. Total connections: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
            print("WebSocket client disconnected.")

    async def broadcast(self, message: Dict[str, Any]):
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception:
                pass

manager = ConnectionManager()

# Background task to stream live agent events
async def stream_agent_events():
    import random
    from app.db import AsyncSessionLocal
    
    feed_pool = [
        ("Maintenance Agent", "predicts Train-3 regenerator failure within 72h — work order WO-88213 raised in SAP.", "red"),
        ("PPE & Behavior Vision Agent", "flagged a missing hard-hat in Zone 4, Camera 12 — supervisor notified.", "amber"),
        ("Permit-to-Work Agent", "auto-escalated permit PTW-3391 (confined space) — 6h past expiry.", "red"),
        ("Environmental Compliance Agent", "logged SO₂ within limits — Unit 5, last 30 min average 42 mg/Nm³.", "green"),
        ("Finance Agent", "flagged a 14% cost variance on Plant Gamma consumables budget.", "amber"),
        ("Predictive Safety Intelligence Agent", "raised heat-stress risk for the 14:00–18:00 shift, Zone 7.", "amber"),
        ("Operations Agent", "closed the gap on Line 3 — output back to 98% of plan.", "green"),
        ("Contractor & Asset Risk Agent", "updated risk ranking — Contractor #CN-114 moved to high-risk.", "amber"),
        ("Incident & Investigation Agent", "closed root-cause on near-miss NM-2026-081.", "green"),
        ("AI Spill/Leak Detection Agent", "cleared a false-positive alert at Tank Farm 2 after review.", "green"),
    ]
    
    while True:
        await asyncio.sleep(6.0) # broadcast every 6 seconds
        if manager.active_connections:
            pick = random.choice(feed_pool)
            if pick[0] not in active_agents:
                continue
            event_id = str(random.randint(100000, 999999))
            event = {
                "id": event_id,
                "agent": pick[0],
                "msg": pick[1],
                "sev": pick[2],
                "time": datetime.utcnow().strftime("%H:%M:%S")
            }
            # Add to database AlertMaster
            try:
                async with AsyncSessionLocal() as session:
                    alert = AlertMaster(
                        AlertType=pick[0],
                        Severity=pick[2],
                        Title=f"{pick[0]} Event",
                        Message=pick[1],
                        Source=pick[0],
                        CreatedDate=datetime.utcnow()
                    )
                    session.add(alert)
                    await session.commit()
            except Exception as e:
                print("Failed to save background alert to DB:", e)
                
            await manager.broadcast(event)

# --- AUTHENTICATION ROUTES ---

@router.post("/api/auth/login", response_model=TokenResponse)
async def login(req: LoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.username == req.username))
    user = result.scalars().first()
    
    pw_matches = False
    if user:
        try:
            pw_matches = bcrypt.checkpw(req.password.encode('utf-8'), user.password_hash.encode('utf-8'))
        except Exception:
            pass
            
    if not user or not pw_matches:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
        
    # Generate Token
    expire = datetime.utcnow() + timedelta(hours=24)
    payload = {
        "sub": user.username,
        "role": user.role,
        "site": user.site,
        "exp": expire
    }
    token = jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)
    
    return {
        "access_token": token,
        "token_type": "bearer",
        "role": user.role,
        "site": user.site
    }

# --- TELEMETRY & STATS ---

@router.get("/api/telemetry")
async def get_telemetry(db: AsyncSession = Depends(get_db)):
    # Calculate live stats
    # OEE avg, total active work orders, total alerts
    result_wo = await db.execute(select(WorkOrder))
    work_orders = result_wo.scalars().all()
    
    total_wo = len(work_orders)
    in_progress_wo = len([w for w in work_orders if w.Status == "In Progress"])
    
    result_alerts = await db.execute(select(AlertMaster).where(AlertMaster.IsResolved == False))
    active_alerts = len(result_alerts.scalars().all())
    
    # Calculate average OEE based on machines
    result_machines = await db.execute(select(MachineMaster))
    machines = result_machines.scalars().all()
    running_machines = len([m for m in machines if m.Status == "Running"])
    
    return {
        "production_output": "8,240 T/day",
        "plant_oee": "83.6%",
        "zero_harm_index": "94.6",
        "revenue_ytd": "₹487 Cr",
        "active_work_orders": total_wo,
        "in_progress_work_orders": in_progress_wo,
        "active_alerts": active_alerts,
        "running_machines": running_machines,
        "total_machines": len(machines),
        "mes_db_status": mes_db_status
    }

# --- WEBSOCKET ROUTE ---

@router.websocket("/api/ws/telemetry")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            # Keep connection alive, listen for client messages if any
            data = await websocket.receive_text()
            # Respond to ping or other inputs
            await websocket.send_json({"status": "ack", "received": data})
    except WebSocketDisconnect:
        manager.disconnect(websocket)

@router.websocket("/api/ws/voice")
async def websocket_voice_endpoint(websocket: WebSocket):
    await websocket.accept()
    manager = VoiceConversationManager(websocket)
    try:
        while True:
            # We receive raw PCM audio (bytes) or control messages (text)
            message = await websocket.receive()
            if "bytes" in message:
                await manager.handle_audio_frame(message["bytes"])
            elif "text" in message:
                data = json.loads(message["text"])
                if data.get("type") == "audio_played":
                    # Update truncation logic if needed
                    manager.played_text = data.get("text", "")
    except WebSocketDisconnect:
        pass
    except Exception as e:
        print(f"Voice WS Error: {e}")


# --- AGENTIC QUERY ENDPOINTS ---

@router.post("/api/agent/query")
async def query_agent(req: QueryRequest):
    # 1. Run Cybersecurity Firewall Checks
    is_blocked, status_str, reason = await validate_query_safety(req.query)
    if is_blocked:
        return {
            "status": "blocked",
            "reason": reason,
            "insights": f"Security Alert: This query was flagged and blocked by the AI Firewall.\nReason: {reason}"
        }
        
    # 2. Trigger LangGraph Workflow (route by agent)
    try:
        if getattr(req, "agent", None) == "maintenance":
            maintenance = await run_maintenance_conversation(req.query)
            return {
                "status": "success",
                "sql_query": "",
                "sql_result": "",
                "insights": maintenance.get("reply", ""),
                "execution_steps": [],
                "pdf_url": "",
                "email_status": None,
                "error_message": "",
                "cost_usd": 0.0,
                "visuals": maintenance.get("visuals", []),
            }
        else:
            state = await run_agent_workflow(req.query, is_approved=False)
        
        # If it requires human approval, store it and return status
        if state.get("requires_hitl") and not state.get("is_approved"):
            workflow_id = f"hitl-{datetime.utcnow().strftime('%s')}"
            paused_workflows[workflow_id] = state
            return {
                "status": "requires_approval",
                "workflow_id": workflow_id,
                "sql_query": state.get("sql_query", ""),
                "execution_steps": state.get("execution_steps", []),
                "insights": "Pending administrator approval: This query requires executing modifications on the live database."
            }
            
        # Handle optional email sending
        email_status = None
        if req.email_to and state.get("pdf_path"):
            subject = "Agentic Daily Operations & Resources Report"
            body = f"Hello,\n\nPlease find the requested manufacturing operations report attached.\n\nQuery: {req.query}\n\nRegards,\nManufacturing Agentic AI"
            success = send_pdf_report_email(req.email_to, subject, body, state["pdf_path"])
            email_status = "sent" if success else "failed"
            
        return {
            "status": "success",
            "sql_query": state.get("sql_query", ""),
            "sql_result": state.get("sql_result", ""),
            "insights": state.get("insights", state.get("reply", "")),
            "execution_steps": state.get("execution_steps", []),
            "pdf_url": state.get("pdf_url", ""),
            "email_status": email_status,
            "error_message": state.get("error_message", ""),
            "cost_usd": get_usage_audit()[-1].get("estimated_cost_usd", 0.0) if get_usage_audit() else 0.0
        }
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Workflow execution failed: {e}")

@router.post("/api/maintenance/chat")
async def maintenance_chat(req: MaintenanceChatRequest):
    response = await run_maintenance_conversation(req.message, thread_id=req.thread_id)
    return {
        "status": "success",
        "thread_id": req.thread_id or f"maint-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}",
        "reply": response["reply"],
        "visuals": response["visuals"],
    }

@router.post("/api/agent/approve")
async def approve_workflow(req: ApproveRequest):
    workflow_id = req.state.get("workflow_id")
    if not workflow_id or workflow_id not in paused_workflows:
        raise HTTPException(status_code=404, detail="Paused workflow not found or expired")
        
    saved_state = paused_workflows[workflow_id]
    
    try:
        # Resume workflow with is_approved=True
        state = await run_agent_workflow(
            query=saved_state["query"],
            is_approved=True,
            saved_state=saved_state
        )
        
        # Clean up
        del paused_workflows[workflow_id]
        
        return {
            "status": "success",
            "sql_query": state["sql_query"],
            "sql_result": state["sql_result"],
            "insights": state["insights"],
            "execution_steps": state["execution_steps"]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to resume workflow: {e}")

# --- ADMIN CONSOLE DATA ENDPOINTS ---

@router.get("/api/admin/users")
async def get_users(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User))
    users = result.scalars().all()
    return [{"id": u.id, "username": u.username, "role": u.role, "site": u.site} for u in users]

@router.get("/api/admin/connectors")
async def get_connectors():
    return [
        {"icon": "🧾", "name": "SAP ERP (BAPI / REST)", "desc": "Production, finance and materials data — CO11N / MB31 / QM01 native.", "status": "Connected"},
        {"icon": "🏭", "name": "MES / SCADA / PLC", "desc": "Line-level throughput, machine status and control-system telemetry.", "status": "Connected"},
        {"icon": "📋", "name": "EHS / Permit-to-Work System", "desc": "Permits, incidents and compliance records synced in real time.", "status": "Connected"},
        {"icon": "📡", "name": "IoT Gateway (MQTT)", "desc": "Sensor ingestion from vibration, temperature and gas monitors.", "status": "Connected"},
        {"icon": "🎥", "name": "CCTV / NVR (Vision AI)", "desc": "Existing camera infrastructure — no new hardware required.", "status": "Connected"},
        {"icon": "⌚", "name": "Wearables / Health IoT", "desc": "Vital-sign and fatigue monitoring devices.", "status": "Pilot"},
        {"icon": "🔑", "name": "Identity Provider (SSO)", "desc": "Azure AD / Okta / SAML 2.0 federation.", "status": "Connected"}
    ]

@router.get("/api/admin/rules")
async def get_rules():
    return custom_rules

@router.post("/api/admin/rules")
async def create_rule(req: RuleCreate):
    new_id = len(custom_rules) + 1
    rule = {
        "id": new_id,
        "trigger": "IF",
        "condition": req.condition,
        "action": req.action
    }
    custom_rules.append(rule)
    return rule

@router.get("/api/admin/audit")
async def get_audit_logs():
    return get_usage_audit()

@router.post("/api/admin/agents/toggle")
async def toggle_agent(req: AgentToggleRequest):
    if req.enabled:
        active_agents.add(req.name)
    else:
        active_agents.discard(req.name)
    return {"status": "success", "active_agents": list(active_agents)}

class ReportingSettingsRequest(BaseModel):
    is_enabled: bool
    email: str
    schedule_time: str
    prompt: str

class ExecutiveInsightsRequest(BaseModel):
    message: str
    thread_id: Optional[str] = None

class ExecutiveIntent(BaseModel):
    reply_type: str = "text"
    topic: str = "general"
    chart_type: Optional[str] = None
    diagram_type: Optional[str] = None
    wants_visual: bool = False
    reply: str = ""

async def _build_maintenance_response(message: str) -> Dict[str, Any]:
    query = message.lower().strip()
    if not query:
        return {
            "message": "Hi sir, I am the Maintenance Agent. Ask me about machine health, predictive maintenance schedules, work orders, alerts, or breakdown status.",
            "visuals": [],
        }

    async with AsyncSessionLocal() as session:
        machines = (await session.execute(select(MachineMaster))).scalars().all()
        work_orders = (await session.execute(select(WorkOrder))).scalars().all()
        alerts = (await session.execute(select(AlertMaster).where(AlertMaster.IsResolved == False))).scalars().all()

    maintenance_machines = [m for m in machines if (m.Status or "").lower() in {"maintenance", "offline"}]
    active_work_orders = [w for w in work_orders if (w.Status or "").lower() in {"planned", "in progress", "on hold"}]

    reply = ""
    visuals: List[Dict[str, Any]] = []

    if any(term in query for term in ["hello", "hi", "hey", "good morning", "good afternoon", "good evening"]):
        reply = "Hello sir. I can help with machine health, scheduled maintenance, predictive alerts, and maintenance work orders."
    elif any(term in query for term in ["machine health", "health status", "machine status", "status of machine"]):
        reply = f"There are {len(machines)} machines in the dataset, with {len(maintenance_machines)} currently in maintenance or offline status."
        visuals.append({
            "type": "bar",
            "title": "Machine Health Snapshot",
            "labels": [m.MachineCode for m in machines[:4]],
            "series": [
                {"name": "Capacity", "data": [float(getattr(m, 'CapacityPerHour', 0) or 0) for m in machines[:4]]},
                {"name": "Health Score", "data": [55 if (m.Status or '').lower() == 'maintenance' else 90 if (m.Status or '').lower() == 'running' else 70 for m in machines[:4]]},
            ],
            "meta": {"legend": True, "x_label": "Machine", "y_label": "Score / Capacity"},
        })
    elif any(term in query for term in ["schedule", "maintenance window", "preventive", "predictive"]):
        reply = f"I found {len(maintenance_machines)} machines needing attention and {len(active_work_orders)} maintenance-related work orders."
        visuals.append({
            "type": "line",
            "title": "Maintenance Workload Trend",
            "labels": ["Now", "Soon", "Later", "Later+"],
            "series": [
                {"name": "Open Work Orders", "data": [len(active_work_orders), max(len(active_work_orders) - 1, 0), max(len(active_work_orders) - 2, 0), max(len(active_work_orders) - 3, 0)]},
                {"name": "Alerts", "data": [len(alerts), len(alerts), len(alerts), len(alerts)]},
            ],
            "meta": {"legend": True, "x_label": "Horizon", "y_label": "Count"},
        })
    elif any(term in query for term in ["work order", "wo", "maintenance order", "repair order"]):
        reply = f"There are {len(active_work_orders)} active maintenance-related work orders in the current dataset."
        visuals.append({
            "type": "bar",
            "title": "Maintenance Work Orders",
            "labels": [w.WorkOrderNumber for w in active_work_orders[:4]],
            "series": [
                {"name": "Planned Qty", "data": [float(w.PlannedQty or 0) for w in active_work_orders[:4]]},
                {"name": "Completed Qty", "data": [float(w.CompletedQty or 0) for w in active_work_orders[:4]]},
            ],
            "meta": {"legend": True, "x_label": "Work Order", "y_label": "Quantity"},
        })
    elif any(term in query for term in ["alerts", "breakdown", "fault", "failure"]):
        reply = f"There are {len(alerts)} unresolved alerts and {len(maintenance_machines)} machines currently not in healthy running state."
        visuals.append({
            "type": "pie",
            "title": "Alert Mix",
            "labels": ["Maintenance", "Safety", "Compliance", "Finance"],
            "series": [{"name": "Alerts", "data": [max(len(alerts), 1), 1, 1, 1]}],
            "meta": {"legend": True, "x_label": "", "y_label": "Share"},
        })
    else:
        reply = "I can help with machine health status, predictive maintenance schedules, and maintenance work order queries."
        visuals.append({
            "type": "flow",
            "title": "Maintenance Workflow",
            "labels": ["Inspect", "Diagnose", "Plan", "Execute"],
            "nodes": [
                {"id": "inspect", "label": "Inspect"},
                {"id": "diagnose", "label": "Diagnose"},
                {"id": "plan", "label": "Plan"},
                {"id": "execute", "label": "Execute"},
            ],
            "edges": [
                {"from": "inspect", "to": "diagnose"},
                {"from": "diagnose", "to": "plan"},
                {"from": "plan", "to": "execute"},
            ],
            "meta": {"legend": False, "x_label": "", "y_label": ""},
        })

    return {"message": reply, "visuals": visuals}

def _wo_chart_payload(chart_type: str) -> Dict[str, Any]:
    labels = ["WO-88213", "WO-33912", "WO-10442", "WO-55610"]
    planned = [500, 250, 1000, 300]
    completed = [120, 0, 1000, 50]
    progress = [24, 0, 100, 17]

    if chart_type == "pie":
        return {
            "type": "pie",
            "title": "Active Work Order Mix",
            "labels": ["In Progress", "Planned", "On Hold", "Completed"],
            "series": [
                {"name": "Work Orders", "data": [1, 1, 1, 1]}
            ],
            "meta": {
                "legend": True,
                "x_label": "",
                "y_label": "Share",
            },
        }

    return {
        "type": chart_type,
        "title": "Work Order Progress by WO",
        "labels": labels,
        "series": [
            {"name": "Planned Qty", "data": planned},
            {"name": "Completed Qty", "data": completed},
            {"name": "Progress %", "data": progress},
        ],
        "meta": {
            "legend": True,
            "x_label": "Work Order Number",
            "y_label": "Quantity / Percent",
        },
    }

def _build_chart_payload(topic: str, chart_type: str) -> Dict[str, Any]:
    if topic == "work_order":
        return _wo_chart_payload(chart_type)
    if topic == "machine":
        return {
            "type": chart_type if chart_type != "histogram" else "bar",
            "title": "Machine Utilization",
            "labels": ["Machine A", "Machine B", "Machine C", "Machine D"],
            "series": [
                {"name": "Capacity", "data": [95, 88, 76, 64]},
                {"name": "Utilization", "data": [83, 79, 68, 57]},
            ],
            "meta": {"legend": True, "x_label": "Machine", "y_label": "Score"},
        }
    if topic == "inventory":
        if chart_type == "pie":
            return {
                "type": "pie",
                "title": "Inventory Distribution",
                "labels": ["RM", "WIP", "FG", "Blocked"],
                "series": [{"name": "Qty", "data": [72, 56, 91, 18]}],
                "meta": {"legend": True, "x_label": "", "y_label": "Share"},
            }
        return {
            "type": chart_type if chart_type != "histogram" else "bar",
            "title": "Inventory Snapshot",
            "labels": ["RM", "WIP", "FG", "Blocked"],
            "series": [{"name": "Qty", "data": [72, 56, 91, 18]}],
            "meta": {"legend": True, "x_label": "Bucket", "y_label": "Quantity"},
        }
    if topic == "sales":
        return {
            "type": chart_type if chart_type != "histogram" else "bar",
            "title": "Forecast vs Actual",
            "labels": ["Mon", "Tue", "Wed", "Thu", "Fri"],
            "series": [
                {"name": "Forecast", "data": [120, 135, 128, 142, 150]},
                {"name": "Actual", "data": [112, 129, 123, 138, 146]},
            ],
            "meta": {"legend": True, "x_label": "Day", "y_label": "Value"},
        }
    return {
        "type": chart_type if chart_type != "histogram" else "bar",
        "title": "Executive Dashboard Snapshot",
        "labels": ["Production", "Quality", "Maintenance", "Finance"],
        "series": [{"name": "Health", "data": [84, 91, 76, 88]}],
        "meta": {"legend": True, "x_label": "Domain", "y_label": "Score"},
    }

def _build_flow_visual(diagram_type: str = "flow") -> Dict[str, Any]:
    return {
        "type": "flow",
        "title": "Work Order Pipeline",
        "labels": ["Request", "Planning", "Approval", "Execution", "Closeout"],
        "nodes": [
            {"id": "req", "label": "Request"},
            {"id": "plan", "label": "Planning"},
            {"id": "approve", "label": "Approval"},
            {"id": "exec", "label": "Execution"},
            {"id": "close", "label": "Closeout"},
        ],
        "edges": [
            {"from": "req", "to": "plan"},
            {"from": "plan", "to": "approve"},
            {"from": "approve", "to": "exec"},
            {"from": "exec", "to": "close"},
        ],
        "meta": {
            "legend": False,
            "x_label": "",
            "y_label": "",
        },
    }

def _build_machine_network_visual() -> Dict[str, Any]:
    return {
        "type": "flow",
        "title": "Machine Dependency Network",
        "labels": ["Input", "Machine A", "Machine B", "Output"],
        "nodes": [
            {"id": "input", "label": "Input"},
            {"id": "ma", "label": "Machine A"},
            {"id": "mb", "label": "Machine B"},
            {"id": "output", "label": "Output"},
        ],
        "edges": [
            {"from": "input", "to": "ma"},
            {"from": "ma", "to": "mb"},
            {"from": "mb", "to": "output"},
        ],
        "meta": {
            "legend": False,
            "x_label": "",
            "y_label": "",
        },
    }

async def _parse_executive_intent(message: str) -> ExecutiveIntent:
    system_prompt = (
        "You are an intent parser for an Executive Insights agent. "
        "Return ONLY valid JSON with keys: reply_type, topic, chart_type, diagram_type, wants_visual, reply. "
        "reply_type must be one of: text, chart, diagram, capability. "
        "topic must be one of: general, work_order, machine, inventory, sales, process, capability. "
        "chart_type must be one of: bar, line, pie, histogram, stacked_bar, gauge or null. "
        "diagram_type must be one of: flow, network, sankey, gantt or null. "
        "If the user asks what you can build, reply_type should be capability and reply should list supported visuals. "
        "If they ask for a workflow/pipeline/architecture, reply_type should be diagram. "
        "If they ask for a chart/graph/visualization, reply_type should be chart."
    )
    result = await execute_completion(
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": message},
        ],
        model="gemini/gemini-3.5-flash-lite",
        temperature=0.0,
    )
    raw = result.get("text", "").strip()
    try:
        payload = json.loads(raw)
        return ExecutiveIntent(**payload)
    except Exception:
        lowered = message.lower()
        if any(x in lowered for x in ["what can", "how many charts", "capabilities"]):
            return ExecutiveIntent(
                reply_type="capability",
                topic="capability",
                wants_visual=False,
                reply="Yes. I can generate bar, line, pie, histogram, stacked bar, gauge / KPI, flowchart, node-edge, Sankey, and Gantt visuals."
            )
        if any(x in lowered for x in ["pipeline", "workflow", "process", "flow", "architecture"]):
            return ExecutiveIntent(reply_type="diagram", topic="process", diagram_type="flow", wants_visual=True)
        if any(x in lowered for x in ["chart", "plot", "visualize", "graph"]):
            return ExecutiveIntent(reply_type="chart", topic="general", chart_type="bar", wants_visual=True)
        return ExecutiveIntent(reply_type="text", topic="general", wants_visual=False)

async def _build_executive_insights_response(message: str) -> Dict[str, Any]:
    query = message.lower().strip()
    if not query:
        return {
            "message": "Hi, I am Executive Insights Agent. Ask me about work orders, production, inventory, maintenance, sales, or charts.",
            "visuals": [],
        }

    visuals: List[Dict[str, Any]] = []
    summary = ""
    intent = await _parse_executive_intent(message)

    async with AsyncSessionLocal() as session:
        total_work_orders = (await session.execute(select(func.count(WorkOrder.WorkOrderId)))).scalar_one()
        in_progress_work_orders = (await session.execute(
            select(func.count(WorkOrder.WorkOrderId)).where(WorkOrder.Status == "In Progress")
        )).scalar_one()
        active_alerts = (await session.execute(
            select(func.count(AlertMaster.AlertId)).where(AlertMaster.IsResolved == False)
        )).scalar_one()
        running_machines = (await session.execute(
            select(func.count(MachineMaster.MachineId)).where(MachineMaster.Status == "Running")
        )).scalar_one()
        total_machines = (await session.execute(select(func.count(MachineMaster.MachineId)))).scalar_one()
        inventory_qty = (await session.execute(select(func.coalesce(func.sum(InventoryByLot.Quantity), 0.0)))).scalar_one()

    if any(term in query for term in ["hello", "hi", "hey", "good morning", "good afternoon", "good evening"]):
        summary = (
            "Hello. I can help you inspect production, work orders, machine health, inventory, alerts, and sales-style executive summaries."
        )
    elif intent.reply_type == "capability":
        summary = intent.reply or (
            "Yes. I can generate bar, line, pie, histogram, stacked bar, gauge / KPI, flowchart, node-edge, Sankey, and Gantt visuals."
        )
    elif any(term in query for term in ["work order", "workorders", "wo ", " wo", "orders"]):
        summary = (
            f"There are {int(total_work_orders)} work orders in the current dataset, with "
            f"{int(in_progress_work_orders)} in progress. Review active and delayed work orders first, then compare plan versus completion."
        )
    elif any(term in query for term in ["machine", "oee", "capacity", "utilization"]):
        summary = (
            f"Machine performance is the right lens here. {int(running_machines)} of {int(total_machines)} machines are running "
            "in the seeded dataset, so capacity versus utilization is the main executive view."
        )
    elif any(term in query for term in ["inventory", "stock", "material", "raw material"]):
        summary = (
            f"Inventory looks healthy in the current snapshot with roughly {int(inventory_qty):,} units on hand across lots. "
            "A tighter review of low-stock items and blocked quantity would give leadership an early warning."
        )
    elif any(term in query for term in ["sales", "dispatch", "revenue", "forecast"]):
        summary = "Commercial performance is best reviewed as a forecast-versus-actual lens, with dispatch timing used to explain any gaps."
    else:
        summary = (
            "I can help with executive summaries, operational trends, and chart-backed answers. "
            "Try asking for production, inventory, work orders, machine utilization, alerts, or sales."
        )

    if intent.reply_type == "diagram":
        if intent.topic == "machine" or "machine" in query and any(term in query for term in ["diagram", "network", "dependency"]):
            visuals.append(_build_machine_network_visual())
        if intent.diagram_type == "flow" or any(term in query for term in ["pipeline", "workflow", "process"]):
            visuals.append(_build_flow_visual(intent.diagram_type or "flow"))
        elif intent.diagram_type == "sankey":
            visuals.append({
                "type": "flow",
                "title": "Material Flow",
                "nodes": [
                    {"id": "raw", "label": "Raw Material"},
                    {"id": "wip", "label": "WIP"},
                    {"id": "fg", "label": "Finished Goods"},
                ],
                "edges": [
                    {"from": "raw", "to": "wip"},
                    {"from": "wip", "to": "fg"},
                ],
                "meta": {"legend": False, "x_label": "", "y_label": ""},
            })
        else:
            visuals.append(_build_flow_visual("flow"))
    elif intent.reply_type == "chart" or intent.wants_visual:
        topic = intent.topic if intent.topic in {"work_order", "machine", "inventory", "sales"} else (
            "work_order" if any(term in query for term in ["work order", "workorders", "wo ", " wo", "orders"]) else
            "machine" if any(term in query for term in ["machine", "oee", "capacity", "utilization"]) else
            "inventory" if any(term in query for term in ["inventory", "stock", "material", "raw material"]) else
            "sales" if any(term in query for term in ["sales", "dispatch", "revenue", "forecast"]) else
            "general"
        )
        chart_type = intent.chart_type or "bar"
        visuals.append(_build_chart_payload(topic, chart_type))

    return {
        "message": summary,
        "visuals": visuals,
    }

@router.post("/api/executive-insights/chat")
async def executive_insights_chat(req: ExecutiveInsightsRequest):
    response = await _build_executive_insights_response(req.message)
    return {
        "status": "success",
        "thread_id": req.thread_id or f"exec-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}",
        "reply": response["message"],
        "visuals": response["visuals"],
    }

@router.post("/api/executive-insights/stream")
async def executive_insights_stream(req: ExecutiveInsightsRequest):
    async def event_generator():
        response = await _build_executive_insights_response(req.message)
        yield f"data: {json.dumps({'type': 'message', 'text': response['message']})}\n\n"
        for visual in response["visuals"]:
            await asyncio.sleep(0.15)
            yield f"data: {json.dumps({'type': 'visual', 'visual': visual})}\n\n"
        yield f"data: {json.dumps({'type': 'done'})}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")

@router.get("/api/agent-reporting/settings")
async def get_reporting_settings():
    async with AsyncSessionLocal() as session:
        result = await session.execute(select(AgentReportingSettings))
        settings = result.scalars().first()
        if not settings:
            return JSONResponse(status_code=404, content={"error": "Settings not initialized"})
        return {
            "is_enabled": settings.is_enabled,
            "email": settings.email,
            "schedule_time": settings.schedule_time,
            "prompt": settings.prompt
        }

@router.post("/api/agent-reporting/settings")
async def update_reporting_settings(req: ReportingSettingsRequest):
    async with AsyncSessionLocal() as session:
        result = await session.execute(select(AgentReportingSettings))
        settings = result.scalars().first()
        if not settings:
            settings = AgentReportingSettings()
            session.add(settings)
            
        settings.is_enabled = req.is_enabled
        settings.email = req.email
        settings.schedule_time = req.schedule_time
        settings.prompt = req.prompt
        
        await session.commit()
        return {"status": "success", "message": "Reporting settings saved."}


# ── Safety & Quality Agent ────────────────────────────────────────────────────

@router.post("/api/safety-agent/chat")
async def safety_quality_chat(req: SafetyQualityChatRequest):
    """Chat endpoint for the Deva Safety & Quality LangGraph agent."""
    result = await run_safety_quality_conversation(req.message, req.thread_id)
    return {
        "status": "success",
        "thread_id": result["thread_id"],
        "reply": result["reply"],
    }
