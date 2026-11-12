# Développement local

La production tourne sur **Netlify + Supabase** : voir [04-netlify-supabase.md](04-netlify-supabase.md).

## Démarrer en local

Prérequis : Node 22, PostgreSQL 15+ (local ou un projet Supabase de test).

```bash
cp .env.example .env          # renseigner DATABASE_URL / DIRECT_URL, SESSION_SECRET, BANK_ENCRYPTION_KEY, ADMIN_*
npm install
npx prisma migrate deploy
node scripts/bootstrap.mjs    # RLS + compte propriétaire
SEED_DEMO=1 npm run db:seed   # couverture, pages légales à compléter, catalogue de démonstration
npm run build && npm start    # http://localhost:3000 — admin : /admin
npm test                      # tests de bout en bout (serveur démarré)
```

Sans variables Supabase, les médias sont enregistrés dans `storage/uploads` (développement uniquement).

## Autre hébergeur (Docker)

Le `Dockerfile` reste utilisable sur un serveur Node : il applique les migrations, exécute
`scripts/bootstrap.mjs` puis démarre le serveur. Mêmes variables d'environnement que sur Netlify.

## Sauvegardes

- Base : sauvegardes quotidiennes Supabase (plan payant) ou `pg_dump "$DIRECT_URL" > sauvegarde.sql`.
- Médias : bucket `media` / `private` de Supabase Storage.
- **`BANK_ENCRYPTION_KEY`** : à conserver hors du site (gestionnaire de mots de passe). Sans elle, les IBAN enregistrés sont illisibles.
