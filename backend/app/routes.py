import asyncio
import hashlib
import os
import secrets
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect, status, Request
from fastapi.responses import JSONResponse, StreamingResponse, HTMLResponse, RedirectResponse
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
import jwt
import bcrypt
import json
from pydantic import BaseModel
from sqlalchemy import select, update, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import (
    get_db, AsyncSessionLocal, User, AlertMaster, WorkOrder, MachineMaster, InventoryByLot,
    mes_db_status, video_analytics_db_status, test_mes_connection, test_video_analytics_connection,
    AgentReportingSettings, GlobalGovernanceSettings, UserProfile,
    UseCaseGovernanceSettings, PlatformNotification, ReportApproval, OneTimeToken
)
from app.llm_gateway import execute_completion, get_usage_audit
from app.guardrails_firewall import validate_query_safety
from app.agents.agent_workflow import run_agent_workflow, AgentState
from app.agents.maintenance_agent import run_maintenance_conversation
from app.agents.safety_quality_agent import run_safety_quality_conversation
from app.agents.ppe_vision_agent import run_ppe_conversation
from app.agents.safety_site_intelligence_agent import run_safety_site_intelligence_conversation
from app.agents.permit_to_work_agent import run_ptw_conversation
from app.agents.incident_investigation_agent import (
    run_incident_investigation_conversation,
    stream_incident_investigation_events,
)
from app.email_service import send_pdf_report_email, send_text_email, send_html_email
from app.voice.manager import VoiceConversationManager

router = APIRouter()

SECRET_KEY = os.getenv("JWT_SECRET_KEY", "IIOT_MANUFACTURING_SECRET_KEY_JWT")
ALGORITHM = "HS256"
REPORT_APPROVAL_EMAIL_SECRET = os.getenv("REPORT_APPROVAL_EMAIL_SECRET", SECRET_KEY)
PUBLIC_API_URL = os.getenv("PUBLIC_API_URL", "http://127.0.0.1:8000").rstrip("/")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000").rstrip("/")

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

class IntegrationToggleRequest(BaseModel):
    name: str
    enabled: bool

class GovernanceSettingToggleRequest(BaseModel):
    setting_key: str  # e.g. 'explainability_logging', 'hitl_approval'
    enabled: bool


class UseCaseHITLRequest(BaseModel):
    enabled: bool


class ProfileUpdateRequest(BaseModel):
    name: str


class EmailVerificationRequest(BaseModel):
    email: str


class OTPVerificationRequest(BaseModel):
    code: str


class PasswordResetRequest(BaseModel):
    password: str


class PasswordResetConfirmRequest(BaseModel):
    code: str
    password: str


class ApprovalDecisionRequest(BaseModel):
    note: str = ""

class MaintenanceChatRequest(BaseModel):
    message: str
    thread_id: Optional[str] = None

class SafetyQualityChatRequest(BaseModel):
    message: str
    thread_id: Optional[str] = None

class PPEVisionChatRequest(BaseModel):
    message: str
    thread_id: Optional[str] = None

class SafetySiteIntelligenceChatRequest(BaseModel):
    message: str
    thread_id: Optional[str] = None
    ui_context: Optional[Dict[str, Any]] = None

class PermitToWorkChatRequest(BaseModel):
    message: str
    thread_id: Optional[str] = None

class IncidentInvestigationChatRequest(BaseModel):
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

MAX_OTP_ATTEMPTS = 5
OTP_EXPIRY_MINUTES = 10


async def get_current_user(request: Request, db: AsyncSession) -> User:
    """Resolve the authenticated user from the bearer token; never trust client-supplied identity."""
    authorization = request.headers.get("Authorization", "")
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")
    try:
        payload = jwt.decode(authorization.removeprefix("Bearer "), SECRET_KEY, algorithms=[ALGORITHM])
        username = payload.get("sub")
    except jwt.PyJWTError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired access token") from exc
    user = (await db.execute(select(User).where(User.username == username))).scalars().first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authenticated user no longer exists")
    return user


def _hash_one_time_code(code: str) -> str:
    return hashlib.sha256(code.encode("utf-8")).hexdigest()


async def _create_notification(
    db: AsyncSession, *, recipient_user_id: Optional[int], category: str, title: str,
    message: str, source_type: Optional[str] = None, source_id: Optional[str] = None,
) -> PlatformNotification:
    notification = PlatformNotification(
        recipient_user_id=recipient_user_id, category=category, title=title, message=message,
        source_type=source_type, source_id=source_id,
    )
    db.add(notification)
    await db.flush()
    return notification


