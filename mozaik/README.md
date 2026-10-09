# ☕ MOZAÏK — Bio Coffee Shop · site de commande + espace gérant

Site commercial complet pour **Mozaïk Coffee** (35 rue Boulegon, Aix-en-Provence) :
commande à table par QR code, carte officielle, personnalisation, suggestions,
suivi en direct, et espace gérant (commandes, carte, tables, comptabilité).

Projet **distinct** du site MYKONOS (dossier `mozaik/`, aucune modification du
site existant). Il reprend le fonctionnement de MYKONOS (site statique, données
en localStorage + synchronisation temps réel Firebase, e-mails EmailJS, QR code,
tickets PDF…) et l'adapte à l'identité, à la carte et au service de Mozaïk.

| Adresse | Rôle |
|---|---|
| `mozaik/index.html` | Site client (QR de table : `index.html?table=4`) |
| `mozaik/admin.html` | Espace gérant — **code par défaut : `3513`** (à changer dans Réglages) |

## 📁 Structure

```
mozaik/
  index.html, admin.html, robots.txt
  css/mozaik.css          → identité Mozaïk (crème, vert, sauge, touches d'Iznik), mobile d'abord
  js/visuals.js           → logo (gâteau damier + cerise) et illustrations des boissons en SVG
  js/data.js              → carte officielle, options, suggestions, tables, contenus, calculs & comptabilité
  js/firebase-config.js   → projet Firebase (celui de MYKONOS, données rangées sous « mozaik/ »)
  js/firebase-sync.js     → temps réel : commandes, suivi, n° uniques, carte, photos, clients
  js/client.js            → parcours client
  js/admin.js             → espace gérant
  js/vendor/              → qrcode.min.js, jspdf.min.js (copiés de MYKONOS)
  assets/                 → affiche Büşra & Fatih, détail café turc, photo de la carte, image de partage
```

## 🛒 Côté client

- **QR code de table** → la carte s'ouvre directement, la table est identifiée
  (en-tête, bandeau, validation, commande, ticket). Mémorisée 4 h, modifiable.
- **Carte officielle** (photo « Menu Boissons ») : 55 boissons aux prix affichés en
  boutique, 9 catégories, recherche, navigation par catégorie, « Signatures » mises en avant.
- **Personnalisation** selon les options réellement à la carte : chaud/froid
  (lattes signatures), parfum du café turc (+0,50 €), lait végétal avoine/amande
  (+0,50 €), sirop BIO (+0,50 €), extra espresso BIO (+1 €), oralet orange/kiwi.
  Options obligatoires contrôlées, prix recalculé en direct.
- **Panier** : quantités, suppression, fusion des lignes identiques, total automatique,
  prix toujours resynchronisés avec la carte (un prix modifié par l'admin s'applique).
