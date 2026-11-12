# Mise en ligne : Netlify + Supabase (+ Stripe)

Architecture retenue (la plus simple et la moins chère à maintenir) :

| Rôle | Service | Coût de départ |
|---|---|---|
| Site public + `/admin` (Next.js) | **Netlify** — déploiement automatique depuis GitHub | gratuit |
| Base de données PostgreSQL | **Supabase** | gratuit (le projet se met en pause après 7 jours sans activité : plan Pro conseillé en production) |
| Photos et vidéos | **Supabase Storage** (bucket `media` public, bucket `private` pour les justificatifs) | inclus |
| Paiement carte + Apple Pay | **Stripe Checkout** (page hébergée par Stripe) | commission par paiement |
| E-mails | SMTP de votre choix (Brevo, Postmark, OVH…) | selon fournisseur |

Aucune clé secrète n'est dans le code : tout se règle dans les **variables d'environnement Netlify**.

---

## 1. Supabase (≈ 5 min)

1. https://supabase.com → **New project** (région Europe, par ex. Paris `eu-west-3`). Notez le mot de passe de la base.
2. **Project Settings → Database → Connection string** :
   - onglet **Transaction pooler** (port **6543**) → c'est `DATABASE_URL`. Ajoutez à la fin : `?pgbouncer=true&connection_limit=1`
   - onglet **Session pooler** (port **5432**) → c'est `DIRECT_URL`.
   - remplacez `[YOUR-PASSWORD]` par le mot de passe de l'étape 1.
3. **Project Settings → API** :
   - **Project URL** → `SUPABASE_URL`
   - clé **anon / public** → `SUPABASE_ANON_KEY`
   - clé **service_role** → `SUPABASE_SERVICE_ROLE_KEY` (**secrète**, uniquement dans Netlify)

Rien d'autre à créer : les tables, la sécurité RLS et les buckets de stockage sont créés automatiquement au premier déploiement.

## 2. Netlify (≈ 5 min)

1. https://app.netlify.com → **Add new site → Import an existing project → GitHub** → dépôt `demo-site-`.
2. Réglages de build :
   - **Branch to deploy** : la branche de production (après fusion : `main`)
   - **Base directory** : `luxury-scent`
   - Build command et publish directory : laissés vides (lus dans `luxury-scent/netlify.toml`).
3. **Site configuration → Environment variables → Add a variable** (« Import from a .env file » accepte un collage) :

| Variable | Valeur | Secrète |
|---|---|---|
| `DATABASE_URL` | Supabase, pooler Transaction (port 6543) + `?pgbouncer=true&connection_limit=1` | oui |
| `DIRECT_URL` | Supabase, pooler Session (port 5432) | oui |
| `SUPABASE_URL` | Project URL | non |
| `SUPABASE_ANON_KEY` | clé anon | non |
| `SUPABASE_SERVICE_ROLE_KEY` | clé service_role | **oui** |
| `SESSION_SECRET` | 64 caractères aléatoires (`openssl rand -hex 32`) | oui |
| `BANK_ENCRYPTION_KEY` | 64 caractères hexadécimaux (`openssl rand -hex 32`) — **à sauvegarder ailleurs** | oui |
| `APP_URL` | `https://votre-site.netlify.app` (puis votre domaine) | non |
| `ADMIN_EMAIL` | votre e-mail de connexion à l'admin | non |
| `ADMIN_PASSWORD` | mot de passe provisoire (10 caractères min.) — à supprimer après la 1re connexion | oui |
| `SEED_DEMO` | `1` pour créer un catalogue de démonstration (supprimable en un clic) ; sinon ne pas créer | non |

   Pour générer une valeur aléatoire sans terminal : Netlify propose « Generate » sur certaines intégrations ;
   sinon n'importe quel générateur de mot de passe (64 caractères 0-9 a-f pour `BANK_ENCRYPTION_KEY`).
