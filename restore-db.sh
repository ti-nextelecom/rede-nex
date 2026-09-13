#!/usr/bin/env bash
set -euo pipefail
DB_NAME="${DB_NAME:-rede_nex}"
DB_USER="${DB_USER:-postgres}"
createdb -U "$DB_USER" "$DB_NAME" 2>/dev/null || true
if ls database/rede_nex_*.dump >/dev/null 2>&1; then
  pg_restore -U "$DB_USER" -d "$DB_NAME" --no-owner --no-privileges database/rede_nex_*.dump
else
  psql -U "$DB_USER" -d "$DB_NAME" -f database/rede_nex_*.sql
fi
