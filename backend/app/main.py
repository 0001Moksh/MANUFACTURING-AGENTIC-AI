import asyncio
import logging
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from sqlalchemy import text

# Load environment variables
load_dotenv()

from app.db import init_db, engine, test_mes_connection, test_video_analytics_connection
from app.license_control import get_installation_id, get_license_validator, read_active_license
from app.routes import router, stream_agent_events
from app.computer_vision_routes import router as cv_router
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

configured_origins = [origin.strip().rstrip("/") for origin in os.getenv("FRONTEND_URLS", os.getenv("FRONTEND_URL", "http://localhost:3000, http://localhost:8080, http://localhost:8001, http://127.0.0.1:3000, http://127.0.0.1:8080, http://127.0.0.1:8001")).split(",") if origin.strip()]

# Allow all origins in development and mixed local deployments so frontend dev servers can reach the backend cleanly.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routes
from fastapi.staticfiles import StaticFiles

os.makedirs("reports", exist_ok=True)
app.mount("/reports", StaticFiles(directory="reports"), name="reports")

app.include_router(router)
app.include_router(cv_router)

@app.middleware("http")
async def middleware_enforce_license(request: Request, call_next):
    public_paths = [
        "/health",
        "/docs",
        "/openapi.json",
        "/redoc",
        "/api/license/status",
        "/api/license/verify",
        "/api/auth/login",
        "/api/nodes/heartbeat",
    ]
    path = request.url.path
    if any(path == allowed or path.startswith("/static/") for allowed in public_paths):
        return await call_next(request)

    if path.startswith("/api/"):
        validator = get_license_validator()
        result = validator.validate_license_file(read_active_license(), installation_id=get_installation_id())
        if not result.is_valid:
            return JSONResponse(
                status_code=403,
                content={
                    "code": result.blocking_code or "LICENSE_REQUIRED",
                    "status": result.status,
                    "message": result.message,
                },
            )
    return await call_next(request)


@app.get("/health", tags=["health"])
async def health():
    """Container health endpoint; verifies PostgreSQL construction_ai database only (platform is initialized on startup)."""
    try:
        # Verify construction_ai is reachable (required)
        construction = test_video_analytics_connection(force=True)
        print(f"[HEALTH] construction connection status: {construction}")
        
        if construction["connected"]:
            print("[HEALTH] ✓ Returning 200 OK")
            return {
                "status": "ok",
                "message": "Backend service operational"
            }
        else:
            print(f"[HEALTH] ✗ Construction not connected: {construction}")
            from fastapi import HTTPException
            raise HTTPException(status_code=503, detail={"construction_ai": construction})
        
    except HTTPException:
        raise
    except Exception as exc:
        print(f"[HEALTH] Exception occurred: {exc}")
        logger.exception("Health check failed")
        from fastapi import HTTPException
        raise HTTPException(status_code=503, detail=f"Service unhealthy: {str(exc)}") from exc

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
