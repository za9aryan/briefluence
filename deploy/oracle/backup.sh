#!/usr/bin/env bash
# Database dump + uploaded files, kept 14 days in <repo>/backups. Runs daily from cron (setup.sh).
set -euo pipefail
cd "$(dirname "$0")"
DIR="$(cd ../.. && pwd)/backups"
STAMP="$(date +%Y-%m-%d_%H%M)"
mkdir -p "$DIR"
docker compose exec -T db pg_dump -U briefluence -Fc briefluence > "$DIR/db-$STAMP.dump"
docker run --rm -v briefluence_uploads:/uploads:ro -v "$DIR":/backup alpine \
  tar czf "/backup/uploads-$STAMP.tgz" -C /uploads .
find "$DIR" -name 'db-*.dump' -mtime +14 -delete
find "$DIR" -name 'uploads-*.tgz' -mtime +14 -delete
echo "Backup saved: $DIR/db-$STAMP.dump"
