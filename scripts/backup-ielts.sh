#!/usr/bin/env bash
# Dump only IELTShack application tables. Run outside the repo, store encrypted.
# Requires pg_dump (PostgreSQL client) and a percent-encoded connection string.
set -euo pipefail

: "${SUPABASE_DB_URL:?Set SUPABASE_DB_URL to the Postgres connection string}"
command -v pg_dump >/dev/null || { echo "pg_dump is required"; exit 1; }

mkdir -p backups
out="backups/ielts-$(date -u +%Y%m%dT%H%M%SZ).sql"
pg_dump "$SUPABASE_DB_URL" \
  --no-owner --no-privileges --data-only \
  --table='public.ielts_*' \
  -f "$out"
echo "Wrote $out"
