import os
import asyncio
from datetime import datetime, timedelta
from sqlalchemy import create_engine as create_sync_engine
from urllib.parse import quote_plus
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.pool import NullPool
from sqlalchemy.orm import declarative_base, Mapped, mapped_column
from sqlalchemy import String, Integer, Float, Boolean, DateTime, select, text, JSON, Text
from sqlalchemy.dialects.postgresql import UUID
from typing import Optional, Dict, Any, List
import uuid
from dotenv import load_dotenv
from app.permission_engine import get_permission_catalog

# Load environment variables
load_dotenv()
DB_DRIVER = os.getenv("DB_DRIVER")
DB_SERVER = os.getenv("DB_SERVER")
DB_NAME = os.getenv("DB_NAME")
SQLSERVER_USER = os.getenv("SQLSERVER_USER", "sa")
SQLSERVER_PASSWORD = os.getenv("SQLSERVER_PASSWORD", "")
DB_TRUSTED_CONNECTION = os.getenv("DB_TRUSTED_CONNECTION", "no")
DB_ENCRYPT = os.getenv("DB_ENCRYPT", "no")
DB_TRUST_SERVER_CERTIFICATE = os.getenv("DB_TRUST_SERVER_CERTIFICATE", "yes")
DATABASE_URL = os.getenv("DATABASE_URL")
DATABASE_CONNECT_TIMEOUT_SECONDS = float(os.getenv("DATABASE_CONNECT_TIMEOUT_SECONDS", "10"))

if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL is required but was not configured.")

import time

# Sync engine for pyodbc/MSSQL testing if available
mes_db_status = {
    "connected": False,
    "type": "SQLite (Simulated / Fallback)",
    "details": "Local offline platform db (sqlite)"
}

video_analytics_db_status = {
    "connected": False,
    "type": "SQLite (Simulated / Fallback)",
    "details": "Local offline platform db (sqlite)"
}

sync_mes_engine = None
_last_mes_check_time = 0
_last_va_check_time = 0

def test_mes_connection(force: bool = False) -> dict:
    global mes_db_status, sync_mes_engine, _last_mes_check_time
    now = time.time()
    if not force and mes_db_status["connected"] and (now - _last_mes_check_time < 30):
        return mes_db_status
    if not force and not mes_db_status["connected"] and (now - _last_mes_check_time < 5):
        return mes_db_status

    _last_mes_check_time = now
    try:
        import pyodbc
        authentication = (
            "Trusted_Connection=yes;"
            if DB_TRUSTED_CONNECTION.lower() in {"yes", "true", "1"}
            else f"UID={SQLSERVER_USER};PWD={SQLSERVER_PASSWORD};"
        )
        connection_string = (
            f"DRIVER={{{DB_DRIVER}}};"
            f"SERVER={DB_SERVER};"
            f"DATABASE={DB_NAME};"
            f"{authentication}"
            f"TrustServerCertificate={DB_TRUST_SERVER_CERTIFICATE};"
            f"Encrypt={DB_ENCRYPT};"
            "MARS_Connection=yes;"
        )
        conn = pyodbc.connect(connection_string, timeout=5)
        conn.close()
        
        if sync_mes_engine is None:
            sync_mes_engine = create_sync_engine("mssql+pyodbc:///?odbc_connect=" + quote_plus(connection_string))
            
        mes_db_status = {
            "connected": True,
            "type": "MS SQL Server (Real Connection)",
            "details": f"Connected to server '{DB_SERVER}' database '{DB_NAME}'"
        }
        print("Real MES database (SQL Server) connected successfully!")
    except Exception as e:
        mes_db_status = {
            "connected": False,
            "type": "SQLite (Simulated / Fallback)",
            "details": f"Local offline platform db (sqlite): {e}"
        }
        print("Could not connect to MS SQL Server (using SQLite fallback):", e)
    return mes_db_status


