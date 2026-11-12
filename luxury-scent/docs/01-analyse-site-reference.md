# Analyse du site de référence (Maison Francis Kurkdjian, eu-fr)

Date : 11 novembre 2026. Pages étudiées : accueil, catégorie « Parfums Femme »,
fiche produit (eau de parfum, 4 formats), page collection, résultats de recherche.

**Méthode et limites.** Le site refuse les navigateurs automatisés (réponse
403 « Access Denied » à Chromium piloté par CDP). REA n'a donc pas pu
l'inspecter en direct, et cette protection n'a pas été contournée. La structure
a été obtenue par Firecrawl (contenu HTML converti, liens, charte détectée).
Les animations, transitions et comportements JavaScript n'ont pas pu être
observés : ils sont décrits ci-dessous d'après les motifs standard du
e-commerce de luxe et la structure du DOM, et sont donc à considérer comme
des choix de conception pour Luxury Scent, pas comme un relevé exact.

Ce document décrit l'**organisation** et les **fonctionnalités**. Aucun texte,
photographie, logo ou code du site n'est réutilisé.

## 1. Plateforme et architecture

- Plateforme : Salesforce Commerce Cloud (URL `/on/demandware.store/...`).
  Pages servies côté serveur, enrichies en JavaScript.
- URL par marché (`/eu-fr/`), devise affichée dans l'en-tête, bandeau de
  redirection selon la localisation détectée.
- Types de pages : accueil, catégorie (`/parfums/parfums-femme/`), page
  collection éditoriale (`/collection-x/landing-X.html`), fiche produit
  (`/p/nom-REF.html`), recherche, panier, connexion / compte, pages
  institutionnelles (histoire, notes, engagements), pages légales (CGV,
  confidentialité, cookies, livraison et retours), FAQ, contact, localisateur
  de boutiques, programme de fidélité, suivi de commande sans compte.

## 2. En-tête et navigation

- Barre supérieure : messages promotionnels défilants (4 messages).
- En-tête : logo centré, menu principal à gauche, icônes à droite
  (recherche, favoris, compte, panier avec compteur).
- Menu principal : **Idées cadeaux**, **Collections**, **Parfums**,
  **Bain & Corps**, **Art de vivre**, **La Maison**, **Contact**.
- Chaque entrée ouvre un **méga-menu** : colonne de liens (sous-catégories)
  + 2 visuels promotionnels cliquables. Sur mobile : menu plein écran avec
  accordéons (« Ouvrir le menu / Fermer le menu »).
- Recherche : panneau qui s'ouvre sur toute la largeur, avec suggestions
  avant saisie (4 vignettes de catégories, 3 produits « iconiques », lien
  vers la Maison), puis résultats en direct.
- Panier : **tiroir latéral** (« mini-panier ») avec articles, rappel des
  avantages (livraison, échantillons, attention), total TTC hors livraison,
  boutons « Voir mon panier » / « Continuer mes achats », et bloc
  « Vous aimerez également ».
- Compte : panneau avec « Connexion / Créer un compte », rappel du programme
  de fidélité, suivi de commande (numéro + e-mail + code postal).

## 3. Page d'accueil (ordre des sections)

1. Bandeau d'annonces défilant.
2. **Carrousel héro** plein écran (3 diapositives : titre, sous-titre,
   bouton), flèches + indicateurs.
3. Onglets **Parfum / Bain & Corps / Tendances** : carrousel de produits avec
   bouton « Ajouter au panier » directement sur la carte.
4. **Grille éditoriale** « sélection festive » : 4 vignettes (cadeaux pour
   elle, pour lui, nouveautés, calendrier).
5. Carrousel **Édition limitée**.
6. Blocs « collections » et contenus de marque (histoire, savoir-faire).
7. **Réassurance** : livraison offerte, conseiller, paiement sécurisé,
   écrin offert, échantillons.
8. Pied de page : inscription newsletter, colonnes de liens (aide,
   la Maison, légal), réseaux sociaux, sélecteur de pays, mentions.

## 4. Carte produit (grille et carrousels)

- Image carrée sur fond blanc ; **seconde image au survol**.
- Badge en haut à gauche (« Nouveauté », « Édition limitée »,
  « Exclusivité en ligne »).
- Icône « Ajouter aux favoris » en haut à droite.
- Nom sur deux niveaux (nom de la ligne + type : eau de parfum, extrait…),
  contenance, prix (ou « À partir de » si plusieurs formats).
- **Facettes olfactives** sous le prix (ex. Florale · Ambrée · Boisée).
- Bouton « Ajouter au panier » qui apparaît au survol ; « Prévenez-moi » si
  rupture.

## 5. Page catégorie

