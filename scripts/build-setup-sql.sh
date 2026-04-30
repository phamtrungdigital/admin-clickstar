#!/usr/bin/env bash
# Concat all SQL migrations under supabase/migrations into scripts/setup.sql.
# Run from repo root. The combined file is what you paste into the Supabase
# SQL Editor when bootstrapping a fresh project.

set -euo pipefail

cd "$(dirname "$0")/.."

OUT=scripts/setup.sql

{
  printf -- "-- Generated combined migration file. DO NOT EDIT.\n"
  printf -- "-- Source of truth: supabase/migrations/*.sql\n"
  printf -- "-- Regenerate with: scripts/build-setup-sql.sh\n"
  printf -- "--\n"
  printf -- "-- Apply by pasting the entire contents of this file into\n"
  printf -- "-- https://supabase.com/dashboard/project/kdzorsvjefcmmtefvbrx/sql/new\n"
  printf -- "-- and clicking Run.\n\n"
  for f in supabase/migrations/*.sql; do
    printf -- "-- ============================================================\n"
    printf -- "-- %s\n" "$(basename "$f")"
    printf -- "-- ============================================================\n\n"
    cat "$f"
    printf "\n\n"
  done
} > "$OUT"

echo "wrote $OUT ($(wc -l < "$OUT" | tr -d ' ') lines, $(wc -c < "$OUT" | tr -d ' ') bytes)"
