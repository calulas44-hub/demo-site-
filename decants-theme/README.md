# Thème Shopify « Décants »

Thème Shopify (Online Store 2.0) pour une boutique de **parfums en décants** :
contenances 2 / 5 / 10 ml, prix au millilitre, pyramide olfactive, guide des tailles.
Sans dépendance : Liquid, CSS et un petit fichier JavaScript.

## Ce que contient le thème

| Page | Fonctionnalités |
|---|---|
| **Accueil** | Annonce, bannière, réassurance, produits en vedette, guide des contenances, « Comment ça marche », FAQ, newsletter |
| **Fiche produit** | Galerie, choix de la contenance (pastilles), prix et **prix au ml** mis à jour sans rechargement, stock bas (≤ 5), pyramide olfactive, réassurance, volets déroulants, produits associés, paiement express |
| **Collection** | Filtres (disponibilité, prix, marque, etc. selon la config Shopify), tri, pagination |
| **Panier** | Quantités, remise visible, barre « livraison offerte » (optionnelle), note de commande |
| **Autres** | Recherche, liste des collections, page 404, page Contact (modèle `page.contact`) |

Tout le contenu (textes, images, couleurs, polices, menus) se modifie dans l'**éditeur de thème** Shopify.

## Champs personnalisés à créer (pyramide olfactive)

La fiche produit lit ces champs. Dans Shopify : **Paramètres → Données personnalisées → Produits → Ajouter une définition**.
Espace de noms et clé exacts, type « Texte d'une ligne », valeurs séparées par des virgules :

| Nom | Espace de noms et clé | Exemple |
|---|---|---|
| Notes de tête | `custom.notes_tete` | Bergamote, Poivre rose |
| Notes de cœur | `custom.notes_coeur` | Ambre gris, Rose |
| Notes de fond | `custom.notes_fond` | Vanille, Benjoin, Musc |
| Famille olfactive | `custom.famille_olfactive` | Ambré |
| Concentration | `custom.concentration` | Eau de parfum |

Un champ vide n'affiche rien. Les types « liste de textes » fonctionnent aussi.

## Configurer les produits

- Crée **une option** nommée par exemple `Contenance` avec les valeurs `2 ml`, `5 ml`, `10 ml`.
- Le **prix au ml** est calculé automatiquement à partir du nombre suivi de « ml » dans la valeur d'option
  (`2 ml`, `10ml`, `2,5 ml`). Une valeur sans « ml » n'affiche pas de prix au ml.
- Active le **suivi des stocks** par variante pour afficher « Plus que N en stock ».
- Menus conseillés : `main-menu` (en-tête) et `footer` (pied de page).

## Textes à vérifier avant la mise en ligne

Ces textes par défaut sont des **propositions** : ils doivent correspondre à la réalité de ta boutique.

- « Décantés depuis le flacon d'origine » (accueil et fiche produit) : n'affirme que ce que tu garantis.
- « Colis protégé », délais de livraison et réponses de la FAQ : à adapter.
- Mention sur les marques dans le pied de page : à faire valider (usage des noms de marques, étiquetage des produits reconditionnés, règles d'expédition des parfums).
- Barre de livraison offerte : désactivée par défaut (`Paramètres du thème → Panier`). Ne l'active que si le seuil existe dans tes tarifs d'expédition.

## Installer le thème

1. **Depuis GitHub (recommandé)** : Boutique en ligne → Thèmes → Ajouter un thème → Connecter depuis GitHub,
   puis choisir ce dépôt et la branche. Shopify attend le thème à la **racine** du dépôt : dans ce dépôt il est dans `decants-theme/`,
   donc utilise un dépôt ou une branche dédiés au thème, ou la méthode ci-dessous.
2. **Shopify CLI** : `shopify theme push --path decants-theme --unpublished` (crée un thème non publié à prévisualiser).
3. **Zip** : compresse le *contenu* du dossier `decants-theme/` (pas le dossier lui-même) et importe-le dans Thèmes → Ajouter un thème → Importer.

## Vérifications effectuées

- Shopify **Theme Check** : 0 infraction.
- JSON valides, JavaScript sans erreur de syntaxe.
- Tests automatiques de la logique : prix au ml (arrondi, « 2,5 ml », variantes sans ml), JSON des variantes, sélecteur de contenance (prix, stock, épuisé, URL, quantités).
- Rendu visuel contrôlé en 1440 px et 390 px avec des données factices : aucun débordement horizontal.

Non testé : le thème n'a pas encore été chargé dans une vraie boutique Shopify (rendu avec les vrais produits, paiement express, filtres natifs, formulaires).

## Structure

```
assets/     theme.css, theme.js
config/     réglages du thème (couleurs, polices, panier, réseaux)
layout/     theme.liquid
locales/    fr.default.json
sections/   en-tête, pied de page, sections d'accueil et pages principales
snippets/   carte produit, icônes, prix au ml, pagination, newsletter
templates/  gabarits JSON (accueil, produit, collection, panier, recherche, pages, 404)
```
