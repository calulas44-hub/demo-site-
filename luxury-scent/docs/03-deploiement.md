# Installation, configuration et déploiement

## 1. Installation locale (5 minutes)

```bash
cd luxury-scent
npm install
cp .env.example .env
```

Éditez `.env` :

- `SESSION_SECRET` et `BANK_ENCRYPTION_KEY` : générez deux valeurs différentes avec
  `openssl rand -hex 32`.
- `ADMIN_EMAIL` / `ADMIN_PASSWORD` : votre premier compte administrateur.

Puis :

```bash
npm run db:push      # crée la base SQLite (storage/luxury-scent.db)
npm run db:seed      # administrateur + données de démonstration
npm run dev          # http://localhost:3000  — admin : http://localhost:3000/admin
```

Pour repartir d'une boutique vide : supprimez les produits de démonstration
depuis l'administration (ou supprimez `storage/luxury-scent.db` avant le seed
et retirez les produits avec `npm run db:push` seul, puis créez l'admin avec
`npm run admin:create -- vous@domaine.fr "mot de passe" "Votre nom" OWNER`).

## 2. Services externes à activer

| Service | Rôle | Variables | Sans configuration |
|---|---|---|---|
| **Stripe** | Paiement par carte (page Stripe Checkout, aucune donnée de carte sur le serveur) | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Le paiement par carte n'est pas proposé ; le virement reste disponible. |
| **SMTP** | E-mails de confirmation, expédition, bienvenue, contact | `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | Les e-mails sont journalisés dans *Administration → E-mails envoyés* mais ne partent pas. |

### Stripe

1. Créez un compte sur stripe.com, récupérez la clé secrète (mode test puis live).
2. Dans *Développeurs → Webhooks*, ajoutez l'endpoint `https://votre-domaine/api/stripe/webhook`
   avec les événements `checkout.session.completed`, `checkout.session.async_payment_succeeded`,
   `checkout.session.async_payment_failed`, `checkout.session.expired`. Copiez le secret de signature.
3. Renseignez les deux variables et redémarrez. Le tableau de bord admin cesse d'afficher
   l'alerte « Paiement par carte non activé ».

En local, testez avec `stripe listen --forward-to localhost:3000/api/stripe/webhook`.

### SMTP

N'importe quel fournisseur fonctionne (OVH, o2switch, Gmail Workspace, Brevo, Mailgun…).
Utilisez un sous-domaine dédié (`mail.votre-domaine`) et configurez SPF/DKIM chez le fournisseur
pour une bonne délivrabilité.

## 3. Mise en production

### Option A — serveur Node (VPS, OVH, Scaleway, Hetzner…)

```bash
git clone <dépôt> && cd demo-site-/luxury-scent
npm ci
cp .env.example .env   # puis éditer : APP_URL=https://votre-domaine, clés, SMTP, Stripe
npm run build
npm run db:migrate     # applique les migrations
npm run db:seed        # une seule fois : crée l'admin (données de démo si la base est vide)
npm start              # écoute sur le port 3000
```

Placez un reverse proxy (Caddy ou Nginx) devant avec HTTPS. Exemple Caddy :

```
votre-domaine {
  reverse_proxy localhost:3000
  request_body { max_size 30MB }
}
```

Gardez le processus en vie avec `pm2` (`pm2 start npm --name luxury-scent -- start`)
ou un service systemd. Le dossier `storage/` (base SQLite + images) doit être
persistant et sauvegardé.

### Option B — conteneur Docker

Un `Dockerfile` est fourni. Montez un volume sur `/app/storage` :

```bash
docker build -t luxury-scent .
docker run -d --name luxury-scent -p 3000:3000 --env-file .env -v luxury-scent-storage:/app/storage luxury-scent
```

### Option C — plateformes gérées (Vercel, Railway, Render…)

Le projet se déploie comme toute application Next.js. Deux points d'attention :

- Le **système de fichiers n'est pas persistant** sur ces plateformes : utilisez
  PostgreSQL (voir ci-dessous) et prévoyez un stockage objet pour les images
  (adapter `src/lib/uploads.ts` vers S3/R2 — le reste du code n'a pas à changer).
- Déclarez les variables d'environnement dans le tableau de bord de la plateforme.

## 4. Passer de SQLite à PostgreSQL (recommandé en production)

1. Dans `prisma/schema.prisma`, remplacez `provider = "sqlite"` par `provider = "postgresql"`.
2. `DATABASE_URL="postgresql://user:motdepasse@hote:5432/luxury_scent"`.
3. Supprimez le dossier `prisma/migrations` (les migrations SQLite ne sont pas transposables)
   puis `npx prisma migrate dev --name init` en local, et `npm run db:migrate` en production.
4. Pour reprendre les données d'une base SQLite existante, exportez-les (Prisma Studio,
   script) avant la bascule ; les identifiants sont des chaînes `cuid`, compatibles.

## 5. Sauvegardes

- `npm run backup` crée `backups/<date>.tar.gz` (base + images) et conserve les 30 dernières.
- Planifiez-le chaque nuit (`crontab -e` : `0 3 * * * cd /chemin/luxury-scent && npm run backup`)
  et copiez les archives hors du serveur (rclone vers un stockage objet, par exemple).
- Avec PostgreSQL, le script appelle `pg_dump` s'il est installé.
- Restauration SQLite : arrêter le serveur, remplacer `storage/luxury-scent.db` et `storage/uploads/`, redémarrer.

## 6. Sécurité : liste de contrôle avant ouverture

- [ ] `SESSION_SECRET` et `BANK_ENCRYPTION_KEY` uniques, générés aléatoirement, jamais commités.
      **Conservez `BANK_ENCRYPTION_KEY` dans un gestionnaire de mots de passe : sans elle, les IBAN chiffrés sont illisibles.**
- [ ] Mot de passe administrateur fort ; créez des comptes « Collaborateur » pour l'équipe plutôt que de partager le vôtre.
- [ ] HTTPS activé (`APP_URL` en https) : les cookies de session sont alors marqués `Secure`.
- [ ] Remplacez le compte bancaire « EXEMPLE » par votre IBAN réel (*Administration → Coordonnées bancaires*), puis supprimez l'exemple.
- [ ] Complétez *Paramètres* (raison sociale, SIRET, TVA, adresse) : ces informations figurent sur les factures.
- [ ] Relisez et faites valider les pages CGV, mentions légales et confidentialité.
- [ ] Sauvegardes planifiées et testées.
- [ ] Mettez à jour les dépendances régulièrement (`npm outdated`, `npm audit`).

## 7. Maintenance courante

| Besoin | Où |
|---|---|
| Ajouter / modifier un parfum, ses prix, ses photos, son stock | Administration → Produits |
| Mettre un produit en avant sur l'accueil | Fiche produit → « Mettre en avant » ou Accueil → section « Produits mis en avant » |
| Changer les visuels ou textes de l'accueil | Administration → Page d'accueil |
| Modifier CGV, mentions légales, livraison | Administration → Pages |
| Traiter une commande, imprimer une facture, rembourser | Administration → Commandes |
| Enregistrer une dépense, exporter pour le comptable | Administration → Comptabilité |
| Changer l'IBAN | Administration → Coordonnées bancaires (rôle Propriétaire) |
| Logo, coordonnées, TVA, réassurance | Administration → Paramètres |
| Frais de port | Administration → Livraison |

## 8. Tests

```bash
npm run dev          # dans un terminal
npm test             # dans un autre : parcours d'achat + administration
npm run typecheck && npm run lint
```
