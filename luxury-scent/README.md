# Luxury Scent — boutique de parfumerie en ligne

Site e-commerce haut de gamme (catalogue, fiches produit, panier, commande, espace
client) et **espace administrateur complet** (produits, photos, contenu de l'accueil,
pages, commandes, factures, comptabilité, coordonnées bancaires, paramètres), construit
avec Next.js 15, Prisma et TypeScript.

- Analyse du site de référence : [`docs/01-analyse-site-reference.md`](docs/01-analyse-site-reference.md)
- Architecture technique : [`docs/02-architecture.md`](docs/02-architecture.md)
- Installation, configuration et déploiement : [`docs/03-deploiement.md`](docs/03-deploiement.md)

## Démarrage rapide

```bash
npm install
cp .env.example .env      # renseigner SESSION_SECRET, BANK_ENCRYPTION_KEY (openssl rand -hex 32), ADMIN_*
npm run db:push && npm run db:seed
npm run dev
```

Boutique : http://localhost:3000 — Administration : http://localhost:3000/admin
(identifiants `ADMIN_EMAIL` / `ADMIN_PASSWORD` du fichier `.env`).

## Ce qui fonctionne sans configuration supplémentaire

- Catalogue, recherche, filtres, fiche produit avec contenances, panier, commande
  par **virement bancaire** (IBAN géré dans l'administration), suivi de commande,
  espace client, factures PDF, avoirs, journal de gestion et exports CSV/Excel.

## Ce qui demande un compte externe

- **Paiement par carte** : clés Stripe (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`).
- **Envoi réel des e-mails** : un serveur SMTP (`SMTP_*`). Sans cela, les e-mails sont
  journalisés dans l'administration mais ne partent pas.

Voir `docs/03-deploiement.md` pour la marche à suivre.

## Commandes

| Commande | Rôle |
|---|---|
| `npm run dev` / `npm run build` / `npm start` | développement / build / production |
| `npm run db:push`, `npm run db:migrate`, `npm run db:seed` | base de données |
| `npm run admin:create -- email "mot de passe" "Nom" OWNER` | créer un administrateur |
| `npm run backup` | archive datée de la base et des images |
| `npm test`, `npm run typecheck`, `npm run lint` | tests de bout en bout, typage, lint |

## Avertissements

- Le module « Comptabilité » est un **outil de suivi de gestion** : il n'est pas un
  logiciel de comptabilité certifié. Ses exports sont conçus pour alimenter votre
  logiciel comptable ou votre expert-comptable.
- Les textes juridiques fournis (CGV, mentions légales, confidentialité) sont des
  gabarits à compléter et à faire valider.
- Les produits, marques et collections de démonstration sont fictifs.
