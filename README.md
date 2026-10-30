# IIIoT Manufacturing Agentic AI Platform

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
   # Optional LangSmith tracing for named agent runs and nested tool/LLM logs
   LANGSMITH_TRACING=true
   LANGSMITH_API_KEY=your-langsmith-key
   LANGSMITH_PROJECT=manufacturing-agentic-ai
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

### Fedora prerequisite setup

The backend is pinned to Python 3.11 because several AI/ML dependencies do not
yet publish wheels for newer Python releases. On Fedora, run:

```bash
chmod +x scripts/setup-backend-fedora.sh
./scripts/setup-backend-fedora.sh
```

This installs the native compiler/ODBC prerequisites, creates `backend/venv`,
and installs the Python dependencies. If you use SQL Server directly from the
host, also install Microsoft's `msodbcsql18` package. Docker Compose includes
that driver inside the backend image already.

For the complete containerized stack on Fedora, fill in `.env` and run:

```bash
chmod +x scripts/start.sh
./scripts/start.sh
```

### 1. Database & Backend Setup
1. Navigate to the `backend` folder:
   ```bash
   cd backend
   ```
2. Create and activate a Python virtual environment:
   ```bash
   python3.11 -m venv venv
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
   uvicorn app.main:app --reload --port 8001
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

### Telegraf CPU and memory plugin registration

Prepare the target-specific vendor installer by executing the notebook from the
repository root. The notebook downloads the official Telegraf package. For
example, on Fedora/x86_64:

```bash
TARGET_OS=linux-rpm \
ARCHITECTURE=x86_64 \
backend/venv/bin/jupyter nbconvert --execute --to notebook \
  --output /tmp/cpu-plugin-executed.ipynb \
  'jupyter notebooks/cpu-plugin.ipynb'
```

Set `TELEGRAF_SOURCE` only when using a package that is already present locally
or a specific package URL. Relative local paths are resolved from the repository
root. `TELEGRAF_VERSION` can override the default packaged version.

The prepared Telegraf file is written to `generated_plugins/` by default. In
the UI, use **Add Plugin**, choose **CPU Monitoring** or **Memory Monitoring**,
and upload that file. The same vendor installer works for both plugins. This is distinct from the
overall MAI plugin bundle, which is generated and stored under
`backend/plugin/telegraf-cpu-monitoring/bundles/` when **Download Bundle** is
clicked in the Setup Wizard.

The bundle uses Telegraf's PostgreSQL output and writes CPU samples to
`public.telegraf_cpu` and memory samples to `public.telegraf_mem` in the MAI platform database. Before running the bundle
installer, provide a PostgreSQL URL that is reachable from the target machine:

```bash
export POSTGRES_DSN='postgresql://postgres:password@localhost:5432/manufacturing_ai?sslmode=disable'
./install.sh
unset POSTGRES_DSN
```

Use the real database credentials and host. The DSN must start with
`postgresql://`; remove SQLAlchemy-only driver suffixes such as `+asyncpg`.
The database user must be allowed to connect, create/update the
`public.telegraf_cpu` and `public.telegraf_mem` tables, and insert rows. After the service starts, use
**Confirm Installation** and then **Verify Plugin** in the Setup Wizard.

Revision 3 bundles use separate files for the CPU/Memory baseline, the shared
PostgreSQL output, and each connector. Installing Disk, Network, MQTT, Modbus, or
OPC UA preserves connectors already installed. Existing cached bundles regenerate
on download. Do not run an older combined bundle after upgrading because it can
replace the newer connector layout.

Once Memory verification succeeds, **Memory Utilization Monitoring** appears in
the Use-Case Library at `/use-cases/memory-utilization`. See
[Memory monitoring implementation and activation](docs/memory-monitoring.md)
for metrics, API behavior, shared components, testing, and deployment limits.
See [Telegraf connector bundles](docs/telegraf-connectors.md) for Disk, Network,
MQTT, Modbus, and OPC UA installation variables and API behavior.


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
