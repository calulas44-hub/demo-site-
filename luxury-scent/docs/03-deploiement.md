# Développement local

La production tourne entièrement sur **Netlify** (site, base Netlify Database, médias Netlify Blobs) : voir [04-netlify.md](04-netlify.md).

## Démarrer en local

Prérequis : Node 22, PostgreSQL 15+ en local.

```bash
cp .env.example .env          # renseigner DATABASE_URL / DIRECT_URL, SESSION_SECRET, BANK_ENCRYPTION_KEY, ADMIN_*
npm install
npx prisma migrate deploy
node scripts/bootstrap.mjs    # RLS + compte propriétaire
SEED_DEMO=1 npm run db:seed   # couverture, pages légales à compléter, catalogue de démonstration
npm run build && npm start    # http://localhost:3000 — admin : /admin
npm test                      # tests de bout en bout (serveur démarré)
```

En local, les médias sont enregistrés dans `storage/uploads` (sur Netlify : Netlify Blobs).

## Autre hébergeur (Docker)

Le `Dockerfile` reste utilisable sur un serveur Node : il applique les migrations, exécute
`scripts/bootstrap.mjs` puis démarre le serveur. Mêmes variables d'environnement que sur Netlify.

## Sauvegardes

- Base : sauvegardes automatiques de Netlify Database (durée selon l'offre) ou `pg_dump` avec l'adresse de connexion.
- Médias : stores `media` et `private` de Netlify Blobs ; images de départ dans `public/seed`.
- **`BANK_ENCRYPTION_KEY`** : à conserver hors du site (gestionnaire de mots de passe). Sans elle, les IBAN enregistrés sont illisibles.
