#!/usr/bin/env bash
# Build Netlify : base de données Netlify Database (NETLIFY_DB_URL, fournie automatiquement)
# et stockage Netlify Blobs. Aucun service externe ni aucune variable d'environnement requis :
# les clés secrètes sont générées et conservées dans la base, le compte admin se crée sur /admin/setup.
set -euo pipefail

if [ -z "${DATABASE_URL:-${NETLIFY_DB_URL:-}}" ]; then
  echo "❌ Aucune base de données : dans Netlify, ouvrez Data & Storage → Database → Create database,"
  echo "   puis relancez le déploiement (Deploys → Trigger deploy). Voir docs/04-netlify.md"
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