async def _email_verified_super_admins(db: AsyncSession, approval_key: str, report_url: str) -> int:
    """Send the approval request only to verified Super Admin profile emails."""
    profiles = (await db.execute(
        select(UserProfile).join(User, User.id == UserProfile.user_id).where(
            User.role == "Super Admin", UserProfile.email_verified.is_(True)
        )
    )).scalars().all()
    delivered = 0
    for profile in profiles:
        expires = datetime.utcnow() + timedelta(hours=24)
        approve_token = jwt.encode({"scope": "report_approval_email", "approval_key": approval_key, "decision": "approve", "user_id": profile.user_id, "exp": expires}, REPORT_APPROVAL_EMAIL_SECRET, algorithm=ALGORITHM)
        reject_token = jwt.encode({"scope": "report_approval_email", "approval_key": approval_key, "decision": "reject", "user_id": profile.user_id, "exp": expires}, REPORT_APPROVAL_EMAIL_SECRET, algorithm=ALGORITHM)
        approve_url = f"{PUBLIC_API_URL}/api/report-approvals/email-action?token={approve_token}"
        reject_url = f"{PUBLIC_API_URL}/api/report-approvals/email-action?token={reject_token}"
        body = f"A Daily Operations report PDF is awaiting Human-in-the-Loop approval.\n\nReport reference: {approval_key}\nReview PDF: {report_url or 'Available in the MAI Admin Console'}\n\nApprove: {approve_url}\nReject: {reject_url}\n\nThe links expire in 24 hours and can be used only once."
        html = f"""<div style='font-family:Arial,sans-serif;color:#17324d;max-width:600px'><h2>Daily Operations report approval required</h2><p>A PDF has been generated and is waiting for your Human-in-the-Loop decision.</p><p><b>Report reference:</b> {approval_key}<br><a href='{report_url}'>Review PDF</a></p><p><a href='{approve_url}' style='display:inline-block;background:#0e6b52;color:#fff;padding:12px 18px;border-radius:6px;text-decoration:none;font-weight:bold'>Approve &amp; Send Report</a>&nbsp;<a href='{reject_url}' style='display:inline-block;background:#fff;color:#a12b2b;padding:12px 18px;border:1px solid #d39a9a;border-radius:6px;text-decoration:none;font-weight:bold'>Reject Report</a></p><p style='font-size:12px;color:#667'>These signed links expire in 24 hours and the decision can be applied only once.</p></div>"""
        if send_html_email(profile.email, "Approval required: Daily Operations report", body, html):
            delivered += 1
    return delivered


def _is_admin(user: User) -> bool:
    return user.role == "Super Admin"

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


@router.get("/api/profile")
async def get_profile(request: Request, db: AsyncSession = Depends(get_db)):
    user = await get_current_user(request, db)
    profile = (await db.execute(select(UserProfile).where(UserProfile.user_id == user.id))).scalars().first()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile is not initialized")
    return {
        "name": profile.name, "email": profile.email, "email_verified": profile.email_verified,
        "role": user.role, "site": user.site, "username": user.username,
    }


@router.patch("/api/profile")
async def update_profile(req: ProfileUpdateRequest, request: Request, db: AsyncSession = Depends(get_db)):
    user = await get_current_user(request, db)
    name = req.name.strip()
    if not 2 <= len(name) <= 120:
        raise HTTPException(status_code=422, detail="Name must contain between 2 and 120 characters")
    profile = (await db.execute(select(UserProfile).where(UserProfile.user_id == user.id))).scalars().first()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile is not initialized")
    profile.name = name
    await db.commit()
    return {"status": "success", "name": profile.name}


async def _issue_otp(db: AsyncSession, user: User, purpose: str, pending_value: Optional[str] = None) -> str:
    await db.execute(
        update(OneTimeToken)
        .where(OneTimeToken.user_id == user.id, OneTimeToken.purpose == purpose, OneTimeToken.consumed_at.is_(None))
        .values(consumed_at=datetime.utcnow())
    )
    code = f"{secrets.randbelow(1_000_000):06d}"
    db.add(OneTimeToken(
        user_id=user.id, purpose=purpose, token_hash=_hash_one_time_code(code), pending_value=pending_value,
        expires_at=datetime.utcnow() + timedelta(minutes=OTP_EXPIRY_MINUTES),
    ))
    await db.flush()
    return code


@router.post("/api/profile/email/request-verification")
async def request_email_verification(req: EmailVerificationRequest, request: Request, db: AsyncSession = Depends(get_db)):
    user = await get_current_user(request, db)
    email = req.email.strip().lower()
    if "@" not in email or len(email) > 254:
        raise HTTPException(status_code=422, detail="Enter a valid email address")
    existing = (await db.execute(select(UserProfile).where(UserProfile.email == email, UserProfile.user_id != user.id))).scalars().first()
    if existing:
        raise HTTPException(status_code=409, detail="This email is already in use")
    code = await _issue_otp(db, user, "verify_email", email)
    await db.commit()
    if not send_text_email(email, "Verify your MAI Platform email", f"Your verification code is {code}. It expires in {OTP_EXPIRY_MINUTES} minutes."):
        raise HTTPException(status_code=503, detail="Verification email could not be delivered. Check SMTP configuration before retrying.")
    return {"status": "sent", "expires_in_minutes": OTP_EXPIRY_MINUTES}


@router.post("/api/profile/email/verify")
async def verify_email(req: OTPVerificationRequest, request: Request, db: AsyncSession = Depends(get_db)):
    user = await get_current_user(request, db)
    token = (await db.execute(
        select(OneTimeToken).where(OneTimeToken.user_id == user.id, OneTimeToken.purpose == "verify_email", OneTimeToken.consumed_at.is_(None)).order_by(OneTimeToken.created_at.desc())
    )).scalars().first()
    if not token or token.expires_at < datetime.utcnow() or token.attempts >= MAX_OTP_ATTEMPTS:
        raise HTTPException(status_code=400, detail="Verification code is expired or unavailable")
    token.attempts += 1
    if not secrets.compare_digest(token.token_hash, _hash_one_time_code(req.code.strip())):
        await db.commit()
        raise HTTPException(status_code=400, detail="Invalid verification code")
    profile = (await db.execute(select(UserProfile).where(UserProfile.user_id == user.id))).scalars().first()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile is not initialized")
    profile.email, profile.email_verified, token.consumed_at = token.pending_value, True, datetime.utcnow()
    await db.commit()
    return {"status": "verified", "email": profile.email}


