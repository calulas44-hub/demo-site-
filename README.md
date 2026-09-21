# 👑 MYKONOS — Le kebab qui te met KO !

Site de commande en ligne + espace administrateur pour le restaurant **MYKONOS**.
Site 100 % statique (HTML / CSS / JavaScript) — se déploie sur n'importe quel
hébergement statique (Netlify, Vercel, GitHub Pages…). Aucune base de données
serveur : les données sont gérées côté navigateur (localStorage), comme un vrai
petit back-office.

## 📁 Structure

```
index.html      → Site client (accueil, carte, commande, panier, compte)
admin.html      → Espace administrateur (code d'accès : 1305)
css/styles.css  → Design (rouge / noir / blanc, mobile-first)
js/data.js      → Source de données partagée (produits, prix, réglages, commandes…)
js/client.js    → Logique du parcours client
js/admin.js     → Logique de l'espace administrateur
assets/hero.webp→ Photo principale (bannière d'accueil)
```

## 🛒 Côté client (`index.html`)

- **Carte dynamique** : catégories, produits, prix, emojis/images — pilotés par l'admin.
- **Personnalisation du sandwich** :
  - Sauces : Blanche, Algérienne, Harissa, Mayonnaise, Ketchup, Samouraï, Barbecue, Andalouse.
  - Crudités : Salade, Tomates, Oignons (choix **Avec / Sans** pour chacune).
  - **Pain / Galette** proposés uniquement quand c'est logique (ex. un burger reste dans son pain).
- **Offre Menu +1 €** : à chaque sandwich éligible, proposition de passer en menu
  (+ 1 boisson au choix). Acceptable **depuis la modale de personnalisation**
  *et* **directement depuis le panier**.
- **Contrôle d'âge 18+** automatique pour les boissons alcoolisées (ex. Heineken).
- **Compte client** proposé après la 1ʳᵉ commande : prénom, nom, e-mail, téléphone.
  - Avantage **-10 %** sur la commande suivante, **utilisable seulement 24 h après**
    la 1ʳᵉ commande (géré automatiquement).
- **Newsletter** : case à cocher facultative à la création du compte.
- **E-mail de confirmation** automatique (si EmailJS est configuré, voir plus bas).

## 🔐 Côté administrateur (`admin.html`)

Accès par **code** (par défaut `1305`, modifiable dans Réglages). Gère :

- **Tableau de bord** (CA du jour, commandes, clients, abonnés…).
- **Commandes** : statut, ticket imprimable, détail des personnalisations, suppression.
- **Produits** : prix, description, **emoji** (choix / suppression), **image**
  (ajout / remplacement / suppression / aperçu), disponibilité, catégorie,
  pain/galette, personnalisation, éligibilité au menu.
- **Catégories**, **Boissons** (prix, dispo, alcool), **Sauces**, **Crudités**,
  **Promotions / codes**, **Clients**, **Newsletter** (export CSV), **Réglages**.
- **Sauvegarde** : export / import JSON, réinitialisation.

> Toute modification admin est appliquée **immédiatement** côté client
> (même origine / navigateur, et entre onglets ouverts).

## 📧 Activer les e-mails automatiques (optionnel)

Le site fonctionne sans configuration (les commandes s'affichent dans l'admin).
Pour envoyer de **vrais e-mails** de confirmation :

1. Créez un compte gratuit sur [emailjs.com](https://www.emailjs.com/).
2. Créez un **Service** (Gmail, etc.) et deux **Templates** (client + admin)
   en utilisant les variables listées dans *Réglages → E-mails*.
3. Dans **Admin → Réglages → E-mails**, activez l'option et collez :
   *Public Key*, *Service ID*, *Template client*, *Template admin*, e-mail de réception.
4. Utilisez **« Envoyer un e-mail de test »** pour vérifier.

## 🚀 Déploiement

C'est un site statique : publiez le contenu du dossier tel quel.

- **Netlify** : glissez-déposez le dossier, ou connectez ce dépôt Git (build
  vide, dossier de publication = racine).
- **GitHub Pages / Vercel** : servez la racine du dépôt.

## ⚠️ Note sur la persistance des données

Les données (catalogue, commandes, clients) sont stockées dans le **navigateur**
(localStorage), par appareil. C'est idéal pour une prise de commande sur la
tablette/l'ordinateur du restaurant. Pour synchroniser le catalogue sur tous les
appareils des clients, exportez votre sauvegarde depuis l'admin et
réimportez-la, ou branchez une base de données (Firebase/Supabase) — le code est
centralisé dans `js/data.js` pour faciliter cette évolution.
