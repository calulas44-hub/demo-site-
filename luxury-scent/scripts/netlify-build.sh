#!/usr/bin/env bash
# Build Netlify. Les migrations et l'initialisation ne s'exécutent qu'en production
# (jamais sur les « deploy previews » ou branches de test, qui partagent la même base).
set -euo pipefail

missing=()
for v in DATABASE_URL DIRECT_URL SESSION_SECRET BANK_ENCRYPTION_KEY; do
  [ -n "${!v:-}" ] || missing+=("$v")
done
if [ -z "${SUPABASE_URL:-${NEXT_PUBLIC_SUPABASE_URL:-}}" ] || [ -z "${SUPABASE_SERVICE_ROLE_KEY:-}" ]; then
  missing+=("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY")
fi
if [ ${#missing[@]} -gt 0 ]; then
  echo "❌ Variables d'environnement manquantes dans Netlify : ${missing[*]}"
  echo "   Voir docs/04-netlify-supabase.md"
  exit 1
fi

npx prisma generate
if [ "${CONTEXT:-production}" = "production" ]; then
  npx prisma migrate deploy
  node scripts/bootstrap.mjs
  npx tsx prisma/seed.ts
else
  echo "Contexte ${CONTEXT} : migrations et initialisation ignorées."
fi
npx next build