- **Suggestions complémentaires** (règles gérées dans l'admin) : après un ajout
  (« Le café turc se savoure avec une douceur… ») et dans le panier, ajout en 1 clic.
- **Validation** : sur place / à emporter (+ livraison si activée), table, prénom,
  contact, précision ; **une** réduction : −10 % étudiants (carte à présenter),
  fidélité −10 % (compte), ou code promo ; paiement sur place (en ligne « bientôt »,
  comme MYKONOS : aucun paiement n'est simulé).
- **Confirmation** avec n° unique, accusé de réception du comptoir, **suivi en direct**
  (Reçue → En préparation → Prête → Servie, annulation), pastille de suivi, « Mes commandes ».
- **Compte & fidélité** (repris de MYKONOS) : −10 % sur la commande suivante, 24 h
  après la 1ʳᵉ commande, newsletter facultative, e-mails de confirmation (EmailJS).
- Contenus de marque : affiche de **Büşra & Fatih**, café turc dans le sable,
  histoire, ateliers (céramique, crochet, langues, No Phone Night), horaires en direct
  « Ouvert / Fermé », photo de la carte officielle.

## 🔐 Côté gérant

| Section | Ce qu'on y fait |
|---|---|
| Tableau de bord | CA du jour, panier moyen, encaissé, reste à encaisser, commandes en cours, « À compléter » |
| Commandes en cours | Réception **en direct** (clochette + notification), table, options, note, réduction étudiante à vérifier ; étapes en 1 clic, **encaisser** (CB TPE, espèces, titre-restaurant…), **rembourser** (total/partiel), **annuler**, bon imprimable, ticket PDF |
| Historique | Toute période, recherche (n°, client, téléphone, produit), filtres statut / paiement / mode / table, exports CSV commandes & articles |
| Produits | Créer, modifier, dupliquer, masquer, rendre indisponible ; prix (vide = « au comptoir »), description, étiquettes, options, **photo**, illustration, signature |
| Catégories | Nom, description, ordre, icône, affichage |
| Options & suppléments | Groupes, choix, prix des suppléments, obligatoire, disponibilité ; ajout à toute une catégorie |
| Suggestions panier | Règles (catégories / produits déclencheurs → produits proposés), ordre, message, aperçu |
| Tables & QR codes | Tables (nom, zone, actif), **QR par table** (affiche A6 avec l'illustration), PNG, impression 4/A4, QR général |
| Offres & codes promo | −10 % étudiants, fidélité, codes (%, €, minimum, expiration, utilisations) |
| Clients / Newsletter | Comptes, fidélité, exports CSV |
| Comptabilité | CA TTC/HT/TVA **net des remboursements**, commandes, panier moyen, encaissé net, reste à encaisser, remises, **annulations** et **remboursements**, répartition par moyen de paiement, par jour/mois, par mode, meilleures ventes, exports |
| Tickets de caisse | Liste par période (HT/TVA/TTC), ticket PDF, journal PDF, CSV |
| Contenus du site | Annonce, bandeau, accueil, affiche, promesses, café turc, histoire, ateliers |
| Réglages | Établissement, horaires, pause des commandes, modes, code d'accès, TVA, e-mails, sauvegarde/import |

**🇹🇷 Interface en turc** : bouton « Türkçe » (écran de connexion et barre du haut).
Toute l'interface du gérant passe en turc : menus, boutons, tableaux, messages,
confirmations, bon de préparation imprimé. Le choix est mémorisé sur l'appareil.
Les données ne changent pas (statuts et paiements enregistrés à l'identique) ; la
carte, les contenus et le site client restent en français ; tickets PDF et exports
CSV restent en français (comptabilité). Traductions : `js/admin-i18n.js`.

**Règles comptables** : une commande annulée sort du CA ; un remboursement est
déduit du CA de la commande et des encaissements du jour où il est fait ; les
encaissements sont datés du jour du paiement. Les mêmes fonctions de calcul
(`js/data.js`) servent au client, à l'admin et aux exports.

## ⚠️ À compléter (informations non publiées)

Instagram n'était pas consultable depuis l'outil de construction. Les informations
viennent de la photo de la carte, d'articles (Made in Marseille, 30/08/2026) et de
fiches publiques (bio Instagram, Google). Restent **à compléter dans l'admin** :

1. **Prix des pâtisseries** (baklava pistache, künefe, pâtisserie du jour) : affichées
   « Disponible au comptoir », non commandables et jamais suggérées tant qu'il n'y a pas de prix.
2. **Brunch & salé** (annoncé sur Instagram) : catégorie prête mais masquée, sans produit.
3. **Photos des produits** : des illustrations aux couleurs de chaque boisson s'affichent en attendant.
4. **E-mail de contact** ; **téléphone (07 51 29 07 30) et horaires** issus des fiches publiques, à vérifier.
5. Prénom du gérant : les sources publiques écrivent **Fatih** (modifiable dans Contenus).

## 🔄 Données & synchronisation

- Firebase Realtime Database : même projet que MYKONOS, tout sous **`mozaik/`**
  (`config/catalog`, `orders`, `media`, `meta/orderSeq`, `customers`, `newsletter`).
- Les règles de la base doivent autoriser la lecture/écriture de `mozaik/` comme
  pour MYKONOS. Pensez à ajouter `".indexOn": ["createdAt"]` sur `mozaik/orders`
  pour accélérer l'historique et la comptabilité.
- Sans Firebase, le site fonctionne en local (même appareil / navigateur).

## 🛡️ Sécurité — à savoir

Le code gérant n'est plus stocké en clair (empreinte SHA-256) et l'écran se bloque
après 5 essais. Mais, comme pour MYKONOS, un site statique ne peut pas protéger
réellement la base : la vraie sécurisation passe par **Firebase Authentication +
règles de sécurité** (écriture de la carte réservée au gérant, lecture des
commandes limitée). C'est la prochaine étape recommandée avant une forte affluence.

## 🚀 Déploiement

Site statique : publiez le dépôt (Netlify, GitHub Pages…). Le site Mozaïk est
servi sous `/mozaik/`. Dans **Admin → Tables & QR codes**, vérifiez l'adresse du
site puis imprimez les QR codes des tables.

## ✅ Tests réalisés

Parcours automatisé (Playwright) entre 4 téléphones et le comptoir, avec une base
temps réel simulée : scan QR → carte → options → suggestions → panier → réduction
étudiante → commande → réception admin → préparation / prête / servie en direct →
encaissement → annulation → remboursement partiel → comptabilité, tickets,
historique, QR codes, photo, pause des commandes. Montants vérifiés au centime.
