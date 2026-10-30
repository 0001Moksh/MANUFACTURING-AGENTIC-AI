#!/usr/bin/env bash
set -euo pipefail

repo_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${repo_dir}"

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is not installed or is not on PATH." >&2
  exit 1
fi

if ! docker info >/dev/null 2>&1; then
  echo "Docker is not running, or the current user cannot access it." >&2
  echo "On Fedora, start Docker and ensure your user can access its socket." >&2
  exit 1
fi

if [[ ! -f .env ]]; then
  cp .env.example .env
  echo "Created .env. Set the CHANGE_ME values, then run scripts/start.sh again."
  exit 1
fi

if grep -q "CHANGE_ME" .env; then
  echo ".env still contains CHANGE_ME values. Update them before starting." >&2
  exit 1
fi

docker compose pull
docker compose up -d --build

echo "Waiting for the application health check..."
for _ in {1..60}; do
  if curl -fsS http://localhost:8080/ >/dev/null 2>&1; then
    echo "Application ready: http://localhost:8080"
    exit 0
  fi
  sleep 2
done

echo "Application did not become ready. Run: docker compose logs --tail=200" >&2
exit 1
