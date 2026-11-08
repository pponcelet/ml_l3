"use strict";
// Trois partitions calculées sur exactement les mêmes coordonnées.
// La couleur d'un groupe n'a de signification qu'au sein de sa méthode.
(function () {
    const $ = id => document.getElementById(id);
    const shapeDescriptions = {
        blobs: "Trois ensembles compacts et relativement séparés.",
        elongated: "Groupes allongés : la compacité euclidienne n'est pas toujours adaptée.",
        moons: "Deux lunes entrelacées : les formes ne sont pas convexes.",
        circles: "Deux anneaux concentriques : les groupes ne sont pas séparables par des centroïdes.",
        varying: "Trois ensembles de densités différentes : un seul ε peut être insuffisant.",
        noise: "Deux groupes compacts accompagnés de points isolés."
    };
    const prompts = {
        blobs: "Les trois méthodes peuvent identifier des groupes compacts. Modifiez K, la liaison ou ε : les résultats restent-ils stables ?",
        elongated: "Essayez la liaison Single, puis Ward. Une forme allongée doit-elle nécessairement être découpée en plusieurs groupes ?",
        moons: "Comparez les deux lunes : K-means découpe selon la proximité aux centres, tandis que certaines méthodes peuvent suivre leur forme.",
        circles: "Les deux cercles ont presque le même centre. Quelles méthodes peuvent malgré tout les distinguer ?",
        varying: "Un ε suffisamment grand pour une zone peu dense risque de fusionner des groupes plus denses. Peut-on choisir un seul bon rayon ?",
        noise: "Faites varier ε et observez combien de points DBSCAN classe comme bruit. Les autres méthodes attribuent-elles ces points à un groupe ?"
    };
    const colors = ML.palette;
    let seed = 124;
    let points = [];
    let hovered = null;
    const cache = new Map();

    function presetsForDataset() {
        const shape = $("cmp-dataset").value;
        $("cmp-k").value = ["moons", "circles", "noise"].includes(shape) ? 2 : 3;
        $("cmp-eps").value = shape === "circles" ? 8.5 : 6.5;
        $("cmp-minpts").value = 5;
    }

    function setPoints() {
        points = ML.dataset($("cmp-dataset").value, seed);
        cache.clear();
        $("cmp-dataset-caption").textContent =
            shapeDescriptions[$("cmp-dataset").value];
        $("cmp-conclusion").textContent =
            prompts[$("cmp-dataset").value];
    }

    function plot(id, title) {
        const w = 400, h = 400;
        const m = {left: 39, right: 14, top: 14, bottom: 39};
        const x = d3.scaleLinear().domain([0, 100])
            .range([m.left, w - m.right]);
        const y = d3.scaleLinear().domain([0, 100])
            .range([h - m.bottom, m.top]);
        const svg = d3.select(id).append("svg")
            .attr("viewBox", `0 0 ${w} ${h}`)
            .attr("role", "img")
            .attr("aria-label", title);
        const grid = svg.append("g").attr("class", "cmp-grid");
        const ticks = [0, 25, 50, 75, 100];
        grid.selectAll(".v-line").data(ticks).join("line")
            .attr("x1", d => x(d)).attr("x2", d => x(d))
            .attr("y1", y(0)).attr("y2", y(100));
        grid.selectAll(".h-line").data(ticks).join("line")
            .attr("x1", x(0)).attr("x2", x(100))
            .attr("y1", d => y(d)).attr("y2", d => y(d));
        svg.append("g")
            .attr("transform", `translate(0,${y(0)})`)
            .call(d3.axisBottom(x).tickValues(ticks));
        svg.append("g")
            .attr("transform", `translate(${x(0)},0)`)
            .call(d3.axisLeft(y).tickValues(ticks));
        const layer = svg.append("g").attr("class", "cmp-points");
        return {layer, x, y};
    }

    const plots = {
        km: plot("#cmp-kmeans-chart", "Partition K-means"),
        hc: plot("#cmp-hierarchical-chart", "Partition hiérarchique"),
        db: plot("#cmp-dbscan-chart", "Partition DBSCAN")
    };

    function color(label) {
        if (label === -1) return "#a9b4bf";
        return colors[((label % colors.length) + colors.length)
            % colors.length];
    }

    function focusPoint(i) {
        hovered = i;
        d3.selectAll(".cmp-point")
            .classed("cmp-point-focus", d => d.i === hovered);
    }

    function draw(name, labels) {
        const view = plots[name];
        const data = points.map((p, i) => ({...p, i, label: labels[i]}));
        const nodes = view.layer.selectAll("circle.cmp-point")
            .data(data, d => d.i)
            .join(enter => {
                const circles = enter.append("circle")
                    .attr("class", "cmp-point")
                    .attr("r", 3.4);
                circles.append("title");
                return circles;
            })
            .on("mouseenter", (event, d) => focusPoint(d.i))
            .on("mouseleave", () => focusPoint(null));
        nodes.select("title").text(d =>
            `Observation ${d.i + 1} : (${d.x.toFixed(1)}, ${d.y.toFixed(1)})`);
        nodes.classed("cmp-point-focus", d => d.i === hovered);
        nodes.interrupt().transition().duration(240)
            .attr("cx", d => view.x(d.x))
            .attr("cy", d => view.y(d.y))
            .attr("fill", d => color(d.label));
    }

    function getCached(key, compute) {
        if (!cache.has(key)) cache.set(key, compute());
        return cache.get(key);
    }

    function score(labels, withoutNoise = false) {
        let samples = points, groups = labels;
        if (withoutNoise) {
            const usable = points.map((p, i) => ({p, group: labels[i]}))
                .filter(x => x.group >= 0);
            samples = usable.map(x => x.p);
            groups = usable.map(x => x.group);
        }
        const nGroups = new Set(groups).size;
        if (nGroups < 2 || nGroups >= samples.length) return null;
        return ML.silhouette(samples, groups);
    }

    function formatScore(value) {
        return value === null || !Number.isFinite(value) ?
            "—" : value.toLocaleString("fr-FR", {
                minimumFractionDigits: 3,
                maximumFractionDigits: 3
            });
    }

    function summary(method, labels, noise = 0) {
        const assignedGroups = new Set(labels.filter(id => id >= 0)).size;
        $("cmp-" + method + "-groups").textContent = assignedGroups;
        $("cmp-" + method + "-sil").textContent =
            formatScore(score(labels, method === "db"));
        if (method === "db") $("cmp-db-noise").textContent = noise;
    }

    function renderKmeans() {
        const k = Number($("cmp-k").value);
        $("cmp-k-value").textContent = k;
        $("cmp-hc-k").textContent = k;
        const result = getCached(`km:${k}`, () =>
            ML.fitKmeans(points, k, 19 + seed, 8));
        draw("km", result.labels);
        summary("km", result.labels);
        $("cmp-km-insight").textContent =
            `Inertie : ${Math.round(result.inertia).toLocaleString("fr-FR")} ` +
            "(somme des distances au carré, propre à K-means).";
    }

    function renderHierarchical() {
        const k = Number($("cmp-k").value);
        const link = $("cmp-link").value;
        const result = getCached(`hc:${k}:${link}`, () =>
            ML.hierarchical(points, k, link));
        draw("hc", result.labels);
        summary("hc", result.labels);
        const details = {
            ward: "Ward favorise des fusions limitant l'augmentation de l'inertie.",
            single: "Single utilise la plus petite distance entre deux groupes ; attention à l'effet de chaînage.",
            complete: "Complete utilise la plus grande distance entre deux groupes.",
            average: "Average utilise la distance moyenne entre les deux groupes."
        };
        $("cmp-hc-insight").textContent = details[link];
    }

    function renderDbscan() {
        const eps = Number($("cmp-eps").value);
        const minpts = Number($("cmp-minpts").value);
        $("cmp-eps-value").textContent = eps.toLocaleString("fr-FR");
        $("cmp-minpts-value").textContent = minpts;
        const result = getCached(`db:${eps}:${minpts}`, () =>
            ML.dbscan(points, eps, minpts));
        draw("db", result.labels);
        summary("db", result.labels, result.noise);
        $("cmp-db-insight").textContent = result.found === 0 ?
            "Aucun groupe détecté : tous les points sont classés comme bruit." :
            `${result.found} groupe(s) détecté(s). ` +
            "DBSCAN n'exige pas de fixer K à l'avance.";
    }

    function renderAll() {
        renderKmeans();
        renderHierarchical();
        renderDbscan();
    }

    $("cmp-dataset").addEventListener("change", () => {
        presetsForDataset();
        setPoints();
        renderAll();
    });
    $("cmp-regenerate").addEventListener("click", () => {
        seed++;
        setPoints();
        renderAll();
    });
    $("cmp-k").addEventListener("input", () => {
        renderKmeans();
        renderHierarchical();
    });
    $("cmp-link").addEventListener("change", renderHierarchical);
    $("cmp-eps").addEventListener("input", renderDbscan);
    $("cmp-minpts").addEventListener("input", renderDbscan);

    setPoints();
    renderAll();
}());
