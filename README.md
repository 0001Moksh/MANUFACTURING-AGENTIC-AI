# IIIoT Manufacturing Agentic AI Platform

Enterprise Manufacturing Intelligence & Agentic AI Orchestration Platform for MES, Video Analytics, and Industrial IoT unification[cite: 1].

## System Overview
- **Backend**: FastAPI (Python 3.11+), SQLAlchemy ORM, PyODBC (SQL Server / MES Integration)
- **Frontend**: React 18, TypeScript, Vite, TailwindCSS, Shadcn UI, Recharts, Lucide Icons
- **AI/Agent Layer**: Asynchronous Rule Engine, ML Anomaly Pipelines, Agentic Action Dispatcher[cite: 1]

## Project Setup

### 1. Backend Setup
```bash
cd backend
python -m venv venv
# On Windows:
venv\Scripts\activate
# On Linux/Mac:
source venv/bin/activate

pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload --port 8000