from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.reporting_router import router as reporting_router

# Application Metadata
app = FastAPI(
    title="IIIoT Manufacturing Agentic AI Platform",
    description="Enterprise Multi-Agent Intelligence Core for MES, Vision, and IoT Integration",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS Middleware Setup (React Frontend se communication ke liye)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Production me Specific Domain/Port set karenge
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/", tags=["Health Check"])
async def root_health_check():
    """
    Health check endpoint to verify backend system status.
    """
    return {
        "status": "online",
        "system": "IIIoT Agentic AI Platform",
        "environment": "development",
        "message": "FastAPI Core Engine is running smoothly.",
    }


app.include_router(reporting_router)

if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)



# cd backend
# python -m venv venv
# .\venv\Scripts\activate
# pip install -r requirements.txt
# uvicorn app.main:app --reload --port 8000

# Server Health: http://localhost:8000
# Interactive Swagger Documentation: http://localhost:8000/docs