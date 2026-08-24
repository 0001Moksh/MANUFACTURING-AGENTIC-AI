import asyncio
import logging
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from sqlalchemy import text

# Load environment variables
load_dotenv()

from app.db import init_db, engine, test_mes_connection, test_video_analytics_connection
from app.routes import router, stream_agent_events
from app.scheduler import start_scheduler, stop_scheduler

logger = logging.getLogger("mai.startup")
DATABASE_STARTUP_TIMEOUT_SECONDS = float(os.getenv("DATABASE_STARTUP_TIMEOUT_SECONDS", "30"))

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize database tables and seed values
    logger.info("Initializing required platform database.")
    try:
        await asyncio.wait_for(init_db(), timeout=DATABASE_STARTUP_TIMEOUT_SECONDS)
    except asyncio.TimeoutError as exc:
        logger.critical(
            "Database initialization exceeded the %ss startup timeout.",
            DATABASE_STARTUP_TIMEOUT_SECONDS,
        )
        raise RuntimeError("Database initialization timed out; application will not start.") from exc
    except Exception:
        logger.exception("Database initialization failed; application will not start.")
        raise
    logger.info("Required platform database initialized successfully.")
    
    # Start WebSocket background broadcaster
    event_loop_task = asyncio.create_task(stream_agent_events())
    
    # Start APScheduler
    start_scheduler()
    
    yield
    
    # Cleanup tasks
    stop_scheduler()
    event_loop_task.cancel()
    try:
        await event_loop_task
    except asyncio.CancelledError:
        pass

app = FastAPI(
    title="Manufacturing Agentic AI (MAI) Platform",
    description="Enterprise Industrial Intelligence and Agentic AI Orchestration layer.",
    version="1.0.0",
    lifespan=lifespan
)

# Allow the configured frontend to make authenticated API requests.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.getenv("FRONTEND_URL", "http://localhost:3000")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routes
from fastapi.staticfiles import StaticFiles

os.makedirs("reports", exist_ok=True)
app.mount("/reports", StaticFiles(directory="reports"), name="reports")

app.include_router(router)

@app.get("/health", tags=["health"])
async def health():
    """Container health endpoint; verifies PostgreSQL databases (required) and SQL Server (optional with fallback)."""
    try:
        # Manufacturing DB (required)
        async with engine.connect() as connection:
            await connection.execute(text("SELECT 1"))
        # Construction DB (required)
        construction = test_video_analytics_connection(force=True)
        # MES DB (optional - has SQLite fallback)
        mes = test_mes_connection(force=True)
    except Exception as exc:
        logger.exception("Health check failed")
        from fastapi import HTTPException
        raise HTTPException(status_code=503, detail="Database health check failed") from exc
    
    # Only require PostgreSQL databases; SQL Server is optional with fallback
    if not construction["connected"]:
        from fastapi import HTTPException
        raise HTTPException(status_code=503, detail={"construction": construction})
    
    return {
        "status": "ok",
        "databases": {
            "manufacturing_ai": True,
            "construction_ai": True,
            "mes_new": mes["connected"]
        }
    }

if __name__ == "__main__":
    import uvicorn
    reload_enabled = os.getenv("APP_RELOAD", "false").lower() in {"1", "true", "yes"}
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=reload_enabled,
        reload_excludes=["reports/*", "logs/*", "*.pdf"] if reload_enabled else None,
    )
