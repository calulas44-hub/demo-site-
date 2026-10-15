# ☀️ MIMO — Coffee shop · Aix-en-Provence · site vitrine + commande + espace gérant

Site commercial complet pour **Mimo** (coffee shop de Chloé, **62 rue Boulegon, 13100 Aix-en-Provence**, Instagram
[@mimo.aix](https://www.instagram.com/mimo.aix/)) : page d'accueil éditoriale, carte officielle
avec les vrais prix, commande à table par QR code ou à emporter, suivi en direct, et **toutes les
fonctions de l'espace gérant de Mozaïk Coffee**.

Projet **distinct** (dossier `mimo/`) : Mozaïk et MYKONOS ne sont pas modifiés.

| Adresse | Rôle |
|---|---|
| `mimo/index.html` | Site client (QR de table : `index.html?table=1`, `?table=T1`…) |
| `mimo/admin.html` | Espace gérant — **code par défaut : `6466`** (M‑I‑M‑O sur un clavier de téléphone, à changer dans Réglages) |
| `mimo/mentions-legales.html` | Mentions légales (alimentées par Réglages → Mentions légales) |
| `mimo/confidentialite.html` | Politique de confidentialité (RGPD) |

---

## 1. Ce qui a été analysé (sources)

| Source | Ce qu'on en tire |
|---|---|
| **PDF fourni** (`IMG_8049.pdf`) : photo de la carte + 5 stories « Carte » de @mimo.aix | Carte complète et prix (lus ligne par ligne, recadrages à l'appui), logo « M » moutarde, mascotte cookie au trait, carreaux jaunes du comptoir, plateaux inox, verres en couches, « Open 10‑18h ». Les 5 photos de stories servent de visuels du site. |
| [Love Spots Aix](https://aix-en-provence.love-spots.com/en/spots/eating-out/cafe-en/30126-mimo.html) (6 oct. 2026) | Chloé, façade jaune, « réconfortant, sans chichis, gourmand », **mer.–lun. 10h–18h, fermé le mardi**, prix (espresso 2 €, latte 5,50 €, matcha 6 €, gâteaux 3,50 €) cohérents avec la carte. |
| [societe.com](https://www.societe.com/societe/mimo-103217048.html) (RNE / Insee, 13/10/2026) | **MIMO**, SARL au capital de 5 000 €, SIRET 103 217 048 00018, TVA FR93103217048, siège **62 rue Boulegon, 13100 Aix-en-Provence**, gérante Chloé Serre, immatriculée le 2 avril 2026, activité « coffee shop… sur place et à emporter ». |
| Instagram @mimo.aix | **Non consultable depuis l'outil** (accès bloqué). Rien n'a été inventé à sa place. |
| [Sunbeam Bagels](https://sunbeambagels.com/) | Niveau de conception uniquement (voir §3). Aucun logo, texte, graphisme ni photo repris. |

Adresse confirmée par le créateur du site et le registre : **62 rue Boulegon** (Love Spots indiquait une autre adresse, remplacée automatiquement si elle avait déjà été enregistrée).

## 2. Direction artistique

- **Couleurs du lieu** : jaune carreaux / façade `#f6c33b`, moutarde du logo `#d99a1b`,
  espresso `#2b1d14` (textes), crème `#fff9ec` (murs blancs), vert matcha, rose fruit, inox.
- **Motif signature** : carreaux jaunes à joints blancs (le comptoir de Mimo) en fond de
  sections, sur les affiches QR, l'image de partage et l'écran de connexion.
- **Typographies** : *Fraunces* (titres doux et gourmands) + *Montserrat* (la police de la
  carte de Mimo). **Hébergées sur le site** (licence SIL OFL) : aucun appel à Google Fonts.
- **Éléments propres à Mimo** : le « M » moutarde (redessiné en SVG), la mascotte cookie au
  trait (clin d'œil à la carte), les étiquettes courbes des stories conservées sur les photos,
  les plateaux en inox dans les illustrations de secours.
- **Ton** : chaleureux, gourmand, simple — et factuel : chaque texte s'appuie sur la carte ou
  sur une source publique.

## 3. Ce qui a été retenu de Sunbeam (sans copier)

| Principe Sunbeam | Traduction Mimo |
|---|---|
| Héros immersif, typographie géante | « Matcha. Latte. Cookie. » en 3 couleurs de boissons + photos réelles en arche |
| Bandeau horaires en haut | Bandeau « Ouvert aujourd'hui jusqu'à 18h · Mer–Lun 10h–18h » **en direct** |
| Listes d'ingrédients qui défilent | Bandeau défilant des **ingrédients de la carte** (vanille de Madagascar, fleur de sel…) |
| Catégories éditoriales alternées photo / texte | « Chapitres » de la carte (Les classiques, Coffee, Matcha, Gâteaux), éditables |
| Galerie / mur de photos, réseaux sociaux | « Univers Mimo » : mosaïque cliquable des stories + lien Instagram |
| CTA visibles, infos pratiques, appel final | Boutons jaunes « Commander », infos (adresse, horaires du jour en surbrillance), bloc final carrelé |
| Stickers ludiques | Pastille tournante « Gâteaux faits maison » + mascotte cookie (dessin original) |

## 4. Page d'accueil (ordre demandé)

1. **Héros** — titre, texte, Commander / Découvrir la carte, ouvert/fermé en direct, adresse.
2. **Les incontournables** — 7 produits mis en avant (★ dans l'admin), tous avec une vraie photo.
3. **La carte** — offres (si activées) → 4 chapitres éditoriaux → **carte complète** commandable
   (recherche, catégories collantes, personnalisation) → photo de la carte officielle.
4. **L'expérience Mimo** — « Derrière la façade jaune », 4 points forts, commander à table en
   4 étapes, bloc actualité facultatif.
5. **Univers Mimo** — galerie éditoriale (agrandissement au clic, défilement horizontal sur mobile).
6. **Infos pratiques** — adresse + itinéraire, horaires (jour en cours surligné), contact.
7. **Appel final** — « Un matcha vous attend. » + Commander / Itinéraire.

Tous les textes de ces sections se modifient dans **Admin → Contenus du site** et **Catégories → ✏️ Chapitre**.

## 5. La carte (photo fournie)

| Catégorie | Produits & prix |
|---|---|
| Les classiques | Espresso 2 € · Double espresso 2,50 € · Americano 3 € · Cappuccino 4 € · Flat White 4,50 € · Latte / Ice Latte 4,50 € (chaud ou glacé) |
| Coffee | Vanilla Cloud, Sea Salt Honey, Raspberry, Pistachio, Peanut Butter, Banana Bread Latte — 5,50 € |
| Matcha | Matcha Vanilla Cloud, Mango, Strawberry, Banana, Peach, Matcha Coco Cloud — 6 € |
| Sans café | Citronnade du moment maison 3 € · Jus frais maison 3 € · Chocolat chaud 4,50 € · Chai, Hojicha, Ube, Golden, Black Sesame Latte 5 € |
| Gâteaux (« tous faits maison ») | Cookie chocolat noir/fleur de sel, Cookie matcha/chocolat blanc, Marbré, Banana bread, Carrot cake, Brownie sans gluten — 3,50 € · **Cookie sans gluten** et **Gâteau du jour** : « voir ardoise », **sans prix** → visibles, non commandables |
| Options | Lait amande / avoine / coco **sans supplément** · Sirop **+0,50 €** · Extra shot **+0,50 €** |

Hors carte : **Cold Brew** (vu en story, absent de la carte) → présent mais **masqué**, sans prix.
Les descriptions reprennent mot pour mot celles de la carte ; sans description sur la carte, rien n'est ajouté.

## 6. Inventaire des fonctionnalités Mozaïk → Mimo

Inventaire établi en relisant le code de Mozaïk (`client.js`, `admin.js`, `data.js`,
`firebase-sync.js`, `admin-i18n.js`, CSS). Chaque ligne a été **testée** sur Mimo (§10).

**Côté client**

| Fonction Mozaïk | Mimo |
|---|---|
| QR code de table (`?table=` / `?t=`), table mémorisée 4 h, pastille + bandeau, changer / « pas à table », table reconnue même si la carte se synchronise après | ✅ identique |
| Arrivée par QR sur mobile → défilement direct vers la carte | ✅ |
| Annonce + bandeau défilant éditables | ✅ (bandeau = ingrédients de la carte) |
| Héros éditable (accroche, titre, texte, image remplaçable), ouvert/fermé en direct, adresse | ✅ + titre multicolore, pastille, bandeau horaires |
| Promesses (4) | ✅ « points forts » dans l'Expérience |
| Offre étudiante, fidélité −10 % 24 h après la 1ʳᵉ commande | ✅ conservées **mais désactivées par défaut** (Mimo n'annonce aucune offre) |
| Rail des produits mis en avant | ✅ « Les incontournables » |
| Carte : recherche sans accents, catégories collantes + suivi au défilement, fiches (photo ou illustration, épuisé, quantité au panier, étiquettes, prix ou « au comptoir »), recherche vide | ✅ |
| Photo de la carte officielle en grand | ✅ (carte de Mimo) |
| Personnalisation : options simples / multiples, obligatoires contrôlées, suppléments, choix indisponibles, quantité 1–30, prix en direct | ✅ (options réelles de Mimo) |
| Panier : fusion des lignes identiques, +/−, suppression, prix resynchronisés avec la carte, retrait auto des produits devenus indisponibles | ✅ |
| Suggestions après ajout (2 max par visite) et dans le panier, ajout en 1 clic, ouverture de la fiche si option obligatoire | ✅ règles Mimo (matcha → cookie matcha, boisson → gâteau, gâteau → boisson) |
| Validation : sur place / à emporter (/ livraison si activée), table, prénom, contact, adresse si livraison, précision, **une** réduction (étudiant / fidélité / code promo), paiement sur place, paiement en ligne « Bientôt », récapitulatif, coordonnées mémorisées | ✅ (le bloc réduction se masque s'il n'y en a aucune) |
| N° de commande unique entre appareils, accusé « transmise au comptoir » / « connexion difficile » | ✅ |
| Confirmation + suivi en direct (Reçue → En préparation → Prête → Servie / Annulée), pastille de suivi 6 h, alerte « prête » + vibration | ✅ |
| Compte client (création, connexion par e-mail, mon espace, mes commandes, déconnexion), newsletter facultative | ✅ (fonctionne aussi sans fidélité) |
| E-mails de confirmation client + gérant (EmailJS) | ✅ |
| Horaires : ouvert/fermé, bandeau fermé, commandes en pause, commandes limitées aux horaires | ✅ |
| Infos : adresse + itinéraire, horaires (jour surligné), contact, pied de page | ✅ |
| Mise à jour en direct quand l'admin modifie la carte / les contenus, synchro entre onglets | ✅ |

**Côté gérant** — toutes les sections de Mozaïk sont présentes :
connexion par code haché (SHA‑256) + blocage 30 s après 5 essais · tableau de bord (CA du jour,
panier moyen, encaissé, reste à encaisser, commandes en cours, ventes par produit, **À compléter**
propre à Mimo) · commandes en direct (clochette, notification, titre clignotant, badge, filtres,
recherche, étapes en 1 clic, encaisser CB TPE / espèces / titre‑restaurant / autre, rembourser
total ou partiel, annuler avec motif, bon de préparation imprimable, ticket PDF) · historique
(périodes, recherche, filtres statut / paiement / mode / table, exports CSV commandes et articles) ·
produits (créer, modifier, dupliquer, masquer, épuisé, prix vide = au comptoir, photo
redimensionnée stockée à part, illustration, ★ incontournable, ordre) · catégories (+ **chapitre
éditorial**) · options & suppléments (groupes, choix, prix, obligatoire, ajout/retrait sur toute une
catégorie) · suggestions (règles, ordre, message, défaut, aperçu) · tables & QR (affiche A6 aux
couleurs de Mimo, PNG, impression 4/A4, QR général, adresse du site — jamais l'admin) · offres &
codes promo (%, €, minimum, expiration, utilisations) · clients & newsletter (+ CSV) ·
comptabilité (CA TTC/HT/TVA net des remboursements, annulations, remboursements, encaissements
par moyen de paiement, par jour/mois, par mode, meilleures ventes, exports) · tickets de caisse
(PDF, journal PDF, CSV) · contenus du site · réglages (établissement, horaires, pause, modes,
code, TVA, e‑mails, sauvegarde / import / réinitialisation) · synchro temps réel + son.
**Retiré à la demande** : l'interface en turc de Mozaïk (sans objet pour Mimo).

**Adaptations (et pourquoi)** : la section « café turc sur sable » et les « ateliers » de Mozaïk
étaient des contenus propres à Mozaïk ; chez Mimo, la même mécanique de contenus éditables sert
« L'expérience Mimo » et un bloc **Actualité** facultatif (masqué tant qu'il est vide).
L'affiche Büşra & Fatih est remplacée par les photos de Mimo.
**Ajouts Mimo** : chapitres éditoriaux, galerie, appel final, mentions légales et
confidentialité éditables, données structurées (référencement local), image de partage.

## 7. À faire valider par Mimo (rien n'a été inventé)

1. **Horaires** (Love Spots : mer.–lun. 10h–18h, fermé le mardi). → Admin → Réglages, puis « C'est vérifié ».
2. **Prix** du cookie sans gluten et du gâteau du jour (« voir ardoise ») ; **Cold Brew** proposé ou non, et à quel prix.
3. **Parfums de sirop** (la carte indique seulement « Sirops +0,5 ») ; latte signature / matcha
   servis aussi chauds ? (seul le latte est indiqué chaud ou glacé).
4. **Logo officiel** (fichier SVG/PNG) et **mascotte** officielle : les versions actuelles sont redessinées.
5. **Photos** : celles du site viennent des stories @mimo.aix (basse définition, étiquettes
   incrustées). Autorisation d'usage + photos HD (façade jaune, salle, comptoir, Chloé si elle le souhaite).
   La photo de la carte a été repostée par un autre compte (studio_mld_) : fournir une photo / un PDF propre de la carte.
6. **Textes** : prénom « Chloé » cité (source publique), service à table (la vente sur place et à emporter figure dans l'activité déclarée au RNE).
7. **Nombre de tables** (4 en salle + 2 en terrasse par défaut ; Love Spots mentionne une terrasse).
8. **Téléphone / e‑mail** publics, **e‑mail qui reçoit les commandes** (actuellement celui du créateur du site).
9. **Mentions légales** : identité de la société remplie d'après le registre (societe.com). Restent
   l'**e‑mail de contact** (obligatoire) et le **médiateur de la consommation** (Admin → Réglages → Mentions légales).
   Durées de conservation RGPD proposées à confirmer.
10. **Offres** : aucune (étudiant / fidélité désactivés, aucun code promo). À activer seulement si Mimo le décide.
11. **Allergènes** : liste à préparer (le site renvoie vers le comptoir).
12. **Code d'accès** `6466` à changer.

## 8. Données, dépendances, coûts

- Firebase Realtime Database : **même projet que MYKONOS/Mozaïk (offre gratuite)**, tout sous
  `mimo/` (`config/catalog`, `orders`, `media`, `meta/orderSeq`, `customers`, `newsletter`).
  Pour un client payant : projet Firebase **dédié** recommandé + `".indexOn": ["createdAt"]` sur `mimo/orders`.
- EmailJS (offre gratuite, compte partagé), Netlify (offre gratuite). QR codes et PDF : bibliothèques
  libres incluses (`js/vendor/`). Polices : fichiers libres inclus (`fonts/`).
- **Aucune dépendance payante ni abonnement ajouté.** Le paiement en ligne (Stripe) reste
  « Bientôt » : il demanderait un compte Stripe et un petit serveur (frais par transaction).
- Sans Firebase, le site fonctionne en local (même appareil).

## 9. Sécurité, référencement, performance

- **Sécurité** : code haché, blocage après 5 essais, admin en `noindex` et exclu de `robots.txt`.
  Limite connue (comme Mozaïk) : un site statique ne protège pas réellement la base ; la prochaine
  étape est **Firebase Authentication + règles de sécurité**.
- **SEO local** : titre/description « coffee shop Aix-en-Provence », `h1` explicite, données
  structurées `CafeOrCoffeeShop` (adresse, horaires mis à jour depuis l'admin, Instagram),
  balises géographiques, Open Graph + Twitter (image `assets/og-mimo.jpg` 1200×630), favicon et icône iPhone.
  Après mise en ligne : remplacer les chemins d'image de partage par l'**URL absolue** du site,
  ajouter une balise `canonical` et créer/compléter la fiche **Google Business Profile**.
- **Performance** : images WebP recadrées (5–90 Ko), image du héros préchargée, le reste en
  chargement différé, polices locales préchargées, animations désactivées si « réduire les animations ».
- **Accessibilité** : lien d'évitement, textes alternatifs, contrastes (texte espresso sur jaune), navigation clavier.

## 10. Tests réalisés

Parcours automatisé (Playwright, base temps réel simulée, 4 téléphones + comptoir) — **85 vérifications OK** :
connexion (bon/mauvais code), amorçage sous `mimo/` uniquement, liste « À compléter », prix saisi →
visible client, code promo + offre étudiante activés, QR table 4, sections de l'accueil, données
structurées, produits « voir ardoise » non commandables, Cold Brew masqué, options et prix en direct
(2 × 6,50 = 13,00 € ; 4,50 + 0,50 = 5,00 €), suggestions, option obligatoire, panier 21,50 €,
étudiant −10 % → 19,35 €, commande #1001 reçue en direct avec options, suivi préparation/prête,
encaissement, 2ᵉ appareil #1002 (code promo 5,40 €) puis annulation, 3ᵉ appareil terrasse :
encaissement + remboursement partiel, comptabilité au centime (CA 20,35 €, panier moyen 10,18 €,
CB 19,35 € / espèces 1,00 €), tickets, historique et filtres, contenus/chapitres/catégories/épuisé en
direct, 6 QR codes vers l'espace client, aperçu des suggestions, mes commandes, photo produit
stockée à part, pause des commandes, mentions légales (registre) alimentées par l'admin, adresse rue Boulegon,
16 ancres internes et fichiers (pages légales, images, robots) valides. Captures mobile (390 px) et bureau (1440 px) vérifiées.

## 🚀 Déploiement

Site statique. Sur Netlify : nouveau site depuis ce dépôt, **dossier de publication `mimo`**
(ou servir `/mimo/`). Puis Admin → Tables & QR codes : vérifier l'adresse du site et imprimer les QR.
