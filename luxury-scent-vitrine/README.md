# Luxury Scent — site vitrine (Netlify)

Site **100 % statique** qui présente la maison, les collections et les parfums en attendant
l'ouverture de la boutique en ligne. Pas de panier ni de paiement : à la place, les visiteurs
laissent leur e-mail (ouverture de la boutique, disponibilité d'un parfum, contact).

## Contenu

- Accueil (bannière hiver, signatures, collections, maison, coffret, univers, inscription à l'ouverture)
- Catalogue avec filtres (pour qui, famille olfactive) et tri, pages catégorie
- 13 fiches produit (contenances, prix indicatifs, pyramide olfactive, « Me prévenir »)
- 4 pages collection, La Maison, Questions fréquentes, Contact, mentions légales, confidentialité
- Page de remerciement, page 404, sitemap.xml, robots.txt, balises de partage (Open Graph)

## Formulaires (Netlify Forms)

| Formulaire | Où | Champs |
|---|---|---|
| `ouverture` | accueil, pied de page | e-mail |
| `disponibilite` | chaque fiche produit | e-mail, produit, contenance |
| `contact` | page Contact | nom, e-mail, sujet, message |

Les envois arrivent dans **Netlify → votre site → Forms**. Une protection anti-robot (champ piège)
est incluse. Sur les sites Netlify récents, il faut **activer la détection des formulaires**
une fois : *Site configuration → Forms → Enable form detection*, puis redéployer.
Pour recevoir chaque envoi par e-mail : *Forms → Form notifications*.

## Mettre en ligne

### Méthode A — glisser-déposer (sans rien installer)
1. Ouvrir https://app.netlify.com/drop
2. Glisser le dossier `dist/` (ou l'archive `luxury-scent-vitrine.zip` décompressée).
3. Dans *Site configuration → Change site name*, choisir `luxury-scent` si disponible.
   Sinon, reconstruire avec `SITE_URL=https://votre-nom.netlify.app node build.mjs` pour que
   les liens canoniques et le sitemap pointent vers la bonne adresse.

### Méthode B — relié à GitHub (mises à jour automatiques à chaque push)
1. Netlify → *Add new site → Import an existing project → GitHub* → dépôt `demo-site-`.
2. **Base directory** : `luxury-scent-vitrine`. Le reste (commande `node build.mjs`, dossier `dist`)
   est lu dans `netlify.toml`.
3. Branche : celle qui contient ce dossier (`claude/zealous-dijkstra-uc5a0d`, ou `main` après fusion).

### Nom de domaine
*Domain management → Add a domain* : Netlify indique les enregistrements DNS à créer chez votre
registraire et active le HTTPS automatiquement.

## Mettre à jour le contenu

Le contenu vient de l'administration de la boutique complète (`../luxury-scent`) :

```bash
cd ../luxury-scent && npm run vitrine:export   # produits, collections, textes et images → data/site.json
cd ../luxury-scent-vitrine && node build.mjs    # régénère dist/
```

On peut aussi modifier directement `data/site.json` (prix en centimes) puis relancer `node build.mjs`.

## Fichiers

```
build.mjs           générateur (Node ≥ 18, aucune dépendance)
data/site.json      contenu exporté
assets/css/site.css feuille de style (même charte que la boutique)
assets/js/site.js   menu mobile, filtres, contenances, animations
assets/img/         images
netlify.toml        configuration Netlify (build, en-têtes de sécurité, cache)
```
