#!/usr/bin/env bash
# Pull the latest code and (re)start everything. Run on the server:  ./deploy/oracle/deploy.sh
set -euo pipefail
cd "$(dirname "$0")"
[ -f .env ] || { echo "Missing deploy/oracle/.env — copy .env.example and fill it in first."; exit 1; }
git -C ../.. pull --ff-only
docker compose up -d --build
docker image prune -f >/dev/null
docker compose ps