def test_video_analytics_connection(force: bool = False) -> dict:
    global video_analytics_db_status, _last_va_check_time
    now = time.time()
    if not force and video_analytics_db_status["connected"] and (now - _last_va_check_time < 30):
        return video_analytics_db_status
    if not force and not video_analytics_db_status["connected"] and (now - _last_va_check_time < 5):
        return video_analytics_db_status

    _last_va_check_time = now
    try:
        import psycopg2
        from urllib.parse import urlparse
        
        pg_url = os.getenv("CONSTRUCTION_DB_URL")
        # Convert SQLAlchemy DSN format (postgresql+psycopg2://...) to psycopg2 format (postgresql://...)
        pg_url_psycopg2 = pg_url.replace("postgresql+psycopg2://", "postgresql://")
        
        conn = psycopg2.connect(pg_url_psycopg2, connect_timeout=5)
        conn.close()
        video_analytics_db_status = {
            "connected": True,
            "type": "PostgreSQL (Real Connection)",
            "details": "Connected to PostgreSQL database 'construction_ai'"
        }
        print("Real Video Analytics database (PostgreSQL construction_ai) connected successfully!")
    except Exception as e:
        video_analytics_db_status = {
            "connected": False,
            "type": "SQLite (Simulated / Fallback)",
            "details": f"PostgreSQL offline fallback: {e}"
        }
        print("Could not connect to PostgreSQL construction_ai:", e)
    return video_analytics_db_status

test_mes_connection(force=True)
test_video_analytics_connection(force=True)

engine = create_async_engine(
    DATABASE_URL,
    echo=False,
    pool_pre_ping=True,
    pool_reset_on_return=None,
    connect_args={
        "timeout": DATABASE_CONNECT_TIMEOUT_SECONDS,
        "command_timeout": DATABASE_CONNECT_TIMEOUT_SECONDS,
    },
)
AsyncSessionLocal = async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)

# Add Video Analytics async engine
VA_DATABASE_URL = os.getenv("CONSTRUCTION_DB_URL")
va_engine = None
VASessionLocal = None
if VA_DATABASE_URL:
    async_va_url = VA_DATABASE_URL
    if async_va_url.startswith("postgresql://"):
        async_va_url = async_va_url.replace("postgresql://", "postgresql+asyncpg://")
    elif async_va_url.startswith("postgresql+psycopg2://"):
        async_va_url = async_va_url.replace("postgresql+psycopg2://", "postgresql+asyncpg://")
    
    try:
        va_engine = create_async_engine(
            async_va_url,
            echo=False,
            poolclass=NullPool,
            connect_args={
                "timeout": DATABASE_CONNECT_TIMEOUT_SECONDS,
                "command_timeout": DATABASE_CONNECT_TIMEOUT_SECONDS,
            },
        )
        VASessionLocal = async_sessionmaker(bind=va_engine, class_=AsyncSession, expire_on_commit=False)
    except Exception as e:
        print(f"Failed to initialize Video Analytics async engine: {e}")

async def get_va_db():
    if not VASessionLocal:
        raise RuntimeError("Video Analytics DB is not configured.")
    async with VASessionLocal() as session:
        yield session

# Sync engine for local DB (used by synchronous tools)
from sqlalchemy import create_engine as create_sync_engine_sqlite
sync_engine_local = create_sync_engine_sqlite("sqlite:///./mai_platform.db")

def is_integration_enabled(name: str) -> bool:
    try:
        with sync_engine_local.connect() as conn:
            result = conn.execute(text("SELECT is_enabled FROM IntegrationConfig WHERE name = :name"), {"name": name})
            row = result.first()
            if row:
                return bool(row[0])
            return True
    except Exception as e:
        return True

Base = declarative_base()

# --- DATABASE MODELS ---

class User(Base):
    __tablename__ = "users"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    username: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(200), nullable=False)
    role: Mapped[str] = mapped_column(String(50), nullable=False) # Legacy default role; preferred RBAC role assignments live in rbac_user_roles
    site: Mapped[str] = mapped_column(String(50), nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="ACTIVE", nullable=False)
    identity_provider: Mapped[str] = mapped_column(String(30), default="Local", nullable=False)
    employee_id: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    department: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    manager: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    scope_bounds: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    is_super_admin: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

class AgentReportingSettings(Base):
    __tablename__ = "agent_reporting_settings"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    is_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    email: Mapped[str] = mapped_column(String(200), nullable=True)
    schedule_time: Mapped[str] = mapped_column(String(10), nullable=True) # e.g. "08:00"
    prompt: Mapped[str] = mapped_column(String(2000), nullable=True)
    last_run_date: Mapped[datetime] = mapped_column(DateTime, nullable=True)

class GlobalGovernanceSettings(Base):
    """Stores platform-wide governance toggles accessible from the Admin Console."""
    __tablename__ = "global_governance_settings"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    setting_key: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)  # e.g. 'explainability_logging', 'hitl_approval'
    is_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    label: Mapped[str] = mapped_column(String(200), nullable=True)       # Display label
    description: Mapped[str] = mapped_column(String(500), nullable=True) # Display description


