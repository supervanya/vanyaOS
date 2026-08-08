#!/usr/bin/env bash
# Mirror production Supabase data into the local Postgres instance.
#
# What it does:
#   1. Dumps DATA (not schema) from the linked prod project — includes the
#      auth/storage schemas, so real users and sessions come along.
#   2. Resets the local database (wipes local data, re-applies migrations).
#   3. Loads the prod data into the local database.
#
# Prereqs: `bunx supabase start` running, project linked (`supabase link`),
# and psql on PATH. May prompt for the prod database password if the CLI
# doesn't have it saved.
set -euo pipefail
cd "$(dirname "$0")/.."

LOCAL_DB_URL="postgresql://postgres:postgres@127.0.0.1:54322/postgres"
DUMP_FILE="$(mktemp -t vanyaos-prod-data)"
trap 'rm -f "$DUMP_FILE"' EXIT

echo "==> Dumping data from linked production project..."
# Only auth + public: storage's internal tables aren't writable by the local
# postgres role, and this app doesn't use storage.
bunx supabase db dump --linked --data-only --use-copy --schema auth,public -f "$DUMP_FILE"

echo "==> Resetting local database (wipes local data, re-applies migrations)..."
bunx supabase db reset --no-seed

echo "==> Loading production data into local database..."
psql "$LOCAL_DB_URL" \
  -v ON_ERROR_STOP=1 \
  --single-transaction \
  -c 'set session_replication_role = replica' \
  -f "$DUMP_FILE"

echo "==> Done. Local database now mirrors production data."
