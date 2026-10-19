#!/usr/bin/env bash
# Create the admin account (or reset its password) from ADMIN_EMAIL / ADMIN_PASSWORD in .env.
set -euo pipefail
cd "$(dirname "$0")"
docker compose exec api pnpm --filter @briefluence/api admin:create