class UserProfile(Base):
    """User-owned contact details kept separate from authentication credentials."""
    __tablename__ = "user_profiles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(Integer, unique=True, nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    email: Mapped[str] = mapped_column(String(254), unique=True, nullable=False)
    email_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Site(Base):
    """Locations / plants managed by the admin console."""
    __tablename__ = "site_catalog"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(150), unique=True, nullable=False, index=True)
    location: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    region: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="Active", nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    connectivity: Mapped[Optional[str]] = mapped_column(String(50), nullable=True, default="Pending")
    modules_live: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    agents_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)


class UseCaseGovernanceSettings(Base):
    """Local governance controls. A local switch only has effect when its global switch is enabled."""
    __tablename__ = "use_case_governance_settings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    use_case_key: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    hitl_enabled: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    # Optional comma-separated override recipient emails for HITL notifications
    recipient_emails: Mapped[Optional[str]] = mapped_column(String(1000), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class GuardrailPolicy(Base):
    """Generic, dynamic guardrail policy model for central evaluation engine."""
    __tablename__ = "guardrail_policies"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    type: Mapped[str] = mapped_column(String(50), nullable=False, default="HITL") # HITL, Traceability, AccessControl, RiskBased, DataPrivacy, LimitTime
    scope_type: Mapped[str] = mapped_column(String(50), nullable=False, default="Global") # Global, UseCase, Workflow, Agent, Action, Role
    scope_target: Mapped[Optional[str]] = mapped_column(String(150), nullable=True) # e.g. 'daily_operations_reporting', 'Reporting Agent', '*'
    priority: Mapped[str] = mapped_column(String(20), nullable=False, default="Medium") # Low, Medium, High, Critical
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="Active") # Draft, Active, Disabled, Archived
    is_enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    
    # JSON dynamic configurations for triggers, conditions, type sub-configs, failure behavior
    triggers_conditions: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    type_config: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    execution_behavior: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True) # action: Allow/Require HITL/Block/Redact, failure_mode: Fail Closed/Fail Open
    
    # Audit & Versioning
    version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    created_by: Mapped[str] = mapped_column(String(100), default="System", nullable=False)
    updated_by: Mapped[str] = mapped_column(String(100), default="System", nullable=False)
    change_reason: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)


class ReportApproval(Base):
    """Durable state machine for a generated report and its one-time approval decision."""
    __tablename__ = "report_approvals"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    approval_key: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(32), default="PENDING_APPROVAL", nullable=False, index=True)
    use_case_key: Mapped[str] = mapped_column(String(100), nullable=False)
    requested_by_user_id: Mapped[int] = mapped_column(Integer, nullable=True)
    approver_user_id: Mapped[int] = mapped_column(Integer, nullable=True)
    recipient_email: Mapped[str] = mapped_column(String(254), nullable=True)
    report_path: Mapped[str] = mapped_column(String(1000), nullable=False)
    report_url: Mapped[str] = mapped_column(String(1000), nullable=True)
    query: Mapped[str] = mapped_column(String(4000), nullable=False)
    decision_note: Mapped[str] = mapped_column(String(1000), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    decided_at: Mapped[datetime] = mapped_column(DateTime, nullable=True)


class PlatformNotification(Base):
    """Centralized, persisted notifications used by both the bell and Admin Console."""
    __tablename__ = "platform_notifications"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    recipient_user_id: Mapped[int] = mapped_column(Integer, nullable=True, index=True)
    category: Mapped[str] = mapped_column(String(40), nullable=False, default="system")
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    message: Mapped[str] = mapped_column(String(1000), nullable=False)
    source_type: Mapped[str] = mapped_column(String(50), nullable=True)
    source_id: Mapped[str] = mapped_column(String(100), nullable=True)
    is_read: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False, index=True)


class OneTimeToken(Base):
    """Hashed, expiring one-time tokens for password reset and email verification."""
    __tablename__ = "one_time_tokens"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    purpose: Mapped[str] = mapped_column(String(40), nullable=False, index=True)
    token_hash: Mapped[str] = mapped_column(String(128), nullable=False)
    pending_value: Mapped[str] = mapped_column(String(254), nullable=True)
    attempts: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    consumed_at: Mapped[datetime] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

class Role(Base):
    __tablename__ = "rbac_roles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    description: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    kind: Mapped[str] = mapped_column(String(20), default="Custom", nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="ACTIVE", nullable=False)
    scope_bounds: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    is_protected: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_system: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