@router.post("/api/profile/password/request-reset")
async def request_password_reset(request: Request, db: AsyncSession = Depends(get_db)):
    user = await get_current_user(request, db)
    profile = (await db.execute(select(UserProfile).where(UserProfile.user_id == user.id))).scalars().first()
    if not profile or not profile.email_verified:
        raise HTTPException(status_code=409, detail="Verify an email address before requesting a password reset")
    code = await _issue_otp(db, user, "reset_password")
    await db.commit()
    if not send_text_email(profile.email, "Reset your MAI Platform password", f"Your password reset code is {code}. It expires in {OTP_EXPIRY_MINUTES} minutes."):
        raise HTTPException(status_code=503, detail="Password reset email could not be delivered. Check SMTP configuration before retrying.")
    return {"status": "sent", "expires_in_minutes": OTP_EXPIRY_MINUTES}


@router.post("/api/profile/password/confirm-reset")
async def confirm_password_reset(req: PasswordResetConfirmRequest, request: Request, db: AsyncSession = Depends(get_db)):
    user = await get_current_user(request, db)
    if len(req.password) < 12:
        raise HTTPException(status_code=422, detail="Password must be at least 12 characters")
    token = (await db.execute(
        select(OneTimeToken).where(OneTimeToken.user_id == user.id, OneTimeToken.purpose == "reset_password", OneTimeToken.consumed_at.is_(None)).order_by(OneTimeToken.created_at.desc())
    )).scalars().first()
    if not token or token.expires_at < datetime.utcnow() or token.attempts >= MAX_OTP_ATTEMPTS:
        raise HTTPException(status_code=400, detail="Password reset code is expired or unavailable")
    token.attempts += 1
    if not secrets.compare_digest(token.token_hash, _hash_one_time_code(req.code.strip())):
        await db.commit()
        raise HTTPException(status_code=400, detail="Invalid password reset code")
    user.password_hash = bcrypt.hashpw(req.password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
    token.consumed_at = datetime.utcnow()
    await db.commit()
    return {"status": "success"}

# --- TELEMETRY & STATS ---

@router.get("/api/telemetry")
async def get_telemetry(db: AsyncSession = Depends(get_db)):
    # Dynamically re-verify DB connections if disconnected or cached timer expired
    current_mes_status = test_mes_connection()
    current_va_status = test_video_analytics_connection()
    
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
        "mes_db_status": current_mes_status,
        "video_analytics_db_status": current_va_status
    }

# --- INTEGRATIONS ---

@router.get("/api/admin/integrations")
async def get_integrations(db: AsyncSession = Depends(get_db)):
    from app.db import IntegrationConfig
    result = await db.execute(select(IntegrationConfig))
    integrations = result.scalars().all()
    return [{"name": i.name, "is_enabled": i.is_enabled} for i in integrations]

@router.post("/api/admin/integrations/toggle")
async def toggle_integration(req: IntegrationToggleRequest, db: AsyncSession = Depends(get_db)):
    from app.db import IntegrationConfig
    result = await db.execute(select(IntegrationConfig).where(IntegrationConfig.name == req.name))
    integration = result.scalars().first()
    if integration:
        integration.is_enabled = req.enabled
        await db.commit()
        return {"status": "success", "name": req.name, "is_enabled": req.enabled}
    raise HTTPException(status_code=404, detail="Integration not found")


# --- GLOBAL GOVERNANCE SETTINGS ---

@router.get("/api/admin/governance/settings")
async def get_governance_settings(db: AsyncSession = Depends(get_db)):
    """Returns all global governance settings (explainability, HITL, kill switch)."""
    from app.db import GlobalGovernanceSettings
    result = await db.execute(select(GlobalGovernanceSettings))
    settings = result.scalars().all()
    return [
        {
            "setting_key": s.setting_key,
            "is_enabled": s.is_enabled,
            "label": s.label,
            "description": s.description,
        }
        for s in settings
    ]

@router.post("/api/admin/governance/settings")
async def toggle_governance_setting(req: GovernanceSettingToggleRequest, db: AsyncSession = Depends(get_db)):
    """Toggles a specific global governance setting and persists to the database."""
    from app.db import GlobalGovernanceSettings
    result = await db.execute(
        select(GlobalGovernanceSettings).where(GlobalGovernanceSettings.setting_key == req.setting_key)
    )
    setting = result.scalars().first()
    if not setting:
        raise HTTPException(status_code=404, detail=f"Governance setting '{req.setting_key}' not found")
    setting.is_enabled = req.enabled
    await db.commit()
    return {"status": "success", "setting_key": req.setting_key, "is_enabled": req.enabled}


@router.get("/api/use-cases/daily-operations-reporting/governance")
async def get_daily_reporting_governance(db: AsyncSession = Depends(get_db)):
    setting = (await db.execute(
        select(UseCaseGovernanceSettings).where(UseCaseGovernanceSettings.use_case_key == "daily_operations_reporting")
    )).scalars().first()
    global_setting = (await db.execute(
        select(GlobalGovernanceSettings).where(GlobalGovernanceSettings.setting_key == "hitl_approval")
    )).scalars().first()
    return {
        "hitl_enabled": bool(setting and setting.hitl_enabled),
        "global_hitl_enabled": bool(global_setting and global_setting.is_enabled),
        "effective_hitl_enabled": bool(setting and setting.hitl_enabled and global_setting and global_setting.is_enabled),
    }


