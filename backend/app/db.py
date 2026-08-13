import os
import asyncio
from datetime import datetime, timedelta
from sqlalchemy import create_engine as create_sync_engine
from urllib.parse import quote_plus
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import declarative_base, Mapped, mapped_column
from sqlalchemy import String, Integer, Float, Boolean, DateTime, select
from dotenv import load_dotenv

# Load environment variables
load_dotenv()
DB_DRIVER = os.getenv("DB_DRIVER", "ODBC Driver 18 for SQL Server")
DB_SERVER = os.getenv("DB_SERVER", "localhost")
DB_NAME = os.getenv("DB_NAME", "mes_new")
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./mai_platform.db")

# Sync engine for pyodbc/MSSQL testing if available
mes_db_status = {
    "connected": False,
    "type": "SQLite (Simulated / Fallback)",
    "details": "Local offline platform db (sqlite)"
}

sync_mes_engine = None

def test_mes_connection():
    global mes_db_status, sync_mes_engine
    try:
        import pyodbc
        connection_string = (
            f"DRIVER={{{DB_DRIVER}}};"
            f"SERVER={DB_SERVER};"
            f"DATABASE={DB_NAME};"
            "Trusted_Connection=yes;"
            "TrustServerCertificate=yes;"
            "Encrypt=no;"
            "MARS_Connection=yes;"
        )
        conn = pyodbc.connect(connection_string, timeout=2)
        conn.close()
        
        # Connection test succeeded, build SQL Alchemy sync engine for reporting agent
        sync_mes_engine = create_sync_engine("mssql+pyodbc:///?odbc_connect=" + quote_plus(connection_string))
        mes_db_status = {
            "connected": True,
            "type": "MS SQL Server (Real Connection)",
            "details": f"Connected to server '{DB_SERVER}' database '{DB_NAME}'"
        }
        print("Real MES database (SQL Server) connected successfully!")
    except Exception as e:
        print("Could not connect to MS SQL Server (using SQLite fallback):", e)

test_mes_connection()

engine = create_async_engine(DATABASE_URL, echo=False)
AsyncSessionLocal = async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)

Base = declarative_base()

# --- DATABASE MODELS ---

class User(Base):
    __tablename__ = "users"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    username: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(200), nullable=False)
    role: Mapped[str] = mapped_column(String(50), nullable=False) # Super Admin, Plant Digital Head, Operations Head, HSE Officer
    site: Mapped[str] = mapped_column(String(50), nullable=False)

class AgentReportingSettings(Base):
    __tablename__ = "agent_reporting_settings"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    is_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    email: Mapped[str] = mapped_column(String(200), nullable=True)
    schedule_time: Mapped[str] = mapped_column(String(10), nullable=True) # e.g. "08:00"
    prompt: Mapped[str] = mapped_column(String(2000), nullable=True)
    last_run_date: Mapped[datetime] = mapped_column(DateTime, nullable=True)

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

# --- DB INIT & SEEDING ---

async def seed_data(session: AsyncSession):
    # Check if users already exist
    result = await session.execute(select(User).limit(1))
    if result.scalars().first():
        return # already seeded
        
    import bcrypt
    
    def hash_password(password: str) -> str:
        return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        
    # 1. Seed Users
    users = [
        User(username="admin", password_hash=hash_password("Admin@123"), role="Super Admin", site="Alpha Refinery"),
        User(username="mfg_head", password_hash=hash_password("mfg123"), role="Plant Digital Head", site="Alpha Refinery"),
        User(username="ops_head", password_hash=hash_password("ops123"), role="Operations Head", site="Alpha Refinery"),
        User(username="hse_officer", password_hash=hash_password("hse123"), role="HSE Officer", site="Alpha Refinery"),
    ]
    session.add_all(users)
    
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
    async with engine.begin() as conn:
        # Create all tables
        await conn.run_sync(Base.metadata.create_all)
        
    async with AsyncSessionLocal() as session:
        await seed_data(session)

# Dependency to get session
async def get_db():
    async with AsyncSessionLocal() as session:
        yield session
