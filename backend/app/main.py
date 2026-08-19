import asyncio
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

from app.db import init_db
from app.routes import router, stream_agent_events
from app.scheduler import start_scheduler, stop_scheduler

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize database tables and seed values
    print("Initializing database...")
    await init_db()
    print("Database initialized successfully.")
    
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

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