@router.put("/api/use-cases/daily-operations-reporting/governance")
async def update_daily_reporting_governance(req: UseCaseHITLRequest, request: Request, db: AsyncSession = Depends(get_db)):
    user = await get_current_user(request, db)
    if not _is_admin(user):
        raise HTTPException(status_code=403, detail="Only a Super Admin can change HITL configuration")
    setting = (await db.execute(
        select(UseCaseGovernanceSettings).where(UseCaseGovernanceSettings.use_case_key == "daily_operations_reporting")
    )).scalars().first()
    if not setting:
        setting = UseCaseGovernanceSettings(use_case_key="daily_operations_reporting")
        db.add(setting)
    setting.hitl_enabled = req.enabled
    await db.commit()
    return {"status": "success", "hitl_enabled": setting.hitl_enabled}


@router.get("/api/notifications")
async def get_notifications(request: Request, category: Optional[str] = None, unread_only: bool = False, db: AsyncSession = Depends(get_db)):
    user = await get_current_user(request, db)
    query = select(PlatformNotification)
    if not _is_admin(user):
        query = query.where((PlatformNotification.recipient_user_id == user.id) | (PlatformNotification.recipient_user_id.is_(None)))
    if category and category != "all":
        query = query.where(PlatformNotification.category == category)
    if unread_only:
        query = query.where(PlatformNotification.is_read.is_(False))
    notifications = (await db.execute(query.order_by(PlatformNotification.created_at.desc()).limit(100))).scalars().all()
    return [{
        "id": n.id, "category": n.category, "title": n.title, "message": n.message,
        "source_type": n.source_type, "source_id": n.source_id, "is_read": n.is_read,
        "created_at": n.created_at.isoformat(),
    } for n in notifications]


@router.post("/api/notifications/{notification_id}/read")
async def mark_notification_read(notification_id: int, request: Request, db: AsyncSession = Depends(get_db)):
    user = await get_current_user(request, db)
    notification = (await db.execute(select(PlatformNotification).where(PlatformNotification.id == notification_id))).scalars().first()
    if not notification or (not _is_admin(user) and notification.recipient_user_id not in (None, user.id)):
        raise HTTPException(status_code=404, detail="Notification not found")
    notification.is_read = True
    await db.commit()
    return {"status": "success"}


@router.get("/api/report-approvals")
async def list_report_approvals(request: Request, db: AsyncSession = Depends(get_db)):
    user = await get_current_user(request, db)
    query = select(ReportApproval).order_by(ReportApproval.created_at.desc())
    if not _is_admin(user):
        query = query.where(ReportApproval.requested_by_user_id == user.id)
    approvals = (await db.execute(query.limit(100))).scalars().all()
    return [{
        "approval_key": approval.approval_key, "status": approval.status, "query": approval.query,
        "report_url": approval.report_url, "created_at": approval.created_at.isoformat(),
        "decision_note": approval.decision_note,
    } for approval in approvals]


@router.post("/api/report-approvals/{approval_key}/{decision}")
async def decide_report_approval(approval_key: str, decision: str, req: ApprovalDecisionRequest, request: Request, db: AsyncSession = Depends(get_db)):
    user = await get_current_user(request, db)
    if not _is_admin(user):
        raise HTTPException(status_code=403, detail="Only a Super Admin can approve or reject reports")
    if decision not in {"approve", "reject"}:
        raise HTTPException(status_code=422, detail="Decision must be approve or reject")
    approval = (await db.execute(select(ReportApproval).where(ReportApproval.approval_key == approval_key).with_for_update())).scalars().first()
    if not approval:
        raise HTTPException(status_code=404, detail="Approval request not found")
    if approval.status != "PENDING_APPROVAL":
        return {"status": approval.status, "message": "This report has already been decided."}
    approval.approver_user_id = user.id
    approval.decision_note = req.note.strip() or None
    approval.decided_at = datetime.utcnow()
    if decision == "reject":
        approval.status = "REJECTED"
        await _create_notification(db, recipient_user_id=approval.requested_by_user_id, category="human_intervention", title="Daily report rejected", message="A report requires revision before it can be dispatched.", source_type="report_approval", source_id=approval.approval_key)
        await db.commit()
        return {"status": approval.status}
    if not approval.recipient_email:
        raise HTTPException(status_code=409, detail="No recipient email was supplied when this report was generated")
    approval.status = "APPROVED"
    delivered = send_pdf_report_email(approval.recipient_email, "Approved Agentic Daily Operations Report", "Please find the approved report attached.", approval.report_path)
    approval.status = "SENT" if delivered else "APPROVED"
    await _create_notification(db, recipient_user_id=approval.requested_by_user_id, category="system", title="Daily report approved" if delivered else "Daily report approved; delivery failed", message="The approved PDF was sent to the configured recipient." if delivered else "The PDF remains approved but SMTP delivery failed. Check mail configuration.", source_type="report_approval", source_id=approval.approval_key)
    await db.commit()
    return {"status": approval.status, "email_status": "sent" if delivered else "failed"}


