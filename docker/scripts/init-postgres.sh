#!/usr/bin/env bash
set -euo pipefail
: "${TARGET_DATABASE:?TARGET_DATABASE is required}"
: "${BACKUP_FILE:?BACKUP_FILE is required}"

if [[ ! "$TARGET_DATABASE" =~ ^[a-zA-Z_][a-zA-Z0-9_]*$ ]]; then
  echo "[ERROR] TARGET_DATABASE must contain only letters, numbers, and underscores and must not start with a number." >&2
  exit 1
fi

if psql -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname = '$TARGET_DATABASE'" | grep -q 1; then
  echo "PostgreSQL database '$TARGET_DATABASE' already exists; preserving existing data."
  exit 0
fi
echo "Creating PostgreSQL database '$TARGET_DATABASE'."
psql -d postgres -v ON_ERROR_STOP=1 -c "CREATE DATABASE \"$TARGET_DATABASE\""
echo "Restoring '$BACKUP_FILE' into '$TARGET_DATABASE'."
pg_restore --exit-on-error --no-owner --no-privileges --dbname="$TARGET_DATABASE" "$BACKUP_FILE"
psql -d "$TARGET_DATABASE" -v ON_ERROR_STOP=1 -c 'SELECT 1'
echo "PostgreSQL database '$TARGET_DATABASE' initialized and verified."
