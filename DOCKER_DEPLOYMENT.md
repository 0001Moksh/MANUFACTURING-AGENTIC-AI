# Production Docker deployment

The client does not need Python, Node.js, npm, PostgreSQL, pgAdmin, or SQL Server installed. Docker Desktop is the only runtime requirement.

## Architecture

`http://localhost:8080` is the only exposed service. Nginx serves the React build and proxies `/api` and `/reports` over the private `mai_internal` Docker network to FastAPI. FastAPI uses the internal service names `postgres-manufacturing`, `postgres-video`, and `sqlserver`; neither PostgreSQL nor SQL Server publishes a host port.

The deployment contains two PostgreSQL 17 services, SQL Server 2022 Express, three one-shot database initializer services, FastAPI, and Nginx. Compose starts FastAPI only after every initializer exits successfully, and starts Nginx only after FastAPI passes `/health`.

## First startup

1. Copy `.env.example` to `.env`.
2. Replace every `CHANGE_ME` value. SQL Server's password must contain uppercase, lowercase, a number, and a symbol. Add at least one LLM API key for live agent responses.
3. From the repository directory run:

   ```powershell
   docker compose up -d --build
   ```
 
   On Windows, `scripts\start.bat` performs the Docker check, build, startup, and basic URL wait for you.

4. Open `http://localhost:8080` (or `http://localhost:<APP_PORT>` if changed).

First start can take several minutes because Docker downloads images, builds the application images, and restores the database backups. Monitor with `docker compose logs -f`.

## Database restoration and persistence

The PostgreSQL backup files have a misleading `.sql` extension: inspection confirms both are `pg_dump` custom archives. The initializer creates `manufacturing_ai` or `construction_ai` only if absent, then restores with `pg_restore` and verifies `SELECT 1`.

The SQL Server initializer waits for `sqlcmd`, checks `sys.databases` for `mes_new`, reads the backup's logical file names using `RESTORE FILELISTONLY`, restores `mes_new.bak` to SQL Server's data volume, and verifies the restored database. The supplied `schema.sql` is retained in the initializer image as a reference asset, but is deliberately not executed after a full `.bak` restore: it starts with `USE [mes_new]` and unconditional `CREATE TABLE` statements, so applying it would fail or risk duplicating the schema already contained in the full backup.

Every initializer first checks whether its target database already exists. If it does, it exits successfully without restore or schema changes. Persistent named volumes are:

- `postgres_manufacturing_data`
- `postgres_video_data`
- `sqlserver_data`
- `backend_reports` and `backend_logs`

Therefore `docker compose restart`, and `docker compose down` followed by `docker compose up -d`, preserve existing client data. Never use `docker compose down -v` unless an intentional total reset is desired.

## Operations

```powershell
# Status and logs
docker compose ps
docker compose logs -f backend

# Stop / restart
docker compose stop
docker compose start
docker compose restart

# Update after receiving newer application images/configuration
docker compose pull
docker compose up -d
```

For intentional destructive reset only, stop the stack and remove the named volumes:

```powershell
docker compose down -v
docker compose up -d --build
```

Back up PostgreSQL with `docker compose exec postgres-manufacturing pg_dump -U <user> manufacturing_ai > manufacturing_ai.backup`; back up MES using SQL Server backup tooling inside the SQL Server container or your approved database backup process. Store backups outside Docker volumes.

## Image distribution

Build the complete local image set:

```powershell
docker compose build
```

Export the application-built images (database vendor images must also be supplied or pulled on the client machine):

```powershell
docker save manufacturing-agentic-ai-backend:latest manufacturing-agentic-ai-frontend:latest manufacturing-agentic-ai-postgres-init:latest manufacturing-agentic-ai-sqlserver-init:latest -o manufacturing-agentic-ai-images.tar
```

The client receives `docker-compose.yml`, `.env.example`, `scripts\start.bat`, and the image archive; then runs:

```powershell
docker load -i manufacturing-agentic-ai-images.tar
Copy-Item .env.example .env
# edit CHANGE_ME values in .env
docker compose up -d
```

For a fully offline client, additionally save and distribute the upstream images shown by `docker compose config --images` after building/pulling them. The images include all three backup assets, so the client does not need the source repository or separate database backup files.

## Troubleshooting

- If an initializer fails, inspect `docker compose logs init-postgres-manufacturing`, `docker compose logs init-postgres-video`, or `docker compose logs init-sqlserver`.
- If the app is unavailable, run `docker compose ps` and `docker compose logs --tail=200 backend frontend`.
- SQL Server needs sufficient Docker memory; allocate at least 4 GB to Docker Desktop.
- If port 8080 is occupied, set `APP_PORT` in `.env` and use that port in `FRONTEND_URL` and `PUBLIC_API_URL`.