class Permission(Base):
    __tablename__ = "rbac_permissions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    key: Mapped[str] = mapped_column(String(120), unique=True, nullable=False, index=True)
    module_key: Mapped[str] = mapped_column(String(80), default="general", nullable=False, index=True)
    resource_key: Mapped[str] = mapped_column(String(150), default="*", nullable=False, index=True)
    access_types: Mapped[Optional[List[str]]] = mapped_column(JSON, default=lambda: ["read_only"], nullable=True)
    description: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    category: Mapped[str] = mapped_column(String(50), default="general", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

class Scope(Base):
    __tablename__ = "rbac_scopes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(Integer, index=True, nullable=False)
    scope_type: Mapped[str] = mapped_column(String(50), nullable=False)
    scope_value: Mapped[str] = mapped_column(String(200), nullable=False)
    scope_path: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

class UserRole(Base):
    __tablename__ = "rbac_user_roles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(Integer, index=True, nullable=False)
    role_id: Mapped[int] = mapped_column(Integer, index=True, nullable=False)
    scope_type: Mapped[str] = mapped_column(String(50), default="Platform", nullable=False)
    scope_value: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    assigned_by: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    assigned_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

class RolePermission(Base):
    __tablename__ = "rbac_role_permissions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    role_id: Mapped[int] = mapped_column(Integer, index=True, nullable=False)
    permission_id: Mapped[int] = mapped_column(Integer, index=True, nullable=False)
    scope_type: Mapped[str] = mapped_column(String(50), default="Platform", nullable=False)
    scope_value: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

class RbacAuditLog(Base):
    __tablename__ = "rbac_audit_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    event_id: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, default=lambda: uuid.uuid4().hex)
    timestamp: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    actor_user_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    action: Mapped[str] = mapped_column(String(100), nullable=False)
    resource_id: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    previous_value: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    new_value: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    scope: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    ip_address: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    result: Mapped[str] = mapped_column(String(50), default="SUCCESS", nullable=False)

class AlertMaster(Base):
    __tablename__ = "AlertMaster"
    
    AlertId: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    AlertType: Mapped[str] = mapped_column(String(50), nullable=False)
    Severity: Mapped[str] = mapped_column(String(20), nullable=False) # red, amber, green
    Title: Mapped[str] = mapped_column(String(200), nullable=False)
    Message: Mapped[str] = mapped_column(String(1000), nullable=False)
    Source: Mapped[str] = mapped_column(String(50), nullable=True)
    SourceId: Mapped[int] = mapped_column(Integer, nullable=True)
    WorkOrderId: Mapped[int] = mapped_column(Integer, nullable=True)
    MachineId: Mapped[int] = mapped_column(Integer, nullable=True)
    IsAcknowledged: Mapped[bool] = mapped_column(Boolean, default=False)
    IsResolved: Mapped[bool] = mapped_column(Boolean, default=False)
    CreatedDate: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

class WorkOrder(Base):
    __tablename__ = "WorkOrder"
    
    WorkOrderId: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    WorkOrderNumber: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    ProductId: Mapped[int] = mapped_column(Integer, nullable=False)
    PlannedQty: Mapped[float] = mapped_column(Float, nullable=False)
    CompletedQty: Mapped[float] = mapped_column(Float, default=0.0)
    UOM: Mapped[str] = mapped_column(String(10), default="MT")
    DueDate: Mapped[datetime] = mapped_column(DateTime, nullable=True)
    Status: Mapped[str] = mapped_column(String(20), default="Planned") # Planned, In Progress, Completed, On Hold
    MachineId: Mapped[int] = mapped_column(Integer, nullable=True)
    CreatedDate: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

class MachineMaster(Base):
    __tablename__ = "MachineMaster"
    
    MachineId: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    MachineCode: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    MachineName: Mapped[str] = mapped_column(String(100), nullable=False)
    MachineType: Mapped[str] = mapped_column(String(50), nullable=True)
    Location: Mapped[str] = mapped_column(String(100), nullable=True)
    CapacityPerHour: Mapped[float] = mapped_column(Float, nullable=True)
    Status: Mapped[str] = mapped_column(String(20), default="Running") # Running, Idle, Maintenance, Offline
    IsActive: Mapped[bool] = mapped_column(Boolean, default=True)

class InventoryByLot(Base):
    __tablename__ = "InventoryByLot"
    
    InventoryId: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    ProductId: Mapped[int] = mapped_column(Integer, nullable=False)
    LotCode: Mapped[str] = mapped_column(String(50), nullable=True)
    WarehouseCode: Mapped[str] = mapped_column(String(20), nullable=True)
    LocationCode: Mapped[str] = mapped_column(String(20), nullable=True)
    Quantity: Mapped[float] = mapped_column(Float, default=0.0)
    ReservedQty: Mapped[float] = mapped_column(Float, default=0.0)
    LastUpdated: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

class IntegrationConfig(Base):
    __tablename__ = "IntegrationConfig"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    is_enabled: Mapped[bool] = mapped_column(Boolean, default=True)


class ChartSummary(Base):
    __tablename__ = "chart_summaries"

    # Use native PostgreSQL UUID type when available to avoid type-casting issues
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    chart_id: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    use_case_id: Mapped[str] = mapped_column(String(100), nullable=False, default='video_monitoring_engine')
    summary_text: Mapped[str] = mapped_column(Text, nullable=False)
    language: Mapped[str] = mapped_column(String(20), nullable=False)
    summary_length: Mapped[str] = mapped_column(String(20), nullable=False)
    metadata_snapshot: Mapped[dict] = mapped_column(JSON, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

# --- DB INIT & SEEDING ---


DEFAULT_SITES = [
    {
        "code": "ALPHA-01",
        "name": "Alpha Refinery",
        "location": "Abu Dhabi, UAE",
        "region": "UAE",
        "status": "Live",
        "is_active": True,
        "description": "Primary process safety and optimization site.",
        "connectivity": "Edge + Cloud",
        "modules_live": 12,
        "agents_count": 12,
    },
    {
        "code": "BETA-02",
        "name": "Beta Offshore Platform",
        "location": "UAE Offshore",
        "region": "UAE",
        "status": "Live",
        "is_active": True,
        "description": "Remote offshore operations with offline-capable edge presence.",
        "connectivity": "Edge-only (offline capable)",
        "modules_live": 8,
        "agents_count": 8,
    },
    {
        "code": "GAMMA-03",
        "name": "Gamma Gas Processing",
        "location": "Gujarat, India",
        "region": "India",
        "status": "Live",
        "is_active": True,
        "description": "Gas processing operations with cross-site optimization workflows.",
        "connectivity": "Edge + Cloud",
        "modules_live": 10,
        "agents_count": 10,
    },
    {
        "code": "DELTA-04",
        "name": "Delta Plant",
        "location": "Nagpur, India",
        "region": "India",
        "status": "Live",
        "is_active": True,
        "description": "Integrated plant network for maintenance and production planning.",
        "connectivity": "Edge + Cloud",
        "modules_live": 12,
        "agents_count": 12,
    },
    {
        "code": "EPSILON-05",
        "name": "Epsilon Onshore",
        "location": "Calgary, Canada",
        "region": "Canada",
        "status": "Pilot",
        "is_active": True,
        "description": "Pilot deployment for onboarding and operational validation.",
        "connectivity": "Edge + Cloud",
        "modules_live": 6,
        "agents_count": 6,
    },
]


async def seed_data(session: AsyncSession):
    existing_sites = (await session.execute(select(Site).limit(1))).scalars().first()
    if not existing_sites:
        session.add_all(Site(**site_data) for site_data in DEFAULT_SITES)
        await session.flush()

    existing_users = (await session.execute(select(User).limit(1))).scalars().first()
    existing_roles = (await session.execute(select(Role).limit(1))).scalars().first()
    existing_permissions = (await session.execute(select(Permission).limit(1))).scalars().first()

    if not existing_permissions:
        for module in get_permission_catalog():
            for resource in module["resources"]:
                access_types = ["read_only", "edit", "hitl_approval", "full_control"]
                permission_key = f"{module['module_key']}:{resource['resource_key']}:{':'.join(access_types)}"
                session.add(Permission(
                    key=permission_key,
                    module_key=module["module_key"],
                    resource_key=resource["resource_key"],
                    access_types=access_types,
                    description=f"{module['label']} / {resource['label']}",
                    category=module["module_key"],
                ))
        await session.flush()

    import bcrypt
    
    def hash_password(password: str) -> str:
        return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

    if not existing_roles:
        role_permissions = {
        "Super Admin": [
            "platform.manage","company.manage","sites.manage","zones.manage","departments.manage","lines.manage","use_cases.manage","workflows.execute","workflows.manage","agents.configure","integrations.edit","reports.export","audit_logs.view","users.create","users.update","users.delete","guardrails.approve","security.manage"
        ],
        "Plant Digital Head": [
            "sites.manage","zones.manage","departments.manage","lines.manage","use_cases.manage","workflows.execute","workflows.manage","agents.configure","integrations.edit","reports.export","users.create","users.update","guardrails.approve"
        ],
        "Operations Head": [
            "sites.view","zones.view","lines.manage","use_cases.manage","workflows.execute","reports.export","guardrails.approve"
        ],
        "HSE Officer": [
            "sites.view","zones.view","workflows.execute","reports.export","guardrails.approve","audit_logs.view"
        ],
        "Shift Supervisor": [
            "sites.view","zones.view","workflows.execute","agents.view","reports.export"
        ],
        "Operator": [
            "sites.view","workflows.execute","agents.view"
        ],
        "Maintenance Manager": [
            "sites.view","departments.manage","lines.manage","agents.configure","workflows.execute","reports.export"
        ],
        "Maintenance Engineer": [
            "sites.view","lines.view","workflows.execute","agents.view","reports.export"
        ],
        "Quality Manager": [
            "sites.view","departments.manage","workflows.execute","reports.export","audit_logs.view"
        ],
        "IT/Integration Admin": [
            "integrations.edit","integrations.view","sites.view","agents.configure","users.create","users.update"
        ],
        "Security Admin": [
            "security.manage","audit_logs.view","sites.view","users.update","guardrails.approve"
        ],
        "Viewer / Auditor": [
            "sites.view","reports.export","audit_logs.view","agents.view"
        ],
    }

        role_models = []
        for name, perms in role_permissions.items():
            role_models.append(Role(
                name=name,
                description=f"System role for {name}",
                kind="System",
                status="ACTIVE",
                is_protected=name in {"Super Admin"},
                is_system=True,
                scope_bounds={"type": "Platform", "level": "Platform"},
            ))
        session.add_all(role_models)
        await session.flush()

        permission_map = {}
        for role_name, perms in role_permissions.items():
            role = next(r for r in role_models if r.name == role_name)
            for perm_key in perms:
                if perm_key not in permission_map:
                    permission = Permission(key=perm_key, description=perm_key, category=perm_key.split(".")[0])
                    session.add(permission)
                    await session.flush()
                    permission_map[perm_key] = permission
                role_permission = RolePermission(role_id=role.id, permission_id=permission_map[perm_key].id, scope_type="Platform", scope_value="*", is_active=True)
                session.add(role_permission)

    if existing_users:
        return

    # 1. Seed Users
    users = [
        User(username="admin", password_hash=hash_password("Admin@123"), role="Super Admin", site="Alpha Refinery", status="ACTIVE", identity_provider="SSO", is_super_admin=True),
        User(username="mfg_head", password_hash=hash_password("mfg123"), role="Plant Digital Head", site="Alpha Refinery", status="ACTIVE", identity_provider="Local"),
        User(username="ops_head", password_hash=hash_password("ops123"), role="Operations Head", site="Alpha Refinery", status="ACTIVE", identity_provider="Local"),
        User(username="hse_officer", password_hash=hash_password("hse123"), role="HSE Officer", site="Alpha Refinery", status="ACTIVE", identity_provider="Local"),
    ]
    session.add_all(users)
    await session.flush()

    for user in users:
        role = (await session.execute(select(Role).where(Role.name == user.role))).scalars().first()
        if role:
            session.add(UserRole(user_id=user.id, role_id=role.id, scope_type="Site", scope_value=user.site, is_active=True))
    
    # 2. Seed Machines
    machines = [
        MachineMaster(MachineCode="M-LINE1", MachineName="Main Assembly Line 1", MachineType="Assembly", Location="Zone 1", CapacityPerHour=15.5, Status="Running"),
        MachineMaster(MachineCode="M-LINE2", MachineName="Packaging Line 2", MachineType="Packaging", Location="Zone 2", CapacityPerHour=20.0, Status="Idle"),
        MachineMaster(MachineCode="M-LINE3", MachineName="Refining Line 3", MachineType="Refining", Location="Zone 3", CapacityPerHour=12.0, Status="Running"),
        MachineMaster(MachineCode="M-COMP1", MachineName="Air Compressor 1", MachineType="Utility", Location="Zone 7", CapacityPerHour=0.0, Status="Running"),
        MachineMaster(MachineCode="M-T3REG", MachineName="Train-3 Regenerator", MachineType="Chemical", Location="Zone 4", CapacityPerHour=50.0, Status="Maintenance"),
    ]
    session.add_all(machines)
    await session.flush() # Flush to get MachineIds
    
    # 3. Seed WorkOrders
    work_orders = [
        WorkOrder(WorkOrderNumber="WO-88213", ProductId=101, PlannedQty=500.0, CompletedQty=120.0, DueDate=datetime.utcnow() + timedelta(days=2), Status="In Progress", MachineId=machines[4].MachineId),
        WorkOrder(WorkOrderNumber="WO-33912", ProductId=102, PlannedQty=250.0, CompletedQty=0.0, DueDate=datetime.utcnow() + timedelta(days=5), Status="Planned", MachineId=machines[0].MachineId),
        WorkOrder(WorkOrderNumber="WO-10442", ProductId=101, PlannedQty=1000.0, CompletedQty=1000.0, DueDate=datetime.utcnow() - timedelta(days=1), Status="Completed", MachineId=machines[2].MachineId),
        WorkOrder(WorkOrderNumber="WO-55610", ProductId=103, PlannedQty=300.0, CompletedQty=50.0, DueDate=datetime.utcnow() + timedelta(days=1), Status="On Hold", MachineId=machines[2].MachineId),
    ]
    session.add_all(work_orders)
    
    # 4. Seed Alerts
    alerts = [
        AlertMaster(AlertType="Maintenance", Severity="red", Title="Train-3 Regenerator Failure Predicted", Message="LSTM predictive models flag failures within 72h. High bearing vibration detected.", Source="Predictive Maintenance Agent", MachineId=machines[4].MachineId, IsAcknowledged=False, IsResolved=False),
        AlertMaster(AlertType="Safety", Severity="amber", Title="Missing Hard-Hat Detected", Message="Camera 12 in Zone 4 flagged a hard-hat compliance violation.", Source="PPE Vision Agent", IsAcknowledged=False, IsResolved=False),
        AlertMaster(AlertType="Compliance", Severity="green", Title="SO2 Concentration Normal", Message="Unit 5 average SO2 concentration at 42 mg/Nm3, well within standard safety parameters.", Source="Environmental Agent", IsAcknowledged=True, IsResolved=True),
        AlertMaster(AlertType="Finance", Severity="amber", Title="Line 3 Cost Variance", Message="Operating cost exceeds baseline by 14% due to energy consumption spike.", Source="Finance Agent", MachineId=machines[2].MachineId, IsAcknowledged=False, IsResolved=False),
    ]
    session.add_all(alerts)
    
    # 5. Seed Inventory
    inventory = [
        InventoryByLot(ProductId=101, LotCode="LOT-A1", WarehouseCode="WH-MAIN", LocationCode="LOC-11A", Quantity=1500.0, ReservedQty=500.0),
        InventoryByLot(ProductId=102, LotCode="LOT-B2", WarehouseCode="WH-MAIN", LocationCode="LOC-12B", Quantity=800.0, ReservedQty=250.0),
        InventoryByLot(ProductId=103, LotCode="LOT-C3", WarehouseCode="WH-RAW", LocationCode="LOC-03X", Quantity=5000.0, ReservedQty=0.0),
    ]
    session.add_all(inventory)
    
    await session.commit()

async def init_db():
    """Verify the required platform database before running schema initialization."""
    try:
        async with engine.connect() as connection:
            await connection.execute(text("SELECT 1"))
    except Exception as exc:
        raise RuntimeError(
            f"Required platform database connection failed ({DATABASE_URL!r}): {exc}"
        ) from exc

    async with engine.begin() as conn:
        # Create all tables
        await conn.run_sync(Base.metadata.create_all)

        # Add required columns for older DBs without crashing startup.
        migration_statements = [
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'ACTIVE';",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS identity_provider VARCHAR(30) DEFAULT 'Local';",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS employee_id VARCHAR(50);",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS department VARCHAR(100);",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS manager VARCHAR(100);",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS scope_bounds JSON;",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS is_super_admin BOOLEAN DEFAULT FALSE;",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;",
            "ALTER TABLE use_case_governance_settings ADD COLUMN IF NOT EXISTS recipient_emails VARCHAR(1000);",
            "ALTER TABLE rbac_permissions ADD COLUMN IF NOT EXISTS module_key VARCHAR(80) DEFAULT 'general';",
            "ALTER TABLE rbac_permissions ADD COLUMN IF NOT EXISTS resource_key VARCHAR(150) DEFAULT '*';",
            "ALTER TABLE rbac_permissions ADD COLUMN IF NOT EXISTS access_types JSON;",
            "ALTER TABLE rbac_permissions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;",
        ]
        for statement in migration_statements:
            try:
                await conn.execute(text(statement))
            except Exception:
                # Non-blocking: the table may not exist yet or the DB may not support some statements.
                pass
        
    async with AsyncSessionLocal() as session:
        await seed_data(session)
        # Check and seed integrations
        result = await session.execute(select(IntegrationConfig).limit(1))
        if not result.scalars().first():
            integrations = [
                IntegrationConfig(name="MES", is_enabled=True),
                IntegrationConfig(name="Video Analytics", is_enabled=True),
            ]
            session.add_all(integrations)
            await session.commit()

        # Check and seed global governance settings
        gov_result = await session.execute(select(GlobalGovernanceSettings).limit(1))
        if not gov_result.scalars().first():
            gov_settings = [
                GlobalGovernanceSettings(
                    setting_key="explainability_logging",
                    is_enabled=True,
                    label="Explainability Logging",
                    description="Every AI decision is traceable — inputs, model version and reasoning summary retained"
                ),
                GlobalGovernanceSettings(
                    setting_key="hitl_approval",
                    is_enabled=False,
                    label="Human-in-the-loop approval for high-risk actions",
                    description="Required before any agent commits a production, safety or financial action above threshold"
                ),
                GlobalGovernanceSettings(
                    setting_key="global_kill_switch",
                    is_enabled=True,
                    label="Global Kill Switch",
                    description="Master switch — when OFF, all agent API calls return HTTP 503 immediately"
                ),
            ]
            session.add_all(gov_settings)
            await session.commit()

        # Check and seed default guardrail policies if table empty
        gp_result = await session.execute(select(GuardrailPolicy).limit(1))
        if not gp_result.scalars().first():
            default_policies = [
                GuardrailPolicy(
                    name="High-Risk Action HITL Policy",
                    description="Requires human approval before dispatching high-impact reporting or system actions",
                    type="HITL",
                    scope_type="UseCase",
                    scope_target="daily_operations_reporting",
                    priority="High",
                    status="Active",
                    is_enabled=True,
                    triggers_conditions={"trigger_event": "On Risk Detection", "conditions": [{"field": "risk_score", "operator": ">=", "value": "0.7"}]},
                    type_config={"approver_type": "Role", "approver_target": "Super Admin", "channel": "Both", "timeout_minutes": 1440},
                    execution_behavior={"action": "Require HITL", "failure_mode": "Fail Closed"},
                    version=1,
                    created_by="System",
                    updated_by="System"
                ),
                GuardrailPolicy(
                    name="Deterministic Security Firewall",
                    description="Prevents SQL injection, OS command injection, and system destruction attempts",
                    type="AccessControl",
                    scope_type="Global",
                    scope_target="*",
                    priority="Critical",
                    status="Active",
                    is_enabled=True,
                    triggers_conditions={"trigger_event": "Before Execution", "conditions": [{"field": "query", "operator": "contains", "value": "DROP,DELETE,SHUTDOWN"}]},
                    type_config={"access_rule": "Deny", "restricted_roles": []},
                    execution_behavior={"action": "Block", "failure_mode": "Fail Closed"},
                    version=1,
                    created_by="System",
                    updated_by="System"
                ),
                GuardrailPolicy(
                    name="Full Decision Audit Traceability",
                    description="Ensures all agent interactions log model parameters, token usage, and tool calls",
                    type="Traceability",
                    scope_type="Global",
                    scope_target="*",
                    priority="Medium",
                    status="Active",
                    is_enabled=True,
                    triggers_conditions={"trigger_event": "After Execution", "conditions": []},
                    type_config={"logging_targets": ["LLM Cost", "Token Usage", "Tool Calls"], "retention_days": 365},
                    execution_behavior={"action": "Allow", "failure_mode": "Fail Open"},
                    version=1,
                    created_by="System",
                    updated_by="System"
                )
            ]
            session.add_all(default_policies)
            await session.commit()

        # Bootstrap durable profile records for existing authenticated users.
        users = (await session.execute(select(User))).scalars().all()
        for user in users:
            profile = (await session.execute(select(UserProfile).where(UserProfile.user_id == user.id))).scalars().first()
            if not profile:
                session.add(UserProfile(
                    user_id=user.id,
                    name=user.username.replace("_", " ").title(),
                    # Existing seed users do not contain email addresses. This placeholder is deliberately
                    # unverified and must be verified before it can be used for approval mail.
                    email=f"{user.username}@example.invalid",
                    email_verified=False,
                ))

        reporting_hitl = (await session.execute(
            select(UseCaseGovernanceSettings).where(UseCaseGovernanceSettings.use_case_key == "daily_operations_reporting")
        )).scalars().first()
        if not reporting_hitl:
            session.add(UseCaseGovernanceSettings(use_case_key="daily_operations_reporting", hitl_enabled=False))
        await session.commit()

# Dependency to get session
async def get_db():
    async with AsyncSessionLocal() as session:
        yield session