- Fil d'Ariane, visuel d'en-tête, titre H1, paragraphe SEO.
- Barre d'outils : bouton **Filtres** (panneau latéral), compteur de
  résultats, tri.
- **Carrousel de collections** (vignettes rondes) au-dessus de la grille
  pour filtrer par ligne de parfum.
- Grille 3 colonnes (2 sur mobile), bannière promotionnelle insérée dans la
  grille après quelques produits.
- Pagination « Plus » (chargement progressif) + liens de pages pour le
  référencement (12 produits par page).
- Bloc réassurance avant le pied de page.

## 6. Fiche produit

- Haut de page en deux colonnes : **galerie** (3 à 5 vues, miniatures
  verticales, zoom) à gauche ; informations à droite.
- Colonne informations : fil d'Ariane, nom + type, facettes olfactives,
  **sélecteur de format** (35 ml / 70 ml / 200 ml / coffret voyage) avec prix
  par format, quantité (1 à 10), **prix pour 100 ml**, personnalisation
  (gravure payante en 5 étapes), état du stock, estimation de livraison,
  bouton « Ajouter au panier » collant, « Ajouter aux favoris ».
- Service d'essai (échantillon offert, retour possible du flacon fermé).
- Rappel des avantages (livraison, échantillons, attention).
- Sections en bas : **L'inspiration** (texte), **Les notes olfactives**
  (une carte par matière première avec texte « Voir plus »), **liste
  d'ingrédients** par format (repliable), **tri et durabilité**.
- **« Complétez votre rituel »** : parcours en 6 étapes (nettoyer, hydrater,
  sublimer, voiler, parfumer, maison) avec total du rituel en un clic.
- **« La collection »** : carrousel des autres produits de la même ligne.
- Métadonnées : titre « Nom ⋅ Type ⋅ Format ⋅ Marque », Open Graph,
  données structurées produit.

## 7. Page collection (ligne de parfum)

- Vidéo ou visuel plein écran, nom de la collection, H1, texte
  d'inspiration.
- **Filtres par onglets** (Voir tout / Parfums / Bain & Corps / Duo & Trio /
  Voyage & Art de vivre) puis grille des produits de la ligne, avec blocs
  éditoriaux intercalés (« Découvrir »).
- Bloc « Inspiration » (facettes olfactives) puis **liste de toutes les
  collections** (nom, texte court, « Découvrir »).

## 8. Recherche

- Résultats : titre, compteur, même grille que les catégories, pagination.
- Sans saisie : suggestions (vignettes de catégories, produits iconiques).

## 9. Panier et parcours d'achat

- Mini-panier (tiroir) + page panier complète.
- Avantages rappelés à chaque étape ; total TTC, livraison calculée après.
- Tunnel de commande sur la plateforme (adresse, livraison, paiement) avec
  compte facultatif ; suivi de commande sans compte.
- Alertes de disponibilité (« Prévenez-moi »).

## 10. Charte détectée (pour s'en inspirer, pas pour la copier)

- Fond blanc, texte gris anthracite, accent **doré/beige** (`#AC9270`),
  gris secondaire. Très peu de couleurs.
- Titres en **Bodoni** (serif à fort contraste), texte en grotesque
  (sans-serif), petites tailles, lettrage espacé en capitales.
- Espacements généreux (base 4 px), coins presque carrés (4 px), filets
  fins, boutons rectangulaires à bordure fine.
- Photographies produit sur fond blanc uniforme ; visuels d'ambiance
  plein écran.

## 11. Responsive

- Trois comportements : bureau (méga-menu, grille 3-4 colonnes), tablette
  (grille 2-3), mobile (menu plein écran, grille 2, carrousels à glisser,
  bouton d'achat collant en bas).

## 12. Ce que Luxury Scent reprend, et ce qui diffère

| Reprise (fonctionnelle) | Choix propre à Luxury Scent |
|---|---|
| Méga-menu, recherche en panneau, mini-panier, badges, image au survol | Police de titres **Cormorant Garamond**, texte **Jost** |
| Sélecteur de formats avec prix par format et prix au 100 ml | Palette ivoire / noir / or (`#C9A96E`) et hiver lumineux (visuel fourni) |
| Facettes olfactives, notes, inspiration, « compléter le rituel » | Logo typographique « LUXURY SCENT » original |
| Page collection avec filtres par onglets | Contenus, photos, textes et structure de données propres |
| Réassurance, suivi de commande, favoris | Espace administrateur complet (produits, contenu, commandes, comptabilité, banque) |

Fonctionnalités de la référence non retenues en v1 : gravure
personnalisée, localisateur de boutiques, programme de fidélité, sélecteur
multi-pays / multi-devises, favoris synchronisés au compte (favoris locaux
en v1).
