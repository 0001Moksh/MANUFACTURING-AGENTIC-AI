# Client Deployment Guide

This guide runs the Manufacturing Agentic AI platform with Docker Compose. The current repository contains one FastAPI application that integrates MAI, MES, and Video Analytics workflows, one React/Nginx frontend, two PostgreSQL databases, and one SQL Server database.

## Requirements

- Windows 10/11 with Docker Desktop, or Linux with Docker Engine and Compose v2
- 4 CPU cores recommended
- 8 GB RAM minimum; 12 GB recommended for SQL Server and the application together
- At least 20 GB free disk space, plus database growth
- Network access to pull public base images and any private application images

## Install and configure

1. Install and start Docker Desktop (or Docker Engine with Compose v2).
2. Copy this repository, including the `docs` database backup files, to the deployment machine.
3. Copy `.env.example` to `.env`.
4. Replace every `CHANGE_ME` value with a unique value. Never commit or share `.env`.
5. Set at least one LLM API key if AI responses are required.

### Required settings

- `APP_PORT`: host port for the frontend; default `8080`.
- `FRONTEND_URL` and `FRONTEND_URLS`: browser origin(s), normally `http://localhost:8080`.
- `POSTGRES_MANUFACTURING_*`: MAI PostgreSQL database, user, and password.
- `POSTGRES_VIDEO_*`: Video Analytics PostgreSQL database, user, and password.
- `SQLSERVER_DATABASE`: MES database name, normally `mes_new`.
- `SQLSERVER_PASSWORD`: SQL Server `sa` password. It must be at least 8 characters and contain uppercase, lowercase, a number, and a symbol.
- `JWT_SECRET_KEY` and `REPORT_APPROVAL_EMAIL_SECRET`: long random application secrets.
- `GEMINI_API_KEY`, `GROQ_API_KEY`, or `OPENAI_API_KEY`: optional provider keys; configure at least one for live AI calls.
- `MAIL_*`: optional SMTP settings for email features.

## Start the platform

This repository currently builds the application images locally because no Docker Hub namespace has been configured:

```powershell
docker compose up -d --build
```

On first startup, Compose starts the databases, waits for readiness, and initializes missing databases from the supplied backups. Existing databases are detected and left untouched.

Check status:

```powershell
docker compose ps
docker compose logs --tail=200
```

The application is available at `http://localhost:8080`. The API is proxied through the frontend at `http://localhost:8080/api/`, and the health endpoint is `http://localhost:8080/health`. Database ports are internal and are not exposed to the host by default.

## Stop and restart

Normal shutdown preserves all database data:

```powershell
docker compose down
```

Restart without removing containers:

```powershell
docker compose restart
docker compose up -d
```

Do not use `docker compose down -v` during normal operation. It deletes the persistent PostgreSQL and SQL Server volumes and can destroy local deployment data. Use it only for an intentional clean-volume test or reset.

## Updates

For a source-based deployment:

```powershell
git pull
docker compose up -d --build
```

For a future registry deployment, the release owner must publish versioned application and initialization images, update the Compose `image` references, and provide the matching Compose file. Do not use `latest` as the only production tag.

## Database access

The databases are intentionally internal to the Compose network. Application containers connect using:

- MAI PostgreSQL: `postgres-manufacturing:5432`
- Video PostgreSQL: `postgres-video:5432`
- MES SQL Server: `sqlserver:1433`

To use pgAdmin or SSMS from the host, add explicitly approved port mappings to a deployment override file. Do not expose database ports publicly without firewall and credential controls.

## Backups and sensitive data

The SQL Server initializer contains `docs/mes_db_info/mes_new.bak` and the PostgreSQL initializer contains database dumps. These files may contain proprietary business data. Do not publish images containing them to a public Docker Hub repository. If registry distribution is required, use a private registry/repository or deliver the backup separately through an approved secure channel.

Back up the Docker volumes or use database-native backup procedures before upgrades. A volume is not a substitute for an off-machine backup.

## Troubleshooting

### SQL Server is unhealthy

```powershell
docker compose logs --tail=200 sqlserver
docker compose logs --tail=200 init-sqlserver
```

SQL Server can take several minutes on first startup. Confirm `SQLSERVER_PASSWORD` meets all four complexity requirements and that the SQL Server volume has free disk space.

### Database initialization failed

Inspect the corresponding initializer logs. Existing databases are never restored automatically. For a clean test only, stop the stack and intentionally remove volumes with `docker compose down -v`, then start again.

### Port already in use

Change `APP_PORT` in `.env`, then run `docker compose up -d` again.

### Frontend cannot reach the backend

Use the browser URL through the frontend port, not a container hostname. Check `docker compose ps` and backend logs. The production frontend uses same-origin `/api` requests and Nginx forwards them to the backend service.

### Container keeps restarting

```powershell
docker compose ps
docker compose logs --tail=200 <service-name>
```

Correct the reported configuration or dependency error, then run `docker compose up -d`.

### Weak SQL Server password

Set a new password containing uppercase letters, lowercase letters, digits, and symbols. The initializer rejects weak values without printing the password.

## Clean installation test

Only in an isolated test environment:

```powershell
docker compose down -v
docker compose up -d --build
docker compose ps
```

Verify all required services and database initialization logs before using the deployment with real data.
