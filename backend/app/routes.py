import asyncio
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, status, Request
from fastapi.responses import JSONResponse
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
import jwt
import bcrypt
import json
from pydantic import BaseModel
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db, AsyncSessionLocal, User, AlertMaster, WorkOrder, MachineMaster, InventoryByLot, mes_db_status, AgentReportingSettings
from app.llm_gateway import execute_completion, get_usage_audit
from app.guardrails_firewall import validate_query_safety
from app.agents.agent_workflow import run_agent_workflow, AgentState
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
    model: str = "gemini-3.5-flash-lite"
    email_to: Optional[str] = None

class ApproveRequest(BaseModel):
    state: Dict[str, Any]

class RuleCreate(BaseModel):
    condition: str
    action: str

class AgentToggleRequest(BaseModel):
    name: str
    enabled: bool

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
        
    # 2. Trigger LangGraph Workflow
    try:
        state = await run_agent_workflow(req.query, is_approved=False)
        
        # If it requires human approval, store it and return status
        if state["requires_hitl"] and not state["is_approved"]:
            workflow_id = f"hitl-{datetime.utcnow().strftime('%s')}"
            paused_workflows[workflow_id] = state
            return {
                "status": "requires_approval",
                "workflow_id": workflow_id,
                "sql_query": state["sql_query"],
                "execution_steps": state["execution_steps"],
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
            "sql_query": state["sql_query"],
            "sql_result": state["sql_result"],
            "insights": state["insights"],
            "execution_steps": state["execution_steps"],
            "pdf_url": state.get("pdf_url", ""),
            "email_status": email_status,
            "error_message": state.get("error_message", ""),
            "cost_usd": get_usage_audit()[-1].get("estimated_cost_usd", 0.0) if get_usage_audit() else 0.0
        }
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Workflow execution failed: {e}")

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