@router.api_route("/api/report-approvals/email-action", methods=["GET", "POST"], response_class=HTMLResponse)
async def decide_report_from_email(token: str, request: Request, db: AsyncSession = Depends(get_db)):
    """Apply a signed email decision once; no browser session or hardcoded email is trusted."""
    try:
        payload = jwt.decode(token, REPORT_APPROVAL_EMAIL_SECRET, algorithms=[ALGORITHM])
        if payload.get("scope") != "report_approval_email" or payload.get("decision") not in {"approve", "reject"}:
            raise jwt.InvalidTokenError("Invalid approval token scope")
        approval_key, decision, user_id = payload["approval_key"], payload["decision"], int(payload["user_id"])
    except (jwt.PyJWTError, KeyError, ValueError):
        return HTMLResponse("<h2>Invalid or expired approval link</h2><p>This action link is no longer valid. Open MAI Admin Console to review the report.</p>", status_code=400)

    profile = (await db.execute(
        select(UserProfile).join(User, User.id == UserProfile.user_id).where(
            UserProfile.user_id == user_id, User.role == "Super Admin", UserProfile.email_verified.is_(True)
        )
    )).scalars().first()
    if not profile:
        return HTMLResponse("<h2>Approval not authorized</h2><p>The intended Super Admin profile is no longer verified.</p>", status_code=403)

    # Email security scanners commonly prefetch GET links. Render a confirmation page
    # first so the signed action runs only after an intentional browser POST.
    if request.method == "GET":
        action_label = "Approve &amp; Send Report" if decision == "approve" else "Reject Report"
        color = "#0e6b52" if decision == "approve" else "#a12b2b"
        return HTMLResponse(f"""<div style='font-family:Arial,sans-serif;max-width:560px;margin:48px auto;color:#17324d'><h2>Confirm report decision</h2><p>You are about to <b>{decision}</b> Daily Operations report <code>{approval_key}</code>.</p><p>This action is irreversible and can be completed only once.</p><form method='post' action='?token={token}'><button type='submit' style='background:{color};color:white;border:0;border-radius:6px;padding:12px 18px;font-weight:bold;cursor:pointer'>{action_label}</button></form></div>""")

    approval = (await db.execute(select(ReportApproval).where(ReportApproval.approval_key == approval_key).with_for_update())).scalars().first()
    if not approval:
        return HTMLResponse("<h2>Report approval not found</h2>", status_code=404)
    if approval.status != "PENDING_APPROVAL":
        return HTMLResponse(f"<h2>No action needed</h2><p>This report has already been decided: <b>{approval.status}</b>.</p>")

    approval.approver_user_id = user_id
    approval.decided_at = datetime.utcnow()
    if decision == "reject":
        approval.status = "REJECTED"
        await _create_notification(db, recipient_user_id=approval.requested_by_user_id, category="human_intervention", title="Daily report rejected", message="A report requires revision before it can be dispatched.", source_type="report_approval", source_id=approval.approval_key)
        await db.commit()
        return RedirectResponse(url=f"{FRONTEND_URL}/admin?pane=notifications&approval={approval_key}", status_code=303)

    if not approval.recipient_email:
        return HTMLResponse("<h2>Cannot send report</h2><p>No recipient email was configured for this report.</p>", status_code=409)
    approval.status = "APPROVED"
    delivered = send_pdf_report_email(approval.recipient_email, "Approved Agentic Daily Operations Report", "Please find the approved report attached.", approval.report_path)
    approval.status = "SENT" if delivered else "APPROVED"
    await _create_notification(db, recipient_user_id=approval.requested_by_user_id, category="system", title="Daily report approved" if delivered else "Daily report approved; delivery failed", message="The approved PDF was sent to the configured recipient." if delivered else "The PDF remains approved but SMTP delivery failed. Check mail configuration.", source_type="report_approval", source_id=approval.approval_key)
    await db.commit()
    if delivered:
        return RedirectResponse(url=f"{FRONTEND_URL}/admin?pane=notifications&approval={approval_key}", status_code=303)
    return HTMLResponse("<h2>Report approved, but delivery failed</h2><p>The report remains approved. Check SMTP configuration before retrying delivery.</p>", status_code=502)


# --- INTEGRATION ACCESS GUARD ---
# Call _require_integration(name) at the top of any agent endpoint that depends on
# a specific integration.  Raises HTTP 503 with a descriptive message if disabled.

def _require_integration(name: str) -> None:
    """Guard: raise HTTP 503 if the named integration is disabled in the MAI database.

    Args:
        name: The integration key, e.g. 'MES' or 'Video Analytics'.

    Raises:
        HTTPException(503): With a human-readable message the frontend can display
            directly in the chat UI or agent console.
    """
    from app.db import is_integration_enabled
    if not is_integration_enabled(name):
        if name == "MES":
            msg = (
                "Please connect your MES application so we can use it. "
                "Enable the MES integration in Admin Console → Integrations."
            )
        elif name == "Video Analytics":
            msg = (
                "Please connect Video Analytics so we can use it. "
                "Enable the Video Analytics integration in Admin Console → Integrations."
            )
        else:
            msg = (
                f"The '{name}' integration is currently disabled. "
                "Please enable it in Admin Console → Integrations."
            )
        raise HTTPException(status_code=503, detail=msg)


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
async def websocket_voice_endpoint(websocket: WebSocket, agent: Optional[str] = "auto"):
    await websocket.accept()
    manager = VoiceConversationManager(websocket, agent_id=agent or "auto")
    try:
        while True:
            # We receive raw PCM audio (bytes) or control messages (text/JSON)
            message = await websocket.receive()

            if "bytes" in message:
                # Binary frames = raw PCM audio from VoiceStreamingWorklet
                await manager.handle_audio_frame(message["bytes"])

            elif "text" in message:
                try:
                    data = json.loads(message["text"])
                except json.JSONDecodeError:
                    continue

                msg_type = data.get("type")

                if msg_type == "audio":
                    # Base64-encoded audio (alternative client encoding)
                    import base64
                    pcm = base64.b64decode(data.get("data", ""))
                    await manager.handle_audio_frame(pcm)

                elif msg_type == "audio_played":
                    # Frontend acks how much audio was actually played (for interruption handling)
                    manager.played_text = data.get("text", "")

                elif msg_type == "set_agent":
                    await manager.set_agent(data.get("agent", "auto"))

                elif msg_type in ["query", "query_text", "user_text"]:
                    await manager.process_text_turn(data.get("text", ""))

                elif msg_type == "ping":
                    import asyncio
                    await websocket.send_json(
                        {"type": "pong", "ts": asyncio.get_event_loop().time()}
                    )

    except WebSocketDisconnect:
        pass  # Normal client disconnect — cleanup handled in finally
    except Exception as e:
        # Log but do not re-raise: cleanup must always run
        import logging
        logging.getLogger("voice.ws").error(f"Voice WS error: {e}")
    finally:
        # CRITICAL: cancel all pending tasks and release buffers
        await manager.cleanup()


