#!/usr/bin/env bash
# Restore a database dump made by backup.sh:  ./deploy/oracle/restore.sh backups/db-YYYY-MM-DD_HHMM.dump
# This REPLACES the current database. A fresh backup is taken first.
set -euo pipefail
cd "$(dirname "$0")"
FILE="${1:?usage: restore.sh <path-to-db-dump>}"
read -r -p "Replace the live database with $FILE? Type yes: " ok
[ "$ok" = "yes" ] || exit 1
./backup.sh
docker compose stop api web
docker compose exec -T db pg_restore -U briefluence -d briefluence --clean --if-exists < "$FILE"
docker compose start api web
echo "Restored."
