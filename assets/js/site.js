"use strict";
// Menu du cours. Aucune dépendance : fonctionne avec des fichiers HTML
// locaux, un serveur HTTP simple et GitHub Pages.
(function () {
    const sidebar = document.getElementById("sidebar");
    if (!sidebar) return;

    const root = document.body.dataset.root || "";
    const sections = [
        {
            title: "Fondamentaux",
            links: [
                ["Introduction", "index.html"],
                ["Observations et variables", "fondamentaux/donnees.html"],
                ["Décrire et explorer un jeu de données", "fondamentaux/exploration.html"],
                ["Préparation des données", "fondamentaux/preparation.html"],
                ["Normalisation et standardisation", "fondamentaux/pretraitement.html"],
                ["Distances et similarités", "fondamentaux/distances.html"],
                ["Entraînement, validation et test", "fondamentaux/validation.html"],
                ["Évaluer un modèle", "fondamentaux/evaluation.html"],
                ["Du problème à l'évaluation", "fondamentaux/demarche.html"]
            ]
        },
        {
            title: "Apprentissage supervisé",
            links: [
                ["Introduction", "supervise/index.html"],
                ["Classification", "supervise/classification.html"],
                ["Naive Bayes", "supervise/naive-bayes.html"],
                ["Régression logistique", "supervise/logistique.html"],
                ["K plus proches voisins", "supervise/knn.html"],
                ["Arbre de décision", "supervise/arbre-decision.html"],
                ["Machines à vecteurs de support (SVM)", "supervise/svm.html"],
                ["Comparer les méthodes", "supervise/comparaison.html"],
                ["Régression", "supervise/regression.html"]
            ]
        },
        {
            title: "Apprentissage et exploration non supervisés",
            groups: [
                {
                    title: "Réduction de dimension",
                    links: [
                        ["Introduction", "reduction/index.html"],
                        ["ACP (PCA)", "reduction/acp.html"],
                        ["t-SNE et UMAP", "reduction/autres-methodes.html"]
                    ]
                },
                {
                    title: "Clustering",
                    links: [
                        ["Introduction", "clustering/index.html"],
                        ["K-means", "clustering/kmeans.html"],
                        ["Clustering hiérarchique", "clustering/hierarchique.html"],
                        ["DBSCAN", "clustering/dbscan.html"],
                        ["Comparer les méthodes", "clustering/comparaison.html"]
                    ]
                },
                {
                    title: "Fouille de motifs",
                    links: [
                        ["Introduction", "association/introduction.html"],
                        ["Règles d'association — Apriori", "association/index.html"],
                        ["Motifs séquentiels — GSP", "sequences/index.html"]
                    ]
                }
            ]
        }
    ];

    const header = document.createElement("div");
    header.className = "brand";
    header.innerHTML = '<h2>Apprentissage automatique</h2>';
    sidebar.appendChild(header);

    // Comparer les chemins absolus évite les erreurs dues aux chemins relatifs
    // (« ../ »), particulièrement depuis les sous-dossiers du site.
    function pagePath(url) {
        let path = new URL(url, document.baseURI).pathname;
        if (path.endsWith("/")) path += "index.html";
        return decodeURI(path);
    }
    const currentPath = pagePath(window.location.href);

    const nav = document.createElement("nav");
    nav.setAttribute("aria-label", "Table des matières");

    function createLinks(items, container) {
        let containsCurrent = false;
        items.forEach(function ([label, path]) {
            const link = document.createElement("a");
            link.href = root + path;
            link.textContent = label;
            if (pagePath(link.href) === currentPath) {
                link.classList.add("active");
                link.setAttribute("aria-current", "page");
                containsCurrent = true;
            }
            container.appendChild(link);
        });
        return containsCurrent;
    }

    sections.forEach(function (section) {
        const details = document.createElement("details");
        details.className = "nav-group";

        const summary = document.createElement("summary");
        summary.className = "nav-group-toggle";
        summary.textContent = section.title;
        details.appendChild(summary);

        const body = document.createElement("div");
        body.className = "nav-group-body";
        let containsCurrent = false;

        if (section.links) {
            containsCurrent = createLinks(section.links, body);
        }
        if (section.groups) {
            section.groups.forEach(function (group) {
                const subgroup = document.createElement("details");
                subgroup.className = "nav-subgroup";

                const subsummary = document.createElement("summary");
                subsummary.className = "nav-subgroup-toggle";
                subsummary.textContent = group.title;
                subgroup.appendChild(subsummary);

                const subbody = document.createElement("div");
                subbody.className = "nav-subgroup-body";
                const active = createLinks(group.links, subbody);
                if (active) {
                    subgroup.open = true;
                    containsCurrent = true;
                }
                subgroup.appendChild(subbody);
                body.appendChild(subgroup);
            });
        }

        details.appendChild(body);
        // Ouvrir uniquement la partie contenant la page courante.
        // Sur la page d'accueil, « Fondamentaux » est ouvert.
        details.open = containsCurrent;
        nav.appendChild(details);
    });

    sidebar.appendChild(nav);
}());