4. **Deploys → Trigger deploy**. Le build échoue avec un message clair si une variable manque.

À chaque déploiement de production : migrations de la base, activation RLS, création du compte propriétaire
(s'il n'en existe aucun), création des buckets, couverture et pages légales (si absentes).
Les « deploy previews » ne touchent jamais à la base.

Ensuite : chaque `git push` sur la branche de production redéploie automatiquement le site.

## 3. Première connexion

- Admin : `https://votre-site.netlify.app/admin` avec `ADMIN_EMAIL` / `ADMIN_PASSWORD`.
- Changez le mot de passe (Utilisateurs), puis supprimez `ADMIN_PASSWORD` des variables Netlify.
- **Réglages → Paramètres** : raison sociale, adresse, e-mail, téléphone, SIRET, TVA… (rien n'est pré-rempli).
- **Contenu → Pages** : complétez CGV, mentions légales, confidentialité, livraison, retours (modèles marqués « À compléter » — à faire valider par un professionnel du droit).
- **Réglages → Livraison** : remplacez le mode « Démo » par vos vrais tarifs.
- **Catalogue → Produits** : bouton « Supprimer les produits de démo » quand vos produits sont prêts.
- **Catalogue → Promotions** : offre « 2e parfum » (taux, seuil, titre, produits éligibles, activation).

## 4. Stripe (plus tard)

1. https://dashboard.stripe.com → **Developers → API keys** → clé secrète → variable Netlify `STRIPE_SECRET_KEY`.
2. **Developers → Webhooks → Add endpoint** :
   - URL : `https://votre-domaine/api/stripe/webhook`
   - événements : `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `checkout.session.expired`
   - « Signing secret » (`whsec_…`) → variable Netlify `STRIPE_WEBHOOK_SECRET`.
3. **Settings → Payment methods** : activez Cartes et **Apple Pay** (et Google Pay si souhaité).
   **Settings → Payment method domains** : ajoutez votre domaine (ex. `luxury-scent.fr` et `votre-site.netlify.app`).
   Le paiement se fait sur la page Stripe Checkout : Apple Pay s'y affiche automatiquement sur les appareils compatibles.
4. Redéployez. Dans l'admin, **Promotions et paiement** indique « activé ».
5. Testez d'abord en mode test (`sk_test_…`, carte `4242 4242 4242 4242`), puis passez aux clés live.

Sans clés Stripe, la commande en ligne est désactivée (message clair au client) ; le virement reste « Bientôt disponible »
tant qu'il n'est pas activé dans Promotions et paiement (il exige un compte bancaire dans l'admin).

## 5. E-mails (SMTP)

Variables `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`. Sans elles, les e-mails (confirmation de commande,
paiement reçu, expédition) sont **journalisés** dans Admin → E-mails envoyés mais **pas envoyés**.

## 6. Sécurité en place

- Admin : sessions signées (cookie httpOnly), mots de passe bcrypt, limitation des tentatives en base, rôles, journal d'audit.
- Base : RLS activée sur toutes les tables, aucun accès via les clés publiques Supabase ; seul le serveur lit/écrit.
- Médias : envoi direct navigateur → Supabase par URL signée à usage unique délivrée après contrôle admin ; type et taille vérifiés à la réception ; seules les URL de notre stockage sont acceptées dans les formulaires.
- Prix et remises recalculés côté serveur (panier, commande, Stripe) ; le webhook vérifie la signature Stripe et le montant payé.
- Aucune donnée de carte ne transite par le site (Stripe Checkout). IBAN chiffrés (AES-256-GCM).

## 7. Tester le site déployé

```bash
cd luxury-scent
APP_URL=https://votre-site.netlify.app DATABASE_URL="…" TEST_ADMIN_EMAIL=… TEST_ADMIN_PASSWORD=… TEST_WEBHOOK=0 npm test
```
(Le test crée des commandes et un produit « Produit test … » : à supprimer ensuite dans l'admin.)
