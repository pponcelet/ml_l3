"use strict";
// K-means / K-medians : animation automatique sur un SVG persistant.
// Le SVG n'est plus détruit et recréé à chaque itération.
(function () {
    const $ = id => document.getElementById(id);
    const points = ML.dataset("blobs", 124);
    const kInput = $("km-k");
    const methodInput = $("km-method");
    const play = $("km-play");
    const colors = ML.palette;
    const kValue = () => Number(kInput.value);
    const isL1 = () => methodInput.value === "l1";
    const score = (a, b) => isL1() ?
        Math.abs(a.x - b.x) + Math.abs(a.y - b.y) : ML.dist2(a, b);
    const message = text => { $("km-message").textContent = text; };

    // Un nuage et une couche SVG uniques pour toute la simulation.
    const view = ML.scatter("#km-plot", points, [], {
        aria: "Simulation de K-means, avec centroïdes mobiles",
        xLabel: "Caractéristique 1",
        yLabel: "Caractéristique 2"
    });
    const {svg, sx, sy, rect, dots} = view;
    const centerLayer = svg.append("g").attr("class", "centroids");
    let centres = [];
    let labels = new Array(points.length).fill(null);
    let iteration = 0;
    let phase = "initialisation";
    let nextAction = "assign";
    let running = false;
    let manual = false;
    let timer = null;
    let runIndex = 0;
    const maxIterations = 50;

    function stop() {
        running = false;
        if (timer !== null) clearTimeout(timer);
        timer = null;
        play.textContent = "Lancer";
    }

    function resetAssignments() {
        labels.fill(null);
        iteration = 0;
        phase = "initialisation";
        nextAction = "assign";
    }

    function objective() {
        if (centres.length !== kValue() ||
            labels.some(id => id === null)) return null;
        return points.reduce((sum, p, i) =>
            sum + score(p, centres[labels[i]]), 0);
    }

    function refreshControls() {
        $("km-k-value").textContent = kValue();
        $("km-phase").textContent = {
            initialisation: "Initialisation",
            affectation: "Affectation",
            miseajour: "Mise à jour",
            convergence: "Convergence"
        }[phase];
        $("km-iter").textContent = iteration;
        const J = objective();
        $("km-inertia").textContent = J === null ? "—" :
            Math.round(J).toLocaleString("fr-FR") +
            (isL1() ? " unités" : " unités²");
        $("km-cost-label").textContent = isL1() ?
            "Coût L1" : "Inertie (L2²)";
        $("km-cost-desc").innerHTML = isL1() ?
            "<strong>Coût L1 :</strong> somme des distances de Manhattan " +
            "aux médianes des groupes. Cette variante est K-medians, " +
            "et non K-means classique." :
            "<strong>Inertie :</strong> somme des distances euclidiennes " +
            "<em>au carré</em> entre observations et centroïdes. " +
            "Elle s'exprime en unités², pas en pourcentage.";
        play.disabled = centres.length !== kValue();
        $("km-manual").disabled = running;
        $("km-random").disabled = running;
        methodInput.disabled = running;
        kInput.disabled = running;
        play.textContent = running ? "Pause" :
            (phase === "initialisation" ? "Lancer" :
                phase === "convergence" ? "Relancer" : "Reprendre");
    }

    function drawDots(animated = false) {
        const selection = animated ?
            dots.interrupt().transition().duration(480) : dots.interrupt();
        selection.attr("fill", (_, i) => labels[i] === null ?
            "#93a6b6" : colors[labels[i] % colors.length]);
    }

    function drawCentres(animated = false) {
        const marks = centerLayer.selectAll("g.center")
            .data(centres, d => d.id)
            .join(
                enter => {
                    const g = enter.append("g")
                        .attr("class", "center")
                        .style("cursor", "grab");
                    g.append("circle")
                        .attr("r", 11)
                        .attr("fill", "white")
                        .attr("stroke", d => colors[d.id % colors.length])
                        .attr("stroke-width", 2);
                    g.append("path")
                        .attr("d", "M-5 0H5M0 -5V5")
                        .attr("stroke", d => colors[d.id % colors.length])
                        .attr("stroke-width", 1.8)
                        .attr("fill", "none")
                        .attr("pointer-events", "none");
                    g.append("text")
                        .attr("x", 15)
                        .attr("y", 4)
                        .attr("font-size", 11)
                        .attr("fill", "#4a5c70")
                        .attr("font-weight", 600)
                        .attr("pointer-events", "none")
                        .text(d => d.id + 1);
                    return g;
                },
                update => update,
                exit => exit.remove()
            );
        marks.interrupt();
        if (animated) {
            marks.transition().duration(650).ease(d3.easeCubicInOut)
                .attr("transform", d =>
                    `translate(${sx(d.x)},${sy(d.y)})`);
        } else {
            marks.attr("transform", d =>
                `translate(${sx(d.x)},${sy(d.y)})`);
        }
        marks.style("cursor", running ? "default" : "grab");
        marks.call(d3.drag()
            .subject((event, d) => ({x: sx(d.x), y: sy(d.y)}))
            .on("start", function () {
                if (!running) d3.select(this).raise();
            })
            .on("drag", function (event, d) {
                if (running) return;
                d.x = Math.max(0, Math.min(100, sx.invert(event.x)));
                d.y = Math.max(0, Math.min(100, sy.invert(event.y)));
                d3.select(this).attr("transform",
                    `translate(${sx(d.x)},${sy(d.y)})`);
            })
            .on("end", function () {
                if (running) return;
                resetAssignments();
                drawDots();
                refreshControls();
                message("Centroïde déplacé. Cliquez sur Lancer.");
            }));
    }

    function randomCenters() {
        stop();
        manual = false;
        resetAssignments();
        const random = ML.rng(1200 + runIndex * 541);
        runIndex++;
        centres = ML.shuffleIndices(points.length, random)
            .slice(0, kValue())
            .map((idx, id) => ({x:points[idx].x,y:points[idx].y,id}));
        drawDots();
        drawCentres();
        refreshControls();
        message("Centres initialisés. Cliquez sur Lancer ou déplacez " +
            "les centroïdes avant de commencer.");
    }

    function manualCenters() {
        stop();
        manual = true;
        centres = [];
        resetAssignments();
        drawDots();
        drawCentres();
        refreshControls();
        message(`Cliquez dans le graphique pour placer ${kValue()} centroïdes.`);
    }

    rect.on("click", function (event) {
        if (!manual || running || centres.length >= kValue()) return;
        const [cx, cy] = d3.pointer(event, svg.node());
        centres.push({
            x:Math.max(0, Math.min(100, sx.invert(cx))),
            y:Math.max(0, Math.min(100, sy.invert(cy))),
            id:centres.length
        });
        drawCentres();
        refreshControls();
        const remaining = kValue() - centres.length;
        message(remaining ? `Placez encore ${remaining} centroïde(s).` :
            "Centres placés. Déplacez-les si nécessaire, puis lancez l'algorithme.");
    });

    function assignment() {
        let changes = 0;
        points.forEach((p, i) => {
            let best = Infinity;
            let assigned = 0;
            centres.forEach((c, j) => {
                const d = score(p, c);
                if (d < best) {best = d; assigned = j;}
            });
            if (labels[i] !== assigned) changes++;
            labels[i] = assigned;
        });
        phase = "affectation";
        drawDots(true);
        message(`${changes} observation(s) affectée(s) ou réaffectée(s).`);
        refreshControls();
        return changes;
    }

    function updateCentres() {
        let maxMove = 0;
        centres.forEach((c, j) => {
            const group = points.filter((_, i) => labels[i] === j);
            if (!group.length) return;
            const target = isL1() ?
                {x:d3.median(group, p => p.x),
                    y:d3.median(group, p => p.y)} :
                {x:d3.mean(group, p => p.x),
                    y:d3.mean(group, p => p.y)};
            maxMove = Math.max(maxMove, ML.dist(c, target));
            c.x = target.x;
            c.y = target.y;
        });
        iteration++;
        phase = "miseajour";
        drawCentres(true);
        refreshControls();
        message(`Itération ${iteration} : déplacement des centres vers ` +
            (isL1() ? "la médiane" : "la moyenne") + " de leur groupe.");
        return maxMove;
    }

    function finish() {
        stop();
        phase = "convergence";
        refreshControls();
        message(`Partition stabilisée après ${iteration} itération(s). ` +
            "Vous pouvez comparer d'autres initialisations.");
    }

    function advance() {
        if (!running) return;
        if (nextAction === "assign") {
            const changed = assignment();
            if (changed === 0 && iteration > 0) {
                finish();
                return;
            }
            nextAction = "update";
        } else {
            const movement = updateCentres();
            nextAction = "assign";
            if (movement < 1e-7 || iteration >= maxIterations) {
                // La partition reste celle de l'affectation précédente.
                timer = setTimeout(finish, 700);
                return;
            }
        }
        timer = setTimeout(advance, 1100);
    }

    function togglePlay() {
        if (running) {
            stop();
            refreshControls();
            message("Animation en pause. Cliquez sur Reprendre.");
            return;
        }
        if (centres.length !== kValue()) return;
        if (phase === "convergence") resetAssignments();
        running = true;
        refreshControls();
        advance();
    }

    $("km-random").addEventListener("click", randomCenters);
    $("km-manual").addEventListener("click", manualCenters);
    $("km-reset").addEventListener("click", randomCenters);
    methodInput.addEventListener("change", randomCenters);
    play.addEventListener("click", togglePlay);
    kInput.addEventListener("input", randomCenters);
    window.mlSetK = function (k) {
        kInput.value = k;
        randomCenters();
    };
    randomCenters();
}());
