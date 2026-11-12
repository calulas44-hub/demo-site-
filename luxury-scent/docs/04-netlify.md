# Mise en ligne : tout sur Netlify

Tout est hébergé chez Netlify, sans autre service :

| Rôle | Service Netlify |
|---|---|
| Site public + `/admin` (Next.js) | Netlify (déploiement automatique depuis GitHub) |
| Base de données PostgreSQL | **Netlify Database** — créée automatiquement, adresse fournie dans `NETLIFY_DB_URL` |
| Photos et vidéos | **Netlify Blobs** — stockage durable, rien à configurer |
| Paiement carte + Apple Pay (plus tard) | Stripe Checkout |

Aucune clé secrète n'est dans le code : tout se règle dans les variables d'environnement Netlify.

## 1. Créer le site (≈ 3 min, aucune variable à saisir)

1. https://app.netlify.com → **Add new project → Import an existing project → GitHub** → dépôt `demo-site-`.
2. Réglages :
   - **Branch to deploy** : `claude/zealous-dijkstra-uc5a0d` (ou `main` après fusion)
   - **Base directory** : `luxury-scent`
   - Build command / Publish directory : laisser vides (lus dans `luxury-scent/netlify.toml`)
   - **Aucune variable d'environnement** n'est nécessaire.
3. **Deploy**.

La base **Netlify Database** est créée automatiquement (le projet contient le module `@netlify/database`).
Si le build s'arrête avec « Aucune base de données », ouvrez **Data & Storage → Database → Create database**,
puis **Deploys → Trigger deploy**.

Les clés secrètes (sessions, chiffrement des IBAN) sont générées automatiquement au premier démarrage
et conservées dans la base, qui n'est jamais exposée publiquement.

## 2. Créer votre compte administrateur

1. Dans Netlify : **Deploys** → cliquez sur le **dernier** déploiement. Le code (ex. `T7E9-J2NR-6GUN`) s'affiche
   en haut de la page, dans le **Deploy summary** (« Code d'installation : … »). Il figure aussi dans le journal
   (**Deploy log** → section de la commande de build → cherchez `INSTALLATION`).
   Chaque déploiement génère un nouveau code tant qu'aucun compte n'existe : utilisez toujours celui du dernier.
2. Ouvrez `https://<votre-site>.netlify.app/admin` : la page **Première installation** s'affiche.
3. Saisissez le code, votre e-mail et un mot de passe (10 caractères minimum).
   Le code ne sert qu'une fois ; la page disparaît dès que le compte existe.

Ensuite, dans l'admin :
- **Réglages → Paramètres** : raison sociale, adresse, e-mail, téléphone, SIRET, TVA… (rien n'est pré-rempli).
- **Contenu → Pages** : CGV, mentions légales, confidentialité, livraison, retours (modèles « À compléter »,
  à faire valider par un professionnel du droit).
- **Réglages → Livraison** : remplacez le mode « Démo » (0 €) par vos vrais tarifs **avant toute vente**.
- **Catalogue → Produits** : « Supprimer les produits de démo » quand vos produits sont prêts
  (ils ne reviennent pas aux déploiements suivants).
- **Catalogue → Promotions** : offre « 2e parfum » et moyens de paiement.

Variables facultatives (pour plus tard) : `APP_URL` (nom de domaine), `SEED_DEMO=0` (pas de produits démo),
Stripe et SMTP ci-dessous. `SESSION_SECRET` / `BANK_ENCRYPTION_KEY` peuvent aussi être fournies, mais
**n'ajoutez pas `BANK_ENCRYPTION_KEY` après avoir enregistré un IBAN** : les IBAN déjà chiffrés deviendraient illisibles.

## 3. Coûts et limites (offre gratuite Netlify, novembre 2026)

- Netlify Database fonctionne avec les offres « à crédits » (dont l'offre gratuite). La base se met en veille
  après 5 min sans visite et se réveille à la visite suivante (quelques secondes).
- Offre gratuite : 48 « unités de calcul » par mois (≈ 48 h de base active), 5 Go de données.
  Au-delà, ou pour une vraie boutique avec du trafic, passez à l'offre **Personal** (sans limite de calcul).
- Médias : photos jusqu'à 15 Mo (converties en WebP), vidéos MP4/WebM jusqu'à 18 Mo
  (limite de taille des réponses Netlify).

## 4. Stripe (plus tard)

1. https://dashboard.stripe.com → **Developers → API keys** → clé secrète → variable `STRIPE_SECRET_KEY`.
2. **Developers → Webhooks → Add endpoint** : `https://<votre-site>/api/stripe/webhook`, événements
   `checkout.session.completed`, `checkout.session.async_payment_succeeded`,
   `checkout.session.async_payment_failed`, `checkout.session.expired` → « Signing secret » dans `STRIPE_WEBHOOK_SECRET`.
3. **Settings → Payment methods** : Cartes + **Apple Pay** ; **Payment method domains** : ajoutez votre domaine.
4. Redéployez. Testez en mode test (`sk_test_…`, carte `4242 4242 4242 4242`) avant les clés live.

Sans Stripe, la commande en ligne est désactivée avec un message clair ; le virement reste « Bientôt disponible ».

## 5. E-mails

`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`. Sans eux, les e-mails sont journalisés
dans Admin → E-mails envoyés mais pas envoyés.

## 6. Sécurité

- Admin : sessions signées (cookie httpOnly), mots de passe bcrypt, limitation des tentatives, rôles, journal d'audit.
- Base : jamais exposée publiquement ; seul le serveur du site s'y connecte.
- Médias : envoi autorisé uniquement aux administrateurs, par morceaux signés ; type réel du fichier vérifié ;
  justificatifs comptables dans un stockage privé, lisibles seulement par l'admin.
- Prix et remises recalculés côté serveur ; webhook Stripe vérifié (signature + montant) ;
  aucune donnée de carte sur le site ; IBAN chiffrés.
