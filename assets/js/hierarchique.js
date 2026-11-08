"use strict";
// Construction agglomérative, dendrogramme synchronisé et choix de K.
// Aucune bibliothèque de clustering requise : uniquement D3 pour dessiner.
(function () {
    const el = id => document.getElementById(id);
    const ui = {
        dataset: el("hc-dataset"), linkage: el("hc-linkage"),
        target: el("hc-target"), targetValue: el("hc-target-value"),
        heightScale: el("hc-height-scale"),
        play: el("hc-play"), step: el("hc-step"), reset: el("hc-reset"),
        speed: el("hc-speed"), progress: el("hc-progress"),
        progressValue: el("hc-progress-value"),
        count: el("hc-group-count"), stepCount: el("hc-step-count"),
        cost: el("hc-cost"), costLabel: el("hc-cost-label"),
        message: el("hc-message"), explain: el("hc-metric-explain"),
        silhouette: el("hc-silhouette"), score: el("hc-silhouette-score"),
        best: el("hc-best-k"), cutNote: el("hc-cut-note")
    };
    const colors = ML.palette.concat(["#468a93", "#a86f54"]);
    const number = new Intl.NumberFormat("fr-FR", {
        maximumFractionDigits: 2
    });
    const n = 24;
    let points = [], nodes = [], history = [], root = null;
    let stepIndex = 0, timer = null;
    let scatter = null, tree = null, chart = null;
    let scores = [], bestK = null;

    // Sélection déterministe de 24 points : comparaisons reproductibles.
    function samplePoints(shape) {
        const source = ML.dataset(shape, 124);
        return Array.from({length: n}, (_, i) => {
            const p = source[Math.floor((i + 0.5) * source.length / n)];
            return {x: p.x, y: p.y};
        });
    }
    function distance(a, b) {
        return Math.hypot(a.x - b.x, a.y - b.y);
    }
    function clamp(v, low, high) {
        return Math.max(low, Math.min(high, v));
    }

    // Calcul complet de la hiérarchie : Single, Complete, Average et Ward.
    function agglomerative(observations, linkage) {
        const pairDistances = observations.map(a =>
            observations.map(b => distance(a, b)));
        const all = observations.map((p, i) => ({
            id: i, members: [i], size: 1,
            mx: p.x, my: p.y, left: null, right: null, height: 0
        }));
        let active = all.slice();
        const merges = [];
        function cost(a, b) {
            if (linkage === "ward") {
                const dx = a.mx - b.mx, dy = a.my - b.my;
                return a.size * b.size / (a.size + b.size) *
                    (dx * dx + dy * dy);
            }
            let result = linkage === "single" ? Infinity : 0;
            for (const i of a.members) {
                for (const j of b.members) {
                    const d = pairDistances[i][j];
                    if (linkage === "single") result = Math.min(result, d);
                    else if (linkage === "complete") result = Math.max(result, d);
                    else result += d;
                }
            }
            return linkage === "average" ?
                result / (a.size * b.size) : result;
        }
        while (active.length > 1) {
            let best = Infinity, ai = -1, bi = -1;
            for (let i = 0; i < active.length; i++) {
                for (let j = 0; j < i; j++) {
                    const d = cost(active[i], active[j]);
                    if (d < best - 1e-10) {
                        best = d;
                        ai = i;
                        bi = j;
                    }
                }
            }
            const a = active[bi], b = active[ai];
            const node = {
                id: all.length, left: a, right: b, height: best,
                members: a.members.concat(b.members),
                size: a.size + b.size,
                mx: (a.mx * a.size + b.mx * b.size) / (a.size + b.size),
                my: (a.my * a.size + b.my * b.size) / (a.size + b.size)
            };
            all.push(node);
            merges.push({a, b, node, cost: best});
            active = active.filter(g => g !== a && g !== b);
            active.push(node);
        }
        const leaves = [];
        function layout(node) {
            if (!node.left) {
                node.leafOrder = leaves.length;
                leaves.push(node);
                return;
            }
            layout(node.left);
            layout(node.right);
        }
        layout(active[0]);
        return {nodes: all, history: merges, root: active[0], leaves};
    }

    function maxStep() { return history.length; }
    function selectedK() { return Number(ui.target.value); }

    // Partition après un nombre quelconque de fusions.
    function groupsAfter(mergesDone) {
        const active = new Map(nodes.slice(0, n).map(node =>
            [node.id, node]));
        for (let i = 0; i < mergesDone; i++) {
            const m = history[i];
            active.delete(m.a.id);
            active.delete(m.b.id);
            active.set(m.node.id, m.node);
        }
        return Array.from(active.values()).sort((a, b) =>
            Math.min(...a.members) - Math.min(...b.members));
    }

    function makeScatter() {
        const w = 620, h = 470;
        const m = {l: 60, r: 24, t: 36, b: 54};
        const x = d3.scaleLinear().domain([0, 100]).range([m.l, w-m.r]);
        const y = d3.scaleLinear().domain([0, 100]).range([h-m.b, m.t]);
        const svg = d3.select("#hc-scatter").selectAll("svg")
            .data([0]).join("svg")
            .attr("viewBox", `0 0 ${w} ${h}`)
            .attr("role", "img")
            .attr("aria-label", "Groupes de points synchronisés avec la coupe");
        svg.selectAll("*").remove();
        const grid = svg.append("g");
        for (const v of [0, 25, 50, 75, 100]) {
            grid.append("line").attr("x1", x(v)).attr("x2", x(v))
                .attr("y1", y(0)).attr("y2", y(100))
                .attr("stroke", "#eaf0f5");
            grid.append("line").attr("x1", x(0)).attr("x2", x(100))
                .attr("y1", y(v)).attr("y2", y(v))
                .attr("stroke", "#eaf0f5");
        }
        svg.append("g").attr("transform", `translate(0,${y(0)})`)
            .call(d3.axisBottom(x).ticks(5))
            .call(g => g.selectAll("path,line").attr("stroke", "#ccd8e2"))
            .call(g => g.selectAll("text").attr("fill", "#7f90a3"));
        svg.append("g").attr("transform", `translate(${x(0)},0)`)
            .call(d3.axisLeft(y).ticks(5))
            .call(g => g.selectAll("path,line").attr("stroke", "#ccd8e2"))
            .call(g => g.selectAll("text").attr("fill", "#7f90a3"));
        const halos = svg.append("g").selectAll("circle")
            .data(points).join("circle")
            .attr("cx", p => x(p.x)).attr("cy", p => y(p.y))
            .attr("r", 8).attr("fill", "none")
            .attr("stroke", "#2d6f99").attr("stroke-width", 1.65)
            .attr("opacity", 0);
        const dots = svg.append("g").selectAll("circle.observation")
            .data(points).join("circle")
            .attr("class", "observation")
            .attr("cx", p => x(p.x)).attr("cy", p => y(p.y))
            .attr("r", 4.5).attr("fill", "#9aabba");
        dots.append("title").text((_, i) => "Observation " + (i + 1));
        return {dots, halos};
    }

    function makeTree(model) {
        const w = 620, h = 470;
        const m = {l: 60, r: 24, t: 36, b: 54};
        const x = d3.scaleLinear().domain([0, n - 1])
            .range([m.l + 8, w - m.r - 8]);
        const lastCost = model.history[model.history.length - 1].cost;
        const maxHeight = Math.max(1, lastCost);
        const mode = ui.heightScale.value;
        const byOrder = mode === "order";
        const costY = (mode === "sqrt" ? d3.scaleSqrt() :
            d3.scaleLinear())
            .domain([0, maxHeight * 1.12]).range([h - m.b, m.t]);
        const orderY = d3.scaleLinear().domain([0, n])
            .range([h - m.b, m.t]);
        function nodeY(node) {
            if (!node.left) return h - m.b;
            return byOrder ? orderY(node.id - n + 1) : costY(node.height);
        }
        function cutY(k) {
            const merged = n - k;
            if (byOrder) return orderY(merged + 0.5);
            const lo = merged > 0 ? model.history[merged-1].cost : 0;
            const hi = merged < model.history.length ?
                model.history[merged].cost : maxHeight * 1.1;
            return costY((lo + hi) / 2);
        }
        function kFromY(y) {
            if (byOrder) {
                const step = Math.round(orderY.invert(y) - 0.5);
                return clamp(n - step, 1, 10);
            }
            // Choisir la coupe dont la ligne est la plus proche.
            const available = d3.range(1, 11);
            return available.reduce((best, k) =>
                Math.abs(cutY(k) - y) < Math.abs(cutY(best) - y) ?
                    k : best, 3);
        }
        function tiedAt(k) {
            const merged = n - k;
            if (merged === 0 || merged === history.length) return false;
            const lo = history[merged - 1].cost;
            const hi = history[merged].cost;
            return Math.abs(hi - lo) < 1e-9;
        }
        const svg = d3.select("#hc-tree").selectAll("svg")
            .data([0]).join("svg")
            .attr("viewBox", `0 0 ${w} ${h}`)
            .attr("role", "img")
            .attr("aria-label", "Dendrogramme et ligne de coupe déplaçable");
        svg.selectAll("*").remove();
        model.leaves.forEach((leaf, i) => { leaf.plotX = x(i); });
        function assignX(node) {
            if (!node.left) return node.plotX;
            node.plotX = (assignX(node.left) + assignX(node.right)) / 2;
            return node.plotX;
        }
        assignX(model.root);
        const axis = svg.append("g")
            .attr("transform", `translate(${m.l - 5},0)`)
            .call(byOrder ?
                d3.axisLeft(orderY).ticks(6).tickFormat(d3.format("d")) :
                d3.axisLeft(costY).ticks(6).tickFormat(d3.format("~s")));
        axis.selectAll("path,line").attr("stroke", "#ccd8e2");
        axis.selectAll("text").attr("fill", "#63788b")
            .attr("font-size", 12);
        svg.append("text").attr("x", 12).attr("y", 17)
            .attr("fill", "#63788b").attr("font-size", 12)
            .text(byOrder ? "Fusion n°" : "Coût de fusion");
        const ticks = byOrder ? orderY.ticks(6) : costY.ticks(6);
        svg.insert("g", ":first-child").selectAll("line")
            .data(ticks).join("line")
            .attr("x1", m.l).attr("x2", w - m.r)
            .attr("y1", v => byOrder ? orderY(v) : costY(v))
            .attr("y2", v => byOrder ? orderY(v) : costY(v))
            .attr("stroke", "#eaf0f5");
        const branches = svg.append("g");
        const leaves = svg.append("g").selectAll("circle")
            .data(model.leaves).join("circle")
            .attr("cx", d => d.plotX).attr("cy", h-m.b)
            .attr("r", 3.2).attr("fill", "#99a9b8");
        svg.append("g").selectAll("text.leaf-label")
            .data(model.leaves).join("text")
            .attr("class", "leaf-label").attr("x", d => d.plotX)
            .attr("y", h - 22).attr("text-anchor", "middle")
            .attr("font-size", 11).attr("fill", "#64798a")
            .text(d => d.id + 1);
        function pathFor(merge) {
            const a = merge.a, b = merge.b;
            const yy = nodeY(merge.node);
            return `M${a.plotX},${nodeY(a)}V${yy}` +
                `H${b.plotX}V${nodeY(b)}`;
        }
        // La coupe est affichée au-dessus des branches. La zone de prise
        // suit sa hauteur et autorise un déplacement à la souris / au doigt.
        const cut = svg.append("g").attr("class", "hc-cut");
        const cutLine = cut.append("line")
            .attr("x1", m.l - 4).attr("x2", w - m.r)
            .attr("stroke", "#d08644").attr("stroke-width", 2)
            .attr("stroke-dasharray", "6 4")
            .style("pointer-events", "none");
        const cutLabel = cut.append("text")
            .attr("x", w - m.r - 6).attr("text-anchor", "end")
            .attr("font-size", 12).attr("font-weight", 700)
            .attr("fill", "#b37138")
            .style("pointer-events", "none");
        const grab = cut.append("rect")
            .attr("x", m.l).attr("width", w - m.r - m.l)
            .attr("height", 24)
            .attr("fill", "transparent")
            .attr("class", "hc-cut-grab")
            .attr("role", "slider")
            .attr("tabindex", 0)
            .attr("aria-label", "Déplacer la coupe du dendrogramme")
            .attr("aria-valuemin", 1).attr("aria-valuemax", 10)
            .style("cursor", "ns-resize")
            .style("touch-action", "none");
        grab.append("title").text("Faites glisser pour choisir K");
        grab.call(d3.drag().on("start drag", event => {
            setCutK(kFromY(event.y));
        }));
        grab.on("keydown", event => {
            if (event.key === "ArrowUp" || event.key === "ArrowDown") {
                event.preventDefault();
                setCutK(clamp(selectedK() +
                    (event.key === "ArrowUp" ? -1 : 1), 1, 10));
            }
        });
        function showCut(k, visible) {
            cut.style("display", visible ? null : "none");
            if (!visible) return;
            const yy = cutY(k);
            cutLine.attr("y1", yy).attr("y2", yy);
            cutLabel.attr("y", yy - 8).text(`Coupe : K = ${k}`);
            grab.attr("y", yy - 12).attr("aria-valuenow", k);
        }
        return {branches, leaves, pathFor, showCut, byOrder, tiedAt};
    }

    function colorGroups(groups) {
        const map = new Map();
        let idx = 0;
        for (const group of groups) {
            const color = group.size === 1 ? "#a0afbc" :
                colors[idx++ % colors.length];
            group.members.forEach(i => map.set(i, color));
        }
        return map;
    }

    // Silhouette moyenne : singleton -> 0 ; distances euclidiennes.
    function silhouetteFor(k) {
        const groups = groupsAfter(n-k);
        const groupOf = Array(n);
        groups.forEach((g, j) => g.members.forEach(i => {
            groupOf[i] = j;
        }));
        const matrix = points.map(a => points.map(b => distance(a,b)));
        let sum = 0;
        for (let i=0; i<n; i++) {
            const own = groups[groupOf[i]].members;
            if (own.length === 1) continue;
            const a = own.reduce((s,j) => s + (j===i ? 0 :
                matrix[i][j]), 0) / (own.length-1);
            let b = Infinity;
            groups.forEach((g,j) => {
                if (j === groupOf[i]) return;
                const mean = g.members.reduce((s,id) =>
                    s + matrix[i][id], 0) / g.members.length;
                b = Math.min(b, mean);
            });
            const denom = Math.max(a,b);
            sum += denom > 0 ? (b-a)/denom : 0;
        }
        return sum / n;
    }

    function makeSilhouette() {
        const w=900, h=235, m={l:54,r:22,t:24,b:43};
        const x=d3.scaleLinear().domain([2,10])
            .range([m.l,w-m.r]);
        // Échelle stable pour comparer les différentes liaisons.
        const y=d3.scaleLinear().domain([-1,1])
            .range([h-m.b,m.t]);
        const svg=d3.select(ui.silhouette).selectAll("svg")
            .data([0]).join("svg")
            .attr("viewBox", `0 0 ${w} ${h}`)
            .attr("role", "img")
            .attr("aria-label", "Silhouette moyenne pour K de 2 à 10");
        svg.selectAll("*").remove();
        svg.append("g").attr("transform",`translate(0,${h-m.b})`)
            .call(d3.axisBottom(x).ticks(8).tickFormat(d3.format("d")));
        svg.append("g").attr("transform",`translate(${m.l},0)`)
            .call(d3.axisLeft(y).ticks(4));
        svg.selectAll(".domain,.tick line").attr("stroke","#d5e0e8");
        svg.selectAll(".tick text").attr("fill","#64798a");
        svg.append("line")
            .attr("x1",m.l).attr("x2",w-m.r)
            .attr("y1",y(0)).attr("y2",y(0))
            .attr("stroke","#d5e0e8").attr("stroke-dasharray","4 4");
        svg.append("text").attr("x",w/2).attr("y",h-5)
            .attr("fill","#64798a").attr("text-anchor","middle")
            .attr("font-size",12).text("Nombre de groupes K");
        const line = d3.line()
            .x(d => x(d.k)).y(d => y(d.score));
        svg.append("path").datum(scores)
            .attr("d",line).attr("fill","none")
            .attr("stroke","#4782ab").attr("stroke-width",2.2);
        const selectedLine = svg.append("line")
            .attr("stroke","#d08644").attr("stroke-dasharray","4 4")
            .attr("y1",m.t).attr("y2",h-m.b);
        const dots = svg.append("g").selectAll("circle")
            .data(scores).join("circle")
            .attr("cx", d=>x(d.k)).attr("cy",d=>y(d.score))
            .attr("r",5).attr("fill","#4782ab")
            .attr("stroke","white").attr("stroke-width",1.5)
            .attr("tabindex",0).attr("role","button")
            .attr("aria-label",d=>`K = ${d.k}, silhouette ${d.score.toFixed(2)}`)
            .style("cursor","pointer")
            .on("click",(_,d)=>setCutK(d.k))
            .on("keydown",(event,d)=>{
                if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setCutK(d.k);
                }
            });
        dots.append("title").text(d =>
            `K = ${d.k} · silhouette = ${number.format(d.score)}`);
        return {
            update(k) {
                selectedLine.style("display", k === 1 ? "none" : null)
                    .attr("x1", x(k)).attr("x2",x(k));
                dots.attr("r",d=>d.k===k?8:5)
                    .attr("fill",d=>d.k===k?"#d08644":"#4782ab");
            }
        };
    }

    function pause() {
        if (timer !== null) {
            clearInterval(timer);
            timer = null;
        }
    }
    function render(animate=false) {
        const finished = stepIndex === maxStep();
        const partStep = finished ? n - selectedK() : stepIndex;
        const groups = groupsAfter(partStep);
        const colorFor = colorGroups(groups);
        const last = !finished && stepIndex > 0 ?
            history[stepIndex-1] : null;
        const highlighted = new Set(last ? last.node.members : []);
        scatter.dots.interrupt();
        (animate ? scatter.dots.transition().duration(230) : scatter.dots)
            .attr("fill", (_,i) => colorFor.get(i));
        scatter.halos.attr("opacity",(_,i)=>
            highlighted.has(i) ? 0.72 : 0);
        const displayed = history.slice(0,stepIndex);
        const branches = tree.branches.selectAll("path.merge-line")
            .data(displayed,d=>d.node.id);
        branches.exit().interrupt().remove();
        const entered = branches.enter().append("path")
            .attr("class","merge-line")
            .attr("d",tree.pathFor)
            .attr("opacity",animate?0:0.94);
        entered.append("title").text(m=>
            `Fusion de ${m.a.size} et ${m.b.size} observations ; coût ${number.format(m.cost)}`);
        if (animate) entered.transition().duration(280)
            .attr("opacity",0.94);
        tree.branches.selectAll("path.merge-line")
            .attr("stroke",(d,i)=>
                i===stepIndex-1&&!finished ? "#246a9c":"#849bb0")
            .attr("stroke-width",(d,i)=>
                i===stepIndex-1&&!finished ? 3 : 1.65);
        tree.leaves.attr("fill", d=>colorFor.get(d.id));
        tree.showCut(selectedK(), finished);
        chart.update(finished ? selectedK() : -1);
        ui.count.textContent=String(groups.length);
        ui.stepCount.textContent=`${stepIndex} / ${maxStep()}`;
        ui.cost.textContent=stepIndex ?
            number.format(history[stepIndex-1].cost) : "—";
        ui.progress.max=maxStep();
        ui.progress.value=stepIndex;
        ui.progressValue.textContent=String(stepIndex);
        ui.targetValue.textContent=String(selectedK());
        ui.step.disabled=finished;
        ui.play.textContent=timer!==null ? "Pause" :
            finished ? "Rejouer" : "Lancer";
        ui.best.textContent=`Maximum observé : K = ${bestK.k} (${number.format(bestK.score)})`;
        if (finished) {
            ui.score.textContent=selectedK()===1 ?
                "Non définie" : number.format(scores[selectedK()-2].score);
            ui.message.textContent=`Hiérarchie construite : `+
                `${groups.length} groupe(s) avec la coupe K = ${selectedK()}. `+
                "Modifiez K, déplacez la ligne orange ou sélectionnez un point de la courbe.";
            ui.cutNote.textContent=(!tree.byOrder &&
                tree.tiedAt(selectedK())) ?
                "Attention : deux fusions ont la même hauteur. La coupe est " +
                "définie par l'ordre des fusions ; aucune hauteur unique " +
                "ne permet de distinguer exactement ces K groupes." :
                "Silhouette : moyenne des coefficients individuels calculés " +
                "avec la distance euclidienne. Pour K = 1, elle n'est pas définie.";
        } else {
            ui.score.textContent="—";
            ui.cutNote.textContent="Construisez d'abord le dendrogramme pour " +
                "visualiser la coupe et la partition choisie.";
            ui.message.textContent=last ?
                `Fusion ${stepIndex} : deux groupes de ${last.a.size} et `+
                `${last.b.size} observations sont réunis. `+
                `${groups.length} groupes restent à fusionner.` :
                "Chaque observation constitue son propre groupe. " +
                "Cliquez sur Lancer ou Fusion suivante.";
        }
    }
    function setCutK(k) {
        pause();
        ui.target.value=clamp(k,1,10);
        // La sélection d'une coupe affiche l'arbre construit intégralement.
        stepIndex=maxStep();
        render(false);
    }
    function advance() {
        if (stepIndex < maxStep()) stepIndex++;
        if (stepIndex >= maxStep()) pause();
        render(true);
    }
    function play() {
        if (timer !== null) {
            pause();
            render(false);
            return;
        }
        if (stepIndex === maxStep()) {
            stepIndex=0;
            render(false);
        }
        advance();
        if (stepIndex < maxStep()) {
            timer=setInterval(advance,Number(ui.speed.value));
            render(false);
        }
    }
    function reset(rebuild) {
        pause();
        if (rebuild) {
            points=samplePoints(ui.dataset.value);
            const model=agglomerative(points,ui.linkage.value);
            nodes=model.nodes;
            history=model.history;
            root=model.root;
            scores=d3.range(2,11).map(k=>({k,score:silhouetteFor(k)}));
            bestK=scores.reduce((a,b)=>b.score>a.score?b:a);
            scatter=makeScatter();
            tree=makeTree(model);
            chart=makeSilhouette();
        }
        stepIndex=0;
        const ward=ui.linkage.value==="ward";
        ui.costLabel.textContent=ward ?
            "Dernière hausse d'inertie (unités²)" :
            "Dernière distance de liaison";
        ui.explain.textContent=ward ?
            "Avec Ward, la hauteur d'une fusion représente son augmentation " +
            "d'inertie (unités²). Les autres critères utilisent des distances." :
            "Avec cette liaison, la hauteur du dendrogramme correspond à " +
            "une distance entre groupes (unités des axes).";
        render(false);
    }
    ui.play.addEventListener("click",play);
    ui.step.addEventListener("click",()=>{
        pause(); advance();
    });
    ui.reset.addEventListener("click",()=>reset(false));
    ui.dataset.addEventListener("change",()=>reset(true));
    ui.linkage.addEventListener("change",()=>reset(true));
    ui.target.addEventListener("input",()=>setCutK(selectedK()));
    ui.speed.addEventListener("change",()=>{
        if (timer!==null) {
            pause();
            timer=setInterval(advance,Number(ui.speed.value));
            render(false);
        }
    });
    ui.progress.addEventListener("input",()=>{
        pause();
        stepIndex=Number(ui.progress.value);
        render(false);
    });
    ui.heightScale.addEventListener("change",()=>{
        pause();
        tree=makeTree({history,root,leaves:nodes.slice(0,n)
            .sort((a,b)=>a.leafOrder-b.leafOrder)});
        render(false);
    });
    document.addEventListener("visibilitychange",()=>{
        if (document.hidden) {
            pause();
            render(false);
        }
    });
    try {
        reset(true);
    } catch(error) {
        console.error(error);
        ui.message.textContent="Erreur de simulation : "+error.message;
        ui.message.style.color="#a33b31";
    }
}());
