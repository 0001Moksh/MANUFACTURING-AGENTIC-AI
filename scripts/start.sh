#!/usr/bin/env bash
set -euo pipefail

repo_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
service_name=iiiot-veda-app
mode="${1:-}"

case "$mode" in
  install)
    command -v docker >/dev/null || { echo 'Docker is required.' >&2; exit 1; }
    docker compose version >/dev/null || { echo 'Docker Compose v2 is required.' >&2; exit 1; }
    if [[ ! -f "$repo_dir/.env" ]] || grep -q CHANGE_ME "$repo_dir/.env"; then
      echo "Configure $repo_dir/.env before installing the startup service." >&2
      exit 1
    fi
    sudo tee "/etc/systemd/system/$service_name.service" >/dev/null <<EOF
[Unit]
Description=IIIOT-Veda application stack
Requires=docker.service
After=docker.service network-online.target
Wants=network-online.target

[Service]
Type=oneshot
WorkingDirectory=$repo_dir
ExecStart=$(command -v docker) compose up -d --build
ExecStop=$(command -v docker) compose stop
RemainAfterExit=yes
TimeoutStartSec=0

[Install]
WantedBy=multi-user.target
EOF
    sudo systemctl daemon-reload
    sudo systemctl enable --now "$service_name"
    ;;
  run)
    cd "$repo_dir"
    docker compose up -d --build
    ;;
  stop)
    sudo systemctl disable --now "$service_name"
    ;;
  *)
    echo "Usage: scripts/start.sh install|run|stop" >&2
    exit 2
    ;;
esac
