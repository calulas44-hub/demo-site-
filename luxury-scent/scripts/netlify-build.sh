#!/usr/bin/env bash
# Build Netlify : base de données Netlify Database (NETLIFY_DB_URL, fournie automatiquement)
# et stockage Netlify Blobs. Aucun service externe requis.
set -euo pipefail

missing=()
for v in SESSION_SECRET BANK_ENCRYPTION_KEY; do
  [ -n "${!v:-}" ] || missing+=("$v")
done
if [ -z "${DATABASE_URL:-${NETLIFY_DB_URL:-}}" ]; then
  missing+=("base de données (activez Netlify Database : Data & Storage → Database)")
fi
if [ ${#missing[@]} -gt 0 ]; then
  echo "❌ Configuration manquante dans Netlify : ${missing[*]}"
  echo "   Voir docs/04-netlify.md"
  exit 1
fi

using_netlify_db=""
[ -z "${DATABASE_URL:-}" ] && [ -n "${NETLIFY_DB_URL:-}" ] && using_netlify_db="1"
eval "$(node scripts/db-url.mjs)"

npx prisma generate
# Avec Netlify Database, chaque deploy preview a sa propre copie de la base : les migrations
# peuvent s'y appliquer sans risque. Avec une base externe, uniquement en production.
if [ -n "$using_netlify_db" ] || [ "${CONTEXT:-production}" = "production" ]; then
  npx prisma migrate deploy
  node scripts/bootstrap.mjs
  npx tsx prisma/seed.ts
else
  echo "Contexte ${CONTEXT} avec base externe : migrations et initialisation ignorées."
fi
npx next build
