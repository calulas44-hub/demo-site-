# Architecture technique de Luxury Scent

## Choix de la pile

| Couche | Choix | Pourquoi |
|---|---|---|
| Application | **Next.js 15** (App Router, TypeScript, React 19) | Rendu serveur pour le référencement et la vitesse, API et actions serveur dans le même déploiement, écosystème mature. |
| Base de données | **Prisma** + **SQLite** en développement, **PostgreSQL** en production | Un seul schéma, migrations versionnées, bascule par variable d'environnement et une ligne du schéma. |
| Paiement | **Stripe Checkout** (page hébergée) + **virement bancaire** | Aucun numéro de carte ne transite par nos serveurs. Le virement utilise l'IBAN actif géré dans l'administration. |
| E-mails | **Nodemailer** (SMTP) | Fonctionne avec n'importe quel fournisseur (OVH, Gmail pro, Brevo, Mailgun…). |
| Images | **sharp** | Redimensionnement et conversion WebP au téléversement. |
| Documents | **pdfkit** (factures et avoirs PDF), **exceljs** (exports Excel) | Bibliothèques pures JavaScript, sans dépendance système. |
| Sécurité | **bcrypt** (mots de passe), **jose** (sessions signées), **AES-256-GCM** (IBAN) | Standards éprouvés. |

## Organisation du code

```
luxury-scent/
├── prisma/            schéma, migrations, données de démonstration (seed)
├── src/
│   ├── app/
│   │   ├── (boutique)/   site public : accueil, catalogue, produit, panier, commande, compte
│   │   ├── admin/        espace administrateur (protégé)
│   │   ├── api/          routes API (paiement, webhooks, uploads, recherche)
│   │   └── uploads/      diffusion des fichiers téléversés
│   ├── components/    composants React (boutique et admin)
│   ├── lib/           accès aux données, auth, paiement, e-mails, PDF, comptabilité
│   └── styles/        feuilles de style globales
├── scripts/           création d'admin, sauvegarde
├── tests/             tests fonctionnels (API et navigateur)
├── storage/           (ignoré par git) base SQLite et fichiers téléversés
└── docs/              analyse, architecture, déploiement
```

Séparation des responsabilités :

- **Frontend** : `src/app/(boutique)` et `src/components/shop`. Ne touche
  jamais à la base directement : passe par `src/lib/*`.
- **Backend** : `src/lib` (logique métier), `src/app/api` (routes HTTP) et les
  actions serveur des pages admin. Toute écriture passe par Prisma avec
  validation **zod**.
- **Base de données** : `prisma/schema.prisma`, migrations dans
  `prisma/migrations`.

## Modèle de données (résumé)

- **Catalogue** : `Brand`, `Category` (arborescente), `Collection` (univers
  éditorial), `Product`, `ProductVariant` (contenance, prix, prix promo,
  coût, stock), `ProductImage`, `Media`.
- **Contenu** : `HomeSection` (blocs de la page d'accueil, ordonnables),
  `Announcement` (bandeau), `Page` (CGV, mentions légales…), `MenuItem`,
  `Setting` (paramètres généraux en JSON).
- **Commerce** : `Customer`, `Address`, `ShippingMethod`, `Order`,
  `OrderItem`, `OrderStatusHistory`, `Invoice`, `CreditNote`, `Refund`.
- **Finances** : `Expense` (achats et frais), `LedgerEntry` (journal
  interne de gestion), `BankAccount` (chiffré) + `BankAccountAudit`.
- **Administration** : `AdminUser` (rôles OWNER / ADMIN / STAFF),
  `AdminAuditLog`, `EmailLog`, `Counter` (numérotation).

Tous les montants sont stockés en **centimes**. Les prix du catalogue sont
**TTC** ; le HT et la TVA sont calculés avec le taux global (paramètre) ou
le taux propre au produit.

## Sécurité

- Sessions dans un cookie `HttpOnly`, `SameSite=Lax`, `Secure` en
  production, signé avec `SESSION_SECRET`, durée limitée, invalidation par
  `tokenVersion`.
- Mots de passe hachés avec bcrypt (coût 12).
- Coordonnées bancaires chiffrées en AES-256-GCM avec `BANK_ENCRYPTION_KEY`,
  affichées masquées, modification réservée au rôle OWNER avec confirmation
  du mot de passe, chaque action tracée dans `BankAccountAudit`.
- Téléversements : types MIME vérifiés, images ré-encodées par sharp,
  noms de fichiers générés aléatoirement.
- Entêtes de sécurité (`X-Frame-Options`, `nosniff`, `Referrer-Policy`).
- Validation zod de toutes les entrées, requêtes paramétrées par Prisma.
- Limitation des tentatives de connexion (admin et clients).

## Flux de commande

1. Panier côté client (cookie), validé côté serveur à chaque étape.
2. Commande : coordonnées, adresses, mode de livraison, méthode de paiement.
3. Création de la commande `PENDING_PAYMENT` et décrément des stocks.
4. Paiement : **carte** (redirection vers Stripe Checkout, confirmation par
   webhook) ou **virement** (instructions avec l'IBAN actif, validation
   manuelle dans l'administration).
5. Passage à `PAID` : génération de la facture, écritures du journal,
   e-mail de confirmation.
6. Préparation, expédition (numéro de suivi), livraison ; remboursements et
   avoirs depuis l'administration.

## Sauvegardes

`npm run backup` crée une archive datée de la base et des fichiers
téléversés dans `backups/`. En production, planifier ce script (cron) et
copier les archives hors du serveur. Voir `docs/03-deploiement.md`.