# --- AGENTIC QUERY ENDPOINTS ---

@router.post("/api/agent/query")
async def query_agent(req: QueryRequest, request: Request, db: AsyncSession = Depends(get_db)):
    current_user = await get_current_user(request, db)
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
        agent_id = getattr(req, "agent", None)
        # Apply integration guards before branching
        if agent_id == "maintenance":
            _require_integration("MES")
        elif agent_id in ["permit-to-work", "ptw", "permit"]:
            _require_integration("MES")
        elif agent_id in ["incident-investigation", "incident", "investigation", "forensic"]:
            _require_integration("MES")
        else:
            # Default / reporting / operations workflow also requires MES
            _require_integration("MES")

        if agent_id == "maintenance":
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
        elif getattr(req, "agent", None) in ["permit-to-work", "ptw", "permit"]:
            ptw_res = await run_ptw_conversation(req.query)
            return {
                "status": "success",
                "sql_query": "",
                "sql_result": "",
                "insights": ptw_res.get("reply", ""),
                "execution_steps": [],
                "pdf_url": "",
                "email_status": None,
                "error_message": "",
                "cost_usd": 0.0,
                "visuals": [],
            }
        elif getattr(req, "agent", None) in ["incident-investigation", "incident", "investigation", "forensic"]:
            inv_res = await run_incident_investigation_conversation(req.query)
            return {
                "status": "success",
                "sql_query": "",
                "sql_result": "",
                "insights": inv_res.get("reply", ""),
                "execution_steps": [f"Executed {t.get('name')}" for t in inv_res.get("tools_used", [])],
                "pdf_url": "",
                "email_status": None,
                "error_message": "",
                "cost_usd": inv_res.get("cost_usd", 0.0),
                "visuals": [],
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

        # Report dispatch uses a two-level permission: the global master switch AND the UC01 switch.
        # The exact generated PDF is retained; it is never regenerated after approval.
        if state.get("pdf_path"):
            global_hitl = (await db.execute(
                select(GlobalGovernanceSettings).where(GlobalGovernanceSettings.setting_key == "hitl_approval")
            )).scalars().first()
            local_hitl = (await db.execute(
                select(UseCaseGovernanceSettings).where(UseCaseGovernanceSettings.use_case_key == "daily_operations_reporting")
            )).scalars().first()
            if bool(global_hitl and global_hitl.is_enabled and local_hitl and local_hitl.hitl_enabled):
                reporting_settings = (await db.execute(select(AgentReportingSettings))).scalars().first()
                recipient_email = req.email_to or (reporting_settings.email if reporting_settings else None)
                approval_key = secrets.token_urlsafe(24)
                approval = ReportApproval(
                    approval_key=approval_key,
                    use_case_key="daily_operations_reporting",
                    requested_by_user_id=current_user.id,
                    recipient_email=recipient_email,
                    report_path=state["pdf_path"],
                    report_url=state.get("pdf_url", ""),
                    query=req.query,
                )
                db.add(approval)
                await db.flush()
                await _create_notification(
                    db, recipient_user_id=None, category="human_intervention",
                    title="Daily Operations report requires approval",
                    message="A generated PDF is awaiting a Super Admin decision before it is dispatched.",
                    source_type="report_approval", source_id=approval_key,
                )
                await db.commit()
                emailed_admins = await _email_verified_super_admins(db, approval_key, state.get("pdf_url", ""))
                if not emailed_admins:
                    # The notification is already persisted; surface the missing verified recipient explicitly.
                    await _create_notification(
                        db, recipient_user_id=current_user.id, category="alert",
                        title="Approval email was not delivered",
                        message="No verified Super Admin profile email is available. Approve the report from Admin Console.",
                        source_type="report_approval", source_id=approval_key,
                    )
                    await db.commit()
                return {
                    "status": "requires_approval", "approval_key": approval_key,
                    "pdf_url": state.get("pdf_url", ""), "sql_query": state.get("sql_query", ""),
                    "execution_steps": state.get("execution_steps", []),
                    "insights": "The PDF has been generated and is pending Human-in-the-Loop approval before dispatch.",
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
    _require_integration("MES")
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
        schedule_changed = settings.schedule_time != req.schedule_time
        was_disabled = not settings.is_enabled
        settings.is_enabled = req.is_enabled
        settings.email = req.email
        settings.schedule_time = req.schedule_time
        settings.prompt = req.prompt
        # A newly enabled schedule or an edited delivery time should be eligible to run.
        # Keeping an old completion date here would incorrectly suppress today's new schedule.
        if schedule_changed or (req.is_enabled and was_disabled):
            settings.last_run_date = None
        
        await session.commit()
        return {"status": "success", "message": "Reporting settings saved."}


# ── Safety & Quality Agent ────────────────────────────────────────────────────

@router.post("/api/safety-agent/chat")
async def safety_quality_chat(req: SafetyQualityChatRequest):
    """Chat endpoint for the Deva Safety & Quality LangGraph agent."""
    _require_integration("Video Analytics")
    result = await run_safety_quality_conversation(req.message, req.thread_id)
    return {
        "status": "success",
        "thread_id": result["thread_id"],
        "reply": result["reply"],
    }


# ── PPE & Behavior Vision Agent ───────────────────────────────────────────────

@router.post("/api/ppe-agent/chat")
async def ppe_vision_chat(req: PPEVisionChatRequest):
    """Chat endpoint for the Deva PPE & Behavior Vision LangGraph agent."""
    _require_integration("Video Analytics")
    result = await run_ppe_conversation(req.message, req.thread_id)
    return {
        "status": "success",
        "thread_id": result["thread_id"],
        "reply": result["reply"],
    }


# ── Safety & Site Intelligence Multi-Agent ───────────────────────────────────

@router.post("/api/safety-site-intelligence/chat")
async def safety_site_intelligence_chat(req: SafetySiteIntelligenceChatRequest):
    """Chat endpoint for the Deva Safety & Site Intelligence Multi-Agent (135 tools) with UI context."""
    _require_integration("Video Analytics")
    result = await run_safety_site_intelligence_conversation(
        req.message,
        thread_id=req.thread_id,
        ui_context=req.ui_context,
    )
    return {
        "status": "success",
        "thread_id": result["thread_id"],
        "reply": result["reply"],
    }


# ── Permit-to-Work Agent ──────────────────────────────────────────────────────

@router.post("/api/permit-to-work/chat")
@router.post("/api/ptw-agent/chat")
async def permit_to_work_chat(req: PermitToWorkChatRequest):
    """Chat endpoint for the Deva Permit-to-Work LangGraph agent (54 tools)."""
    _require_integration("MES")
    result = await run_ptw_conversation(req.message, req.thread_id)
    return {
        "status": "success",
        "thread_id": result["thread_id"],
        "reply": result["reply"],
    }


@router.get("/api/permit-to-work/summary")
async def permit_to_work_summary():
    """Summary KPI metrics for the Permit-to-Work dashboard & agent console."""
    return {
        "status": "success",
        "active_high_risk_contexts": 4,
        "unresolved_breaches": 6,
        "maintenance_windows_open": 2,
        "expired_permits_flagged": 4,
        "safety_compliance_rate": "98.2%",
    }


# ── Spatial Risk Heatmap & Aggregation Engine (UC09) ──────────────────────────

@router.get("/api/safety/heatmap")
@router.get("/api/safety-site-intelligence/heatmap")
async def get_safety_spatial_heatmap(time_filter: str = "30_DAYS"):
    """
    Computes time-based spatial risk scores, violation densities, and coordinates
    for plant zones and rooms (time_filter: 'TODAY', '7_DAYS', '30_DAYS').
    """
    from app.agents.ppe_vision_agent import _ppe_engine
    import pandas as pd
    import json
    from datetime import datetime, timedelta

    # Standard plant master zones with geometric polygons for floor plan canvas
    default_plant_zones = [
        {
            "id": 10,
            "name": "Heavy Stamping & Press Line (Zone 10)",
            "sector": "Sector A - Metalworking",
            "camera_id": 6,
            "camera_name": "Luxshphere PTZ Cam 06",
            "coordinates": [{"x": 0.05, "y": 0.12}, {"x": 0.46, "y": 0.12}, {"x": 0.46, "y": 0.52}, {"x": 0.05, "y": 0.52}],
            "base_incidents": {"TODAY": 4, "7_DAYS": 18, "30_DAYS": 54},
            "violations": {"No Hard Hat": 28, "No Safety Vest": 19, "Restricted Boundary Breach": 7},
        },
        {
            "id": 14,
            "name": "Main Assembly & Robot Bay (Zone 14)",
            "sector": "Sector B - Final Assembly",
            "camera_id": 9,
            "camera_name": "IDIS Denso Cam 09",
            "coordinates": [{"x": 0.52, "y": 0.12}, {"x": 0.95, "y": 0.12}, {"x": 0.95, "y": 0.52}, {"x": 0.52, "y": 0.52}],
            "base_incidents": {"TODAY": 1, "7_DAYS": 6, "30_DAYS": 21},
            "violations": {"No Safety Vest": 12, "No Safety Glasses": 6, "Worker Fatigue Warning": 3},
        },
        {
            "id": 101,
            "name": "Chemical & Solvent Storage Enclosure",
            "sector": "Sector C - HazMat Holding",
            "camera_id": 11,
            "camera_name": "IGL HazMat Cam 11",
            "coordinates": [{"x": 0.05, "y": 0.58}, {"x": 0.32, "y": 0.58}, {"x": 0.32, "y": 0.92}, {"x": 0.05, "y": 0.92}],
            "base_incidents": {"TODAY": 6, "7_DAYS": 27, "30_DAYS": 89},
            "violations": {"Unauthorized Entry": 38, "No Respirator/Mask": 32, "Spill Anomaly": 19},
        },
        {
            "id": 102,
            "name": "Automated Material Conveyor Bay",
            "sector": "Sector D - Logistics & Conveyors",
            "camera_id": 14,
            "camera_name": "Overhead Conveyor Cam 14",
            "coordinates": [{"x": 0.36, "y": 0.58}, {"x": 0.68, "y": 0.58}, {"x": 0.68, "y": 0.92}, {"x": 0.36, "y": 0.92}],
            "base_incidents": {"TODAY": 2, "7_DAYS": 11, "30_DAYS": 36},
            "violations": {"Pinch-point Geofence Breach": 18, "No Hard Hat": 14, "Tool Placement Defect": 4},
        },
        {
            "id": 103,
            "name": "Quality Inspection & Metrology Lab",
            "sector": "Sector E - Quality Testing",
            "camera_id": 15,
            "camera_name": "Quality Lab Test Cam 15",
            "coordinates": [{"x": 0.72, "y": 0.58}, {"x": 0.95, "y": 0.58}, {"x": 0.95, "y": 0.92}, {"x": 0.72, "y": 0.92}],
            "base_incidents": {"TODAY": 0, "7_DAYS": 2, "30_DAYS": 7},
            "violations": {"Material Batch Hold Flag": 4, "Missing ESD Wristband": 3},
        },
    ]

    # Query live DB for any additional zone data or coordinates
    try:
        df_db_zones = pd.read_sql("SELECT z.id, z.name, z.camera_id, z.coordinates, c.name as cam_name FROM zones z LEFT JOIN cameras c ON z.camera_id = c.id WHERE z.is_active = TRUE;", _ppe_engine)
        db_zones_map = {row["id"]: row for _, row in df_db_zones.iterrows()}
    except Exception as e:
        db_zones_map = {}

    tf_norm = time_filter.upper()
    if tf_norm not in ["TODAY", "7_DAYS", "30_DAYS"]:
        tf_norm = "30_DAYS"

    multiplier = 1.0 if tf_norm == "30_DAYS" else (0.35 if tf_norm == "7_DAYS" else 0.12)

    processed_zones = []
    total_violations = 0
    high_risk_count = 0

    for z in default_plant_zones:
        # Override coordinates if DB has specific polygon
        coords = z["coordinates"]
        if z["id"] in db_zones_map and db_zones_map[z["id"]]["coordinates"]:
            db_c = db_zones_map[z["id"]]["coordinates"]
            if isinstance(db_c, list) and len(db_c) >= 3:
                coords = db_c

        inc_count = max(0, int(z["base_incidents"].get(tf_norm, z["base_incidents"]["30_DAYS"] * multiplier)))
        total_violations += inc_count

        # Compute dynamic risk score (0-100)
        if tf_norm == "TODAY":
            score = min(100, int(inc_count * 16 + 10))
        elif tf_norm == "7_DAYS":
            score = min(100, int(inc_count * 4 + 8))
        else:
            score = min(100, int(inc_count * 1.5 + 5))

        if score >= 60:
            risk_level = "high"
            color = "#EF4444"  # Red
            pulse = True
            high_risk_count += 1
        elif score >= 25:
            risk_level = "moderate"
            color = "#F59E0B"  # Orange
            pulse = False
        else:
            risk_level = "safe"
            color = "#10B981"  # Green
            pulse = False

        # Scale violation breakdown
        violations_scaled = {
            k: max(1, int(v * (inc_count / max(1, z["base_incidents"]["30_DAYS"]))))
            for k, v in z["violations"].items()
        }

        processed_zones.append({
            "id": z["id"],
            "name": z["name"],
            "sector": z["sector"],
            "camera_id": z["camera_id"],
            "camera_name": z["camera_name"],
            "coordinates": coords,
            "incident_count": inc_count,
            "risk_score": score,
            "risk_level": risk_level,
            "color": color,
            "pulse": pulse,
            "violations_breakdown": violations_scaled,
            "status": "MONITORED_ACTIVE",
        })

    return {
        "status": "success",
        "time_filter": tf_norm,
        "summary": {
            "total_zones": len(processed_zones),
            "high_risk_zones": high_risk_count,
            "total_incidents": total_violations,
            "active_cameras": len(set(z["camera_id"] for z in processed_zones)),
            "safety_index": max(45, 100 - int(total_violations * 0.4)),
        },
        "zones": processed_zones,
    }


# ── Incident & Investigation Agent ───────────────────────────────────────────

@router.post("/api/incident-investigation/chat")
async def incident_investigation_chat(req: IncidentInvestigationChatRequest):
    """Chat endpoint for Deva Incident & Investigation Agent with full telemetry."""
    _require_integration("MES")
    result = await run_incident_investigation_conversation(req.message, req.thread_id)
    return result


@router.post("/api/incident-investigation/stream")
async def incident_investigation_stream(req: IncidentInvestigationChatRequest):
    """Streaming SSE endpoint for real-time tool animation, token generation, and response telemetry."""
    _require_integration("MES")
    return StreamingResponse(
        stream_incident_investigation_events(req.message, req.thread_id),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/api/incident-investigation/summary")
async def incident_investigation_summary():
    """Summary KPI metrics for the Incident & Investigation dashboard & console."""
    return {
        "status": "success",
        "trir_ytd": "0.42",
        "zero_harm_index": "98.4",
        "open_spill_alerts": 0,
        "active_anomaly_flags": 3,
        "audited_cameras": 24,
        "ltifr_rate": "0.00",
        "safety_audit_status": "OPTIMAL",
    }



