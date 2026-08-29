# IIIIoT Manufacturing Agentic AI Platform

Enterprise Manufacturing Intelligence & Agentic AI Orchestration Platform for MES, Video Analytics, and Industrial IoT unification.

This repository implements the complete full-stack **Manufacturing Agentic AI (MAI)** platform, integrating a React 19 client frontend with a FastAPI backend server running a stateful LangGraph SQL Generation Agent, LiteLLM gateway, and defensive security firewalls.

---

## Technical Stack
- **Backend**: FastAPI (Python 3.11+), SQLAlchemy Async ORM, SQLite/PostgreSQL
- **AI Agent Orchestration**: LangGraph (Cyclical SQL query execution & self-correction), LiteLLM (Gateway, fallbacks, cost estimation)
- **Security Middleware**: OWASP LLM Mitigation (Deterministic regex blocking + LLM semantic classification firewall)
- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS, Zustand (State management), Recharts, Lucide Icons
- **Deployment**: Docker Compose orchestration (PostgreSQL + pgvector, Redis, FastAPI, Vite Client)

---

## License & Access Control

1. Start MAI.
2. Upload the provided `.lic` file.
3. MAI validates the license before login is allowed.
4. Valid license → login enabled.
5. Invalid, expired, tampered, or mismatched license → access blocked.

The customer installs the MAI runtime and receives only the generated `.lic` file. The private Flask license server is run by MAI administrators only and is not part of the customer deployment.

## Production Docker Deployment

See [CLIENT_DEPLOYMENT_GUIDE.md](CLIENT_DEPLOYMENT_GUIDE.md) for the client-facing Docker installation, configuration, database initialization, persistence, troubleshooting, and backup procedures.

The repository currently builds application images locally because no Docker Hub namespace is configured:

```bash
docker compose up -d --build
```

The production frontend is available at [http://localhost:8080](http://localhost:8080). Database services remain internal to the Compose network by default.

## Quick Start via Docker Compose (Development)

To launch the database, caching layer, backend API, and React client concurrently:

1. **Configure Environment Variables**:
   Copy `backend/.env.example` to `backend/.env` (or create a `.env` file in the root) and add your LLM provider API keys:
   ```bash
   GEMINI_API_KEY=your-gemini-key
   OPENAI_API_KEY=your-openai-key
   ```

2. **Run Docker Compose**:
   ```bash
   docker compose up -d --build
   ```

3. **Access the Services**:
   - React Frontend: [http://localhost:8080](http://localhost:8080)
   - Live Telemetry WebSocket: `ws://localhost:8080/api/ws/telemetry`

---

## Manual Local Development Setup

If you prefer to run services individually without Docker:

### 1. Database & Backend Setup
1. Navigate to the `backend` folder:
   ```bash
   cd backend
   ```
2. Create and activate a Python virtual environment:
   ```bash
   python -m venv venv
   # On Windows:
   venv\Scripts\activate
   # On Linux/macOS:
   source venv/bin/activate
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Create a `.env` file from the example:
   ```bash
   cp .env.example .env
   # Open .env and add your API keys!
   ```
5. Run the FastAPI development server:
   ```bash
   uvicorn app.main:app --reload --port 8000
   ```
   *Note: On startup, the backend automatically seeds a local SQLite database (`mai_platform.db`) with mock tables and data representing key MES structures.*

### 2. React Client Setup
1. Open a new terminal and navigate to the `frontend` folder:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the Vite dev server:
   ```bash
   npm run dev
   ```
4. Access the web dashboard at [http://localhost:5173](http://localhost:5173). Log in with:
   - **Username**: `mfg_head`
   - **Password**: `mfg123`

---

## System Architecture

### Stateful LangGraph Workflow
The Data Extraction and Reporting Agent follows a cyclical graph configuration:
1. **Understand Intent**: Parses user queries into structured JSON fields.
2. **Fetch Schema Context**: Pulls permitted tables (`work_order`, `alert_master`, `machine_master`, `inventory_by_lot`) to enforce security.
3. **Generate SQL Query**: Uses LLM to translate natural language to SQL SELECT syntax.
4. **Execute Query Safe**: Runs query on database. If a database error occurs, catches the traceback and routes back to query generation with error context for self-correction.
5. **Compile Insights**: Formulates executive summaries and action plans based on retrieved data.

### Cybersecurity Perimeter (OWASP LLM Mitigation)
- **Tier 0 Deterministic Blocking**: Blocks PII, SQL injections (`DROP`, `DELETE`), and OS commands (`rm -rf`).
- **Tier 1 Semantic Classifier**: Fast LLM-as-a-judge check evaluates intent to detect jailbreak payloads.
- **Human-In-The-Loop (HITL)**: Workflow pauses execution on potential write-back instructions, requiring explicit manual administrator approval via the UI before resuming database execution.