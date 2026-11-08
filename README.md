# Apprentissage automatique

Site de cours en HTML, CSS et JavaScript, organisé en chapitres autonomes.
Les pages sont consultables sans serveur applicatif et les consignes
utilisent le vouvoiement.

## Organisation

- `index.html` : introduction à l'apprentissage automatique.
- `fondamentaux/` : données, exploration, préparation, évaluation et validation.
- `supervise/` : classification, Naive Bayes, régression logistique,
  KNN, arbre de décision, SVM, régression et comparaison des classifieurs.
- `reduction/` : ACP, t-SNE et UMAP.
- `clustering/` : K-means, clustering hiérarchique, DBSCAN et comparaison.
- `association/` et `sequences/` : Apriori et GSP.
- `assets/css/` et `assets/js/` : styles et visualisations.
- `assets/vendor/` : bibliothèques distribuées avec le site.

Toutes les URL internes sont relatives ; le site peut donc être publié à
`https://identifiant.github.io/ml-course/` sans modifier les liens.

## Publication sur GitHub Pages

1. Créer un dépôt GitHub, par exemple `ml-course`, avec le **contenu**
   de ce dossier à sa racine (notamment `index.html` et `.github/`).
2. Choisir **Settings → Pages → Build and deployment → Source : GitHub Actions**.
3. Pousser les modifications sur la branche `main`.
4. Le workflow `.github/workflows/pages.yml` prépare les ressources statiques
   et les publie automatiquement via GitHub Pages.

Le workflow effectue deux préparations **avant publication** :

- téléchargement local de D3 v7.9.0 dans `assets/vendor/d3.v7.min.js` ;
- calcul par `umap-learn` des 18 représentations UMAP (3 jeux de données,
  3 valeurs de `n_neighbors`, 2 valeurs de `min_dist`), sauvegardées dans
  `assets/js/manifold-data.js`.

Ces étapes ont lieu dans GitHub Actions. **Le site publié ne nécessite aucun
serveur Python, aucun appel API et aucun calcul UMAP dans le navigateur.**
Le workflow échoue si l'une des ressources à publier manque.

## Consultation locale

La plupart des pages peuvent être ouvertes directement avec `index.html`.
La version distribuée comprend des données de visualisation utilisables avant
la préparation ; l'UMAP pré-calculé qui l'accompagne à ce stade est simplifié,
et la page le signale. Le workflow de publication le remplace par les données
calculées avec `umap-learn`.

Pour préparer la version locale **identique à celle qui sera publiée**, il faut
une seule fois Python et les dépendances de construction :

```bash
python3 -m pip install -r scripts/requirements-build.txt
python3 scripts/build_static_assets.py
```

Ensuite, les pages chargent D3 localement et disposent des coordonnées UMAP
pré-calculées. Aucune bibliothèque Python n'est requise pour les consulter.

Pour vérifier les chemins et la présence des résultats préparés :

```bash
python3 scripts/check_static_site.py --require-prebuilt
```

Pour tester avec un serveur local (facultatif) :

```bash
python3 -m http.server 8000
```

Puis ouvrir `http://localhost:8000/`.

## Mise à jour de la visualisation t-SNE/UMAP

Les données d'origine sont enregistrées dans `assets/js/manifold-data.js`.
Le générateur utilise une graine fixe et conserve les mêmes observations pour
tous les paramètres. Les coordonnées 2D sont centrées et remises à l'échelle
avec **un facteur commun pour les deux axes**, afin de préserver la géométrie
des plongements calculés. Le changement de paramètre sélectionne une autre
représentation pré-calculée ; il ne lance pas un calcul UMAP côté client.

D3 et `umap-learn` sont utilisés sous leurs licences respectives ; voir
`assets/vendor/README.md` et la documentation de `umap-learn`.
