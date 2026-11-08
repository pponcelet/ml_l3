"use strict";
// DBSCAN : animation du parcours, des voisinages et de l'expansion des groupes.
// Les calculs sont préenregistrés afin de permettre Pause et le curseur de temps.
(function () {
    const $ = id => document.getElementById(id);
    const colors = ML.palette;
    const mainSize = {w: 540, h: 440, x0: 90, y0: 33, side: 360};
    const center = {x: 270, y: 210};
    const localRadius = 116;
    const px = p => mainSize.x0 + p.x * mainSize.side / 100;
    const py = p => mainSize.y0 + (100 - p.y) * mainSize.side / 100;
    const color = label => label >= 0 ? colors[label % colors.length] :
        label === -1 ? "#a6b3bf" : "#c4d0db";

    let points = [];
    let neighbors = [];
    let isCore = [];
    let frames = [];
    let current = 0;
    let timer = null;
    let eps = 6;
    let minpts = 5;
    let mainDots;
    let mainRadius;
    let mainEdges;
    let mainFocus;
    let localLayer;

    // Étapes de DBSCAN. -2 : non exploré ; -1 : bruit provisoire.
    // Une observation initialement étiquetée bruit peut être récupérée
    // ultérieurement comme point de bord d'un groupe.
    function buildTrace() {
        const n = points.length;
        neighbors = Array.from({length: n}, () => []);
        for (let i = 0; i < n; i++) {
            for (let j = i; j < n; j++) {
                if (ML.dist2(points[i], points[j]) <= eps * eps + 1e-10) {
                    neighbors[i].push(j);
                    if (i !== j) neighbors[j].push(i);
                }
            }
        }
        isCore = neighbors.map(nb => nb.length >= minpts);
        const visited = Array(n).fill(false);
        const labels = Array(n).fill(-2);
        let nClusters = 0;
        frames = [];

        function capture(phase, focus, info) {
            frames.push({
                phase, focus, info, clusterCount: nClusters,
                labels: labels.slice(), visited: visited.slice()
            });
        }
        capture("initial", -1,
            "Chaque observation est non explorée. Lancez DBSCAN pour examiner les voisinages.");

        // Ordre reproductible pour conserver exactement le même parcours.
        const order = ML.shuffleIndices(n, ML.rng(253));
        for (const i of order) {
            if (visited[i]) continue;
            visited[i] = true;
            if (!isCore[i]) {
                labels[i] = -1;
                capture("noise", i,
                    `Observation ${i + 1} : ${neighbors[i].length} voisin(s), ` +
                    `point compris (MinPts = ${minpts}). ` +
                    "Pas assez de voisins : bruit provisoire.");
                continue;
            }

            const cluster = nClusters++;
            labels[i] = cluster;
            capture("seed", i,
                `Observation ${i + 1} : ${neighbors[i].length} voisin(s), ` +
                "point compris. Point cœur : un nouveau groupe démarre.");

            const queue = neighbors[i].filter(j => j !== i);
            const enqueued = new Set([i, ...queue]);
            let head = 0;
            while (head < queue.length) {
                const j = queue[head++];
                const formerLabel = labels[j];
                if (!visited[j]) {
                    visited[j] = true;
                    if (isCore[j]) {
                        for (const k of neighbors[j]) {
                            if (!enqueued.has(k)) {
                                enqueued.add(k);
                                queue.push(k);
                            }
                        }
                    }
                }
                if (labels[j] < 0) labels[j] = cluster;

                let info;
                if (isCore[j]) {
                    info = `Observation ${j + 1} : point cœur ` +
                        `(${neighbors[j].length} voisins, elle-même comprise). ` +
                        "Le groupe s'étend à ses voisins.";
                } else if (formerLabel === -1) {
                    info = `Observation ${j + 1} : précédemment signalée ` +
                        "comme bruit, elle rejoint maintenant un groupe comme point de bord.";
                } else {
                    info = `Observation ${j + 1} : point de bord ` +
                        `(${neighbors[j].length} voisins). ` +
                        "Elle est rattachée au groupe sans le propager.";
                }
                capture("expand", j, info);
            }
        }
        capture("done", -1,
            "Parcours terminé : les groupes et les observations de bruit sont définitifs.");
    }

    function initCharts() {
        const s = mainSize;
        const left = d3.select("#db-plot").append("svg")
            .attr("viewBox", `0 0 ${s.w} ${s.h}`)
            .attr("role", "img")
            .attr("aria-label", "Nuage de points : exploration DBSCAN");
        left.append("defs").append("clipPath").attr("id", "db-clip-main")
            .append("rect").attr("x", s.x0).attr("y", s.y0)
            .attr("width", s.side).attr("height", s.side);
        const grid = left.append("g");
        for (let v = 0; v <= 100; v += 20) {
            const xv = s.x0 + s.side * v / 100;
            const yv = s.y0 + s.side * (100 - v) / 100;
            grid.append("line").attr("x1", xv).attr("x2", xv)
                .attr("y1", s.y0).attr("y2", s.y0 + s.side)
                .attr("stroke", "#e9eff4");
            grid.append("line").attr("x1", s.x0).attr("x2", s.x0 + s.side)
                .attr("y1", yv).attr("y2", yv)
                .attr("stroke", "#e9eff4");
            grid.append("text").attr("x", xv).attr("y", s.y0+s.side+22)
                .attr("font-size", 10).attr("fill", "#8193a3")
                .attr("text-anchor", "middle").text(v);
            grid.append("text").attr("x", s.x0-12).attr("y", yv+4)
                .attr("font-size", 10).attr("fill", "#8193a3")
                .attr("text-anchor", "end").text(v);
        }
        left.append("rect").attr("x", s.x0).attr("y", s.y0)
            .attr("width", s.side).attr("height", s.side)
            .attr("fill", "none").attr("stroke", "#cbd8e3");

        const mainG = left.append("g").attr("clip-path", "url(#db-clip-main)");
        mainRadius = mainG.append("circle")
            .attr("class", "db-eps-circle").attr("fill", "#4f8dbd")
            .attr("fill-opacity", 0.045).attr("stroke", "#5687ab")
            .attr("stroke-width", 1.7).attr("stroke-dasharray", "5 4")
            .style("display", "none");
        mainEdges = mainG.append("g");
        mainDots = mainG.append("g").selectAll("circle")
            .data(points).join("circle").attr("class", "db-observation")
            .attr("cx", px).attr("cy", py).attr("r", 3.8);
        mainDots.append("title");
        mainFocus = mainG.append("circle").attr("r", 8.2)
            .attr("fill", "none").attr("stroke", "#d28443")
            .attr("stroke-width", 2.3).style("display", "none");

        const right = d3.select("#db-neighborhood").append("svg")
            .attr("viewBox", `0 0 ${s.w} ${s.h}`)
            .attr("role", "img")
            .attr("aria-label", "Voisinage epsilon du point examiné");
        right.append("defs").append("clipPath").attr("id", "db-clip-detail")
            .append("rect").attr("x", 64).attr("y", 5)
            .attr("width", 412).attr("height", 425);
        const background = right.append("g");
        background.append("line").attr("x1", 64).attr("x2", 476)
            .attr("y1", center.y).attr("y2", center.y)
            .attr("stroke", "#ecf1f6");
        background.append("line").attr("x1", center.x).attr("x2", center.x)
            .attr("y1", 5).attr("y2", 430)
            .attr("stroke", "#ecf1f6");
        background.append("circle").attr("cx", center.x)
            .attr("cy", center.y).attr("r", localRadius)
            .attr("stroke", "#5687ab").attr("stroke-dasharray", "5 4")
            .attr("stroke-width", 2).attr("fill", "#e7f1f8")
            .attr("fill-opacity", 0.7);
        background.append("text").attr("x", center.x+localRadius+10)
            .attr("y", center.y-6).attr("fill", "#4e7e9f")
            .attr("font-size", 14).text("ε");
        background.append("text").attr("x", center.x).attr("y", 425)
            .attr("text-anchor", "middle").attr("font-size", 11)
            .attr("fill", "#8a9aa9")
            .text("Zoom autour de l'observation examinée");
        localLayer = right.append("g").attr("clip-path", "url(#db-clip-detail)");
    }

    function statusName(i, frame) {
        if (frame.labels[i] === -2) return "non exploré";
        if (frame.labels[i] === -1) return "bruit provisoire";
        return isCore[i] ? "cœur" : "bord";
    }

    function draw(frame, immediate) {
        const i = frame.focus;
        const focused = i >= 0 ? points[i] : null;
        const active = focused ? neighbors[i] : [];
        const label = frame.labels;

        mainDots.interrupt();
        const dots = immediate ? mainDots : mainDots.transition().duration(135);
        dots.attr("fill", (_, j) => {
                if (label[j] >= 0 && !isCore[j]) return "#ffffff";
                return color(label[j]);
            })
            .attr("stroke", (_, j) => label[j] >= 0 && !isCore[j] ?
                color(label[j]) : "#ffffff")
            .attr("stroke-width", (_, j) => label[j] >= 0 && !isCore[j] ? 1.9 : 0.8)
            .attr("r", (_, j) => label[j] >= 0 && !isCore[j] ? 4.5 : 3.8)
            .attr("fill-opacity", (_, j) => label[j] === -2 ? 0.65 : 0.98);
        mainDots.select("title").text((_, j) =>
            `Observation ${j + 1} : ${statusName(j, frame)}`);

        mainRadius.style("display", focused ? null : "none");
        mainFocus.style("display", focused ? null : "none");
        if (focused) {
            mainRadius.attr("cx", px(focused)).attr("cy", py(focused))
                .attr("r", eps * mainSize.side / 100);
            mainFocus.attr("cx", px(focused)).attr("cy", py(focused));
        }
        const edgeData = focused ? active.filter(j => j !== i) : [];
        mainEdges.selectAll("line").data(edgeData, j => j).join(
            enter => enter.append("line")
                .attr("stroke", "#75a5c6").attr("stroke-opacity", .3)
                .attr("stroke-width", 1),
            update => update,
            exit => exit.remove()
        ).attr("x1", px(focused || {x:0,y:0}))
         .attr("y1", py(focused || {x:0,y:0}))
         .attr("x2", j => px(points[j]))
         .attr("y2", j => py(points[j]));

        const near = focused ? points.map((p,j) => ({p,j,d:ML.dist(p,focused)}))
            .filter(a => a.d <= 1.72 * eps) : [];
        const scale = localRadius / eps;
        const circles = localLayer.selectAll("circle.db-local")
            .data(near, d => d.j).join(
                enter => enter.append("circle").attr("class", "db-local"),
                update => update,
                exit => exit.remove()
            );
        circles.attr("cx", a => center.x + (a.p.x - focused.x)*scale)
            .attr("cy", a => center.y - (a.p.y - focused.y)*scale)
            .attr("r", a => a.j===i ? 7 : a.d <= eps ? 5.5 : 3.6)
            .attr("stroke", a => a.j===i ? "#d28443" :
                label[a.j] >= 0 ? color(label[a.j]) : "#8da8bc")
            .attr("stroke-width", a => a.j===i ? 3 : 1.4)
            .attr("fill", a => a.j===i ? "#ffffff" :
                a.d<=eps ? "#5b94bb" : "#ffffff")
            .attr("fill-opacity", a => a.d <= eps ? .88 : .60);

        const visitedCount = frame.visited.filter(Boolean).length;
        const coreCount = frame.visited.filter((v,j) => v && isCore[j]).length;
        const borderCount = label.filter((l,j) => l >= 0 && !isCore[j]).length;
        const noiseCount = label.filter(l => l === -1).length;
        $("db-groups").textContent = frame.clusterCount;
        $("db-visited").textContent = visitedCount + " / " + points.length;
        $("db-core-count").textContent = coreCount;
        $("db-border-count").textContent = borderCount;
        $("db-noise-count").textContent = noiseCount;
        $("db-point").textContent = focused ? "Observation " + (i+1) : "—";
        $("db-neighbor-count").textContent = focused ?
            active.length + " (point compris)" : "—";
        $("db-point-type").textContent = focused ?
            (isCore[i] ? "Cœur" : label[i] >= 0 ? "Bord" :
                "Bruit provisoire") : frame.phase === "done" ?
                "Terminé" : "En attente";
        $("db-message").textContent = frame.info;
        $("db-progress").max = String(Math.max(0, frames.length-1));
        $("db-progress").value = String(current);
        $("db-progress-value").textContent =
            current + " / " + (frames.length - 1);
        $("db-finished-note").textContent = frame.phase === "done" ?
            `Résultat final : ${frame.clusterCount} groupe(s), ` +
            `${noiseCount} observation(s) de bruit. ` +
            "DBSCAN a déterminé le nombre de groupes sans K préalable." :
            "Les points gris classés bruit peuvent encore être rattachés " +
            "à un groupe au cours de l'exploration.";
        $("db-next").disabled = current >= frames.length-1;
        $("db-end").disabled = current >= frames.length-1;
    }

    function pause() {
        if (timer !== null) clearTimeout(timer);
        timer = null;
        $("db-play").textContent = current >= frames.length-1 ?
            "Relancer" : "Lancer";
    }
    function goTo(index, immediate = true) {
        current = Math.max(0, Math.min(frames.length-1, index));
        draw(frames[current], immediate);
        if (current >= frames.length-1) pause();
    }
    function play() {
        if (timer !== null) { pause(); return; }
        if (current >= frames.length-1) goTo(0);
        $("db-play").textContent = "Pause";
        function tick() {
            if (current >= frames.length-1) { pause(); return; }
            goTo(current+1, false);
            if (current < frames.length-1) {
                timer = setTimeout(tick, Number($("db-speed").value));
            } else pause();
        }
        timer = setTimeout(tick, Number($("db-speed").value));
    }
    function reset() {
        pause();
        eps = Number($("db-eps").value);
        minpts = Number($("db-minpts").value);
        $("db-eps-value").textContent = eps.toFixed(1).replace(".", ",");
        $("db-minpts-value").textContent = minpts;
        points = ML.dataset($("db-dataset").value, 124);
        buildTrace();
        d3.select("#db-plot").selectAll("svg").remove();
        d3.select("#db-neighborhood").selectAll("svg").remove();
        initCharts();
        goTo(0);
    }

    $("db-play").addEventListener("click", play);
    $("db-next").addEventListener("click", () => {
        pause(); goTo(current + 1);
    });
    $("db-reset").addEventListener("click", reset);
    $("db-end").addEventListener("click", () => {
        pause(); goTo(frames.length-1);
    });
    $("db-progress").addEventListener("input", () => {
        pause(); goTo(Number($("db-progress").value));
    });
    const suggestedEps = {moons:6.5, circles:8, blobs:8,
        elongated:8, varying:9.5, noise:6.5};
    $("db-dataset").addEventListener("change", () => {
        $("db-eps").value = suggestedEps[$("db-dataset").value];
        reset();
    });
    for (const id of ["db-eps", "db-minpts"]) {
        $(id).addEventListener("input", reset);
        $(id).addEventListener("change", reset);
    }
    reset();
}());
