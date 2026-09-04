#!/usr/bin/env bash
set -euo pipefail
SQLCMD=/opt/mssql-tools18/bin/sqlcmd
SERVER="${SQLSERVER_HOST:?SQLSERVER_HOST is required}"
DATABASE="${SQLSERVER_DATABASE:?SQLSERVER_DATABASE is required}"
USER_NAME="${SQLSERVER_USER:-sa}"
PASSWORD="${SQLSERVER_PASSWORD:?SQLSERVER_PASSWORD is required}"
BACKUP=/backups/mes_new.bak

if [ "${#PASSWORD}" -lt 8 ] || [[ ! "$PASSWORD" =~ [A-Z] ]] || [[ ! "$PASSWORD" =~ [a-z] ]] || [[ ! "$PASSWORD" =~ [0-9] ]] || [[ ! "$PASSWORD" =~ [^a-zA-Z0-9] ]]; then
  echo "[ERROR] SQLSERVER_PASSWORD must be at least 8 characters and contain uppercase, lowercase, number, and symbol characters." >&2
  exit 1
fi

run_sql() { "$SQLCMD" -C -b -S "$SERVER" -U "$USER_NAME" -P "$PASSWORD" -Q "$1"; }
echo "[INFO] Waiting for SQL Server authentication..."
for attempt in $(seq 1 60); do
  if run_sql 'SELECT 1' >/dev/null 2>&1; then break; fi
  if [ "$attempt" = 60 ]; then echo '[ERROR] SQL Server did not accept authenticated connections.' >&2; exit 1; fi
  sleep 2
done
echo "[INFO] SQL Server is ready."
if run_sql "SELECT 1 FROM sys.databases WHERE name = N'$DATABASE'" -h -1 -W | grep -q 1; then
  echo "[INFO] SQL Server database '$DATABASE' already exists; preserving existing data."
  exit 0
fi
echo "[INFO] MES database not found; reading logical files from backup."
mapfile -t files < <("$SQLCMD" -C -b -S "$SERVER" -U "$USER_NAME" -P "$PASSWORD" -h -1 -W -s '|' -Q "RESTORE FILELISTONLY FROM DISK = N'$BACKUP'" | awk -F'|' 'NF >= 3 { gsub(/^[ \t]+|[ \t]+$/, "", $1); gsub(/^[ \t]+|[ \t]+$/, "", $3); if ($3 == "D" || $3 == "L") print $1 "|" $3 }')
if [ "${#files[@]}" -eq 0 ]; then echo '[ERROR] Could not read logical file names from MES backup.' >&2; exit 1; fi
moves=(); data_index=0; log_index=0
for entry in "${files[@]}"; do
  logical=${entry%%|*}; type=${entry##*|}
  if [ "$type" = D ]; then suffix="${data_index}.mdf"; data_index=$((data_index + 1)); else suffix="${log_index}.ldf"; log_index=$((log_index + 1)); fi
  moves+=("MOVE N'$logical' TO N'/var/opt/mssql/data/${DATABASE}_${suffix}'")
done
restore="RESTORE DATABASE [$DATABASE] FROM DISK = N'$BACKUP' WITH $(IFS=,; echo "${moves[*]}"), RECOVERY, REPLACE"
echo "[INFO] Restoring SQL Server database '$DATABASE'."
run_sql "$restore"
run_sql "SELECT name FROM sys.databases WHERE name = N'$DATABASE'"
echo "[INFO] SQL Server database '$DATABASE' restored and verified."
