#!/usr/bin/env bash
set -euo pipefail

repo_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
backend_dir="${repo_dir}/backend"

if ! command -v dnf >/dev/null 2>&1; then
  echo "This setup script requires a Fedora/RHEL system with dnf." >&2
  exit 1
fi

echo "Installing Fedora build and ODBC prerequisites..."
sudo dnf install -y \
  python3.11 python3.11-devel \
  gcc gcc-c++ make \
  unixODBC unixODBC-devel

if ! command -v python3.11 >/dev/null 2>&1; then
  echo "python3.11 was not found after installation." >&2
  exit 1
fi

cd "${backend_dir}"

if [[ -d venv && ! -x venv/bin/python ]]; then
  echo "backend/venv exists but is not a Linux virtual environment." >&2
  echo "Move or remove it, then run this script again." >&2
  exit 1
fi

if [[ ! -d venv ]]; then
  python3.11 -m venv venv
fi

venv/bin/python -m pip install --upgrade pip setuptools wheel
venv/bin/python -m pip install -r requirements.txt

if [[ ! -f .env ]]; then
  cp .env.example .env
  echo "Created backend/.env. Update its database credentials and API keys before starting."
fi

if ! odbcinst -q -d 2>/dev/null | grep -Fq "ODBC Driver 18 for SQL Server"; then
  echo
  echo "NOTE: Microsoft ODBC Driver 18 is not installed."
  echo "Install msodbcsql18 if this backend must connect directly to SQL Server."
  echo "Docker Compose already installs the driver inside the backend container."
fi

echo
echo "Fedora backend environment is ready."
echo "Start it with: cd backend && venv/bin/python -m uvicorn app.main:app --host 0.0.0.0 --port 8001"
