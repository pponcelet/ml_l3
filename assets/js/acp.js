"use strict";
// ACP : données véritablement 3D, plan orientable et projection 2D.
// Aucun moteur 3D externe : D3.js dessine une scène orthographique en SVG.
(function () {
    const container = document.getElementById("pca-space");
    if (!container) return;
    if (typeof d3 === "undefined") {
        container.textContent =
            "D3.js n'a pas pu être chargé. Vérifiez la connexion Internet.";
        return;
    }

    const $ = id => document.getElementById(id);
    const blue = "#447aa6";
    const orange = "#d28d59";
    const green = "#44957c";
    const W = 560, H = 420;
    const vec = (x, y, z) => [x, y, z];
    const add = (a, b) => a.map((v, i) => v + b[i]);
    const sub = (a, b) => a.map((v, i) => v - b[i]);
    const mul = (v, s) => v.map(x => x * s);
    const dot = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0);
    const cross = (a, b) => [
        a[1] * b[2] - a[2] * b[1],
        a[2] * b[0] - a[0] * b[2],
        a[0] * b[1] - a[1] * b[0]
    ];
    const norm = a => Math.sqrt(dot(a, a));
    const unit = a => mul(a, 1 / Math.max(1e-12, norm(a)));
    const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
    const degrees = radians => radians * 180 / Math.PI;
    const radians = degrees => degrees * Math.PI / 180;
    const pct = ratio => d3.format(".1%")(ratio);
    const variance = (direction, covariance) =>
        dot(direction, covariance.map(row => dot(row, direction)));

    let data = [];
    let pca = null;
    let normal = [0, 0, 1];
    let selectedPoint = -1;
    let hoveredPoint = -1;
    let camera = {yaw: -0.65, elevation: 0.55};
    let sceneScale = 1;
    let chartRadius = 45;
    let optimalAnimation = null;

    // Petit générateur déterministe, indépendant des bibliothèques externes.
    function normals(seed) {
        let state = seed >>> 0;
        function random() {
            state = (Math.imul(1664525, state) + 1013904223) >>> 0;
            return (state + .5) / 4294967296;
        }
        return function () {
            const r = Math.sqrt(-2 * Math.log(random()));
            return r * Math.cos(2 * Math.PI * random());
        };
    }

    function makeData(kind) {
        const gaussian = normals(42871);
        const points = d3.range(50).map(function (i) {
            const a = gaussian(), b = gaussian(), c = gaussian();
            let x, y, z;
            if (kind === "plane") {
                x = 19 * a + 5 * b;
                y = 3 * a + 16 * b;
                z = .50 * x - .38 * y + 1.6 * c;
            } else if (kind === "inclined") {
                x = 17 * a + 4 * b;
                y = 6 * a + 16 * b;
                z = .95 * x + .75 * y + 2.5 * c;
            } else if (kind === "line") {
                x = 22 * a + 2 * b;
                y = 11 * a + 6 * b;
                z = -6 * a + 3 * c;
            } else {
                x = 15 * a;
                y = 15 * b;
                z = 15 * c;
            }
            return {id: i, raw: vec(x, y, z)};
        });
        const mean = [0, 1, 2].map(i =>
            d3.mean(points, p => p.raw[i]));
        return points.map(p => ({id: p.id, v: sub(p.raw, mean)}));
    }

    function covariance(points) {
        const matrix = Array.from({length: 3}, () => [0, 0, 0]);
        for (const p of points) {
            for (let i = 0; i < 3; i++) {
                for (let j = 0; j < 3; j++) {
                    matrix[i][j] += p.v[i] * p.v[j];
                }
            }
        }
        return matrix.map(row => row.map(x => x / (points.length - 1)));
    }

    // Diagonalisation de Jacobi d'une matrice de covariance 3 x 3 symétrique.
    function principalComponents(cov) {
        const a = cov.map(row => row.slice());
        const v = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
        for (let step = 0; step < 60; step++) {
            let p = 0, q = 1, largest = Math.abs(a[0][1]);
            for (const [i, j] of [[0, 2], [1, 2]]) {
                if (Math.abs(a[i][j]) > largest) {
                    p = i; q = j; largest = Math.abs(a[i][j]);
                }
            }
            if (largest < 1e-10) break;
            const angle = .5 * Math.atan2(
                2 * a[p][q], a[q][q] - a[p][p]);
            const c = Math.cos(angle), s = Math.sin(angle);
            const app = a[p][p], aqq = a[q][q], apq = a[p][q];
            a[p][p] = c * c * app - 2 * s * c * apq + s * s * aqq;
            a[q][q] = s * s * app + 2 * s * c * apq + c * c * aqq;
            a[p][q] = 0; a[q][p] = 0;
            for (let k = 0; k < 3; k++) {
                if (k !== p && k !== q) {
                    const akp = a[k][p], akq = a[k][q];
                    a[k][p] = a[p][k] = c * akp - s * akq;
                    a[k][q] = a[q][k] = s * akp + c * akq;
                }
                const vkp = v[k][p], vkq = v[k][q];
                v[k][p] = c * vkp - s * vkq;
                v[k][q] = s * vkp + c * vkq;
            }
        }
        const eig = d3.range(3).map(i => ({
            value: Math.max(0, a[i][i]),
            vector: unit(v.map(row => row[i]))
        })).sort((a, b) => b.value - a.value);
        const e1 = eig[0].vector;
        let e2 = eig[1].vector;
        let e3 = unit(cross(e1, e2));
        if (e3[2] < 0) {
            e2 = mul(e2, -1);
            e3 = mul(e3, -1);
        }
        const eigenvalues = eig.map(e => e.value);
        const total = eigenvalues.reduce((a, b) => a + b, 0);
        return {cov, e1, e2, e3, eigenvalues, total};
    }

    // Un plan est défini par une normale : inclinaison / orientation.
    function normalFromAngles(tilt, azimuth) {
        return vec(
            Math.sin(radians(tilt)) * Math.cos(radians(azimuth)),
            Math.sin(radians(tilt)) * Math.sin(radians(azimuth)),
            Math.cos(radians(tilt))
        );
    }
    function slidersFromNormal() {
        const tilt = degrees(Math.acos(clamp(normal[2], -1, 1)));
        const azimuth = degrees(Math.atan2(normal[1], normal[0]));
        $("pca-tilt").value = tilt;
        $("pca-azimuth").value = azimuth;
        $("pca-tilt-value").textContent = `${Math.round(tilt)}°`;
        $("pca-azimuth-value").textContent = `${Math.round(azimuth)}°`;
    }
    function frameForPlane() {
        // Le premier axe suit la projection de PC1 sur le plan choisi.
        let u = sub(pca.e1, mul(normal, dot(pca.e1, normal)));
        if (norm(u) < 1e-7) {
            u = sub(pca.e2, mul(normal, dot(pca.e2, normal)));
        }
        u = unit(u);
        let v = unit(cross(normal, u));
        if (dot(v, pca.e2) < 0) {
            u = mul(u, -1);
            v = mul(v, -1);
        }
        return {u, v};
    }
    function projectionOf(point, u, v) {
        const s = dot(point, u), t = dot(point, v);
        return {s, t, foot: add(mul(u, s), mul(v, t))};
    }

    const space = d3.select("#pca-space").append("svg")
        .attr("viewBox", `0 0 ${W} ${H}`)
        .attr("role", "img")
        .attr("tabindex", 0)
        .attr("aria-label", "Nuage de points 3D. Faites glisser pour tourner la caméra ; utilisez les flèches du clavier pour l'orienter.");
    const projected = d3.select("#pca-projection").append("svg")
        .attr("viewBox", `0 0 ${W} ${H}`)
        .attr("role", "img")
        .attr("aria-label", "Projection en deux dimensions sur le plan sélectionné");
    const worldLayer = space.append("g");
    const planeLayer = space.append("g");
    const connectorsLayer = space.append("g");
    const feetLayer = space.append("g");
    const dataLayer = space.append("g");
    const labelsLayer = space.append("g");
    const graphLayer = projected.append("g");
    const dotsLayer = projected.append("g");
    const ratioChart = d3.select("#pca-spectrum").append("svg")
        .attr("viewBox", "0 0 640 220")
        .attr("role", "img")
        .attr("aria-label", "Pourcentage de variance expliqué par PC1, PC2 et PC3");
    const miniChart = d3.select("#pca-mini-chart").append("svg")
        .attr("viewBox", "0 0 680 240")
        .attr("role", "img")
        .attr("aria-label", "Projection d'un nuage de points du plan sur une droite orientable");

    function projectView(point) {
        const ca = Math.cos(camera.yaw), sa = Math.sin(camera.yaw);
        const ce = Math.cos(camera.elevation);
        const se = Math.sin(camera.elevation);
        const right = [ca, sa, 0];
        const up = [-se * sa, se * ca, ce];
        const forward = cross(right, up);
        return {
            x: W / 2 + sceneScale * dot(point, right),
            y: H / 2 - sceneScale * dot(point, up),
            depth: dot(point, forward)
        };
    }
    function segment(start, end) {
        const a = projectView(start), b = projectView(end);
        return {x1: a.x, y1: a.y, x2: b.x, y2: b.y};
    }
    function lineAttributes(selection) {
        return selection
            .attr("x1", d => d.x1).attr("y1", d => d.y1)
            .attr("x2", d => d.x2).attr("y2", d => d.y2);
    }
    function activePoint() {
        return hoveredPoint >= 0 ? hoveredPoint : selectedPoint;
    }
    function updatePointFocus() {
        const active = activePoint();
        for (const chart of [space, projected]) {
            chart.selectAll("circle.pca-point")
                .attr("r", d => d.id === active ? 6.6 : 3.1)
                .attr("opacity", d => active < 0 || d.id === active ? .92 : .28)
                .attr("stroke", d => d.id === active ? "#214c6c" : "#fff")
                .attr("stroke-width", d => d.id === active ? 2 : .6);
        }
        const p = data.find(d => d.id === active);
        const status = $("pca-focus-status");
        if (!status) return;
        if (!p) {
            status.textContent = "Cliquez sur une observation pour suivre sa projection sur le plan et dans la vue 2D.";
            return;
        }
        const {u, v} = frameForPlane();
        const proj = projectionOf(p.v, u, v);
        const delta = norm(sub(p.v, proj.foot));
        const fmt = x => d3.format(".1f")(x);
        status.textContent = `Observation ${p.id + 1} : ` +
            `3D (${p.v.map(fmt).join(" ; ")}) · ` +
            `2D (${fmt(proj.s)} ; ${fmt(proj.t)}) · ` +
            `distance au plan : ${fmt(delta)}.`;
    }
    function focusPoint(id) {
        if (hoveredPoint === id) return;
        hoveredPoint = id;
        render();
    }
    function choosePoint(id) {
        selectedPoint = selectedPoint === id ? -1 : id;
        hoveredPoint = -1;
        render();
    }

    function render3D(projections, u, v, isOptimal) {
        const extent = chartRadius * .66;
        const uv = (a, b) => add(mul(u, a), mul(v, b));
        const corners = [uv(-extent,-extent), uv(extent,-extent),
            uv(extent,extent), uv(-extent,extent)];
        const path = d3.line().x(d => projectView(d).x)
            .y(d => projectView(d).y).curve(d3.curveLinearClosed);
        planeLayer.selectAll("path.plane-background").data([corners])
            .join("path").attr("class", "plane-background")
            .attr("d", path).attr("fill", "#7bb5d1")
            .attr("fill-opacity", .17).attr("stroke", "#5f9abc")
            .attr("stroke-width", 1.6);
        const gridSegments = [];
        [-.5, 0, .5].forEach(f => {
            gridSegments.push(segment(uv(-extent,extent*f), uv(extent,extent*f)));
            gridSegments.push(segment(uv(extent*f,-extent), uv(extent*f,extent)));
        });
        lineAttributes(planeLayer.selectAll("line.plane-grid")
            .data(gridSegments).join("line")
            .attr("class","plane-grid")
            .attr("stroke", "#6ba4c3").attr("stroke-width", .75)
            .attr("stroke-opacity", .45));
        const axes = [
            {a: vec(0,0,0), b: vec(extent,0,0), name:"x"},
            {a: vec(0,0,0), b: vec(0,extent,0), name:"y"},
            {a: vec(0,0,0), b: vec(0,0,extent), name:"z"}
        ];
        lineAttributes(worldLayer.selectAll("line.world-axis")
            .data(axes).join("line").attr("class","world-axis")
            .each(function (d) {d3.select(this).datum({...d, ...segment(d.a,d.b)});})
            .attr("stroke", "#7a8f9f").attr("stroke-width",2.3));
        worldLayer.selectAll("text.axis-label").data(axes).join("text")
            .attr("class","axis-label")
            .attr("x",d=>projectView(d.b).x+6)
            .attr("y",d=>projectView(d.b).y-6)
            .attr("font-size",14).attr("font-weight",700).attr("fill", "#586d7d")
            .text(d=>d.name);
        const centerAxes = [
            {a:uv(-extent,0),b:uv(extent,0),color:orange},
            {a:uv(0,-extent),b:uv(0,extent),color:green}
        ];
        lineAttributes(planeLayer.selectAll("line.plane-axis")
            .data(centerAxes.map(d=>({...d,...segment(d.a,d.b)})))
            .join("line").attr("class","plane-axis")
            .attr("stroke",d=>d.color).attr("stroke-width",3.4));
        const planeAxisLabels = [
            {label: isOptimal ? "PC1" : "Axe 1", color: orange,
                pos: uv(extent * 1.02, 0)},
            {label: isOptimal ? "PC2" : "Axe 2", color: green,
                pos: uv(0, extent * 1.02)}
        ];
        labelsLayer.selectAll("text.pca-plane-label")
            .data(planeAxisLabels).join("text")
            .attr("class", "pca-plane-label")
            .attr("x", d => projectView(d.pos).x + 7)
            .attr("y", d => projectView(d.pos).y - 7)
            .attr("font-size", 14)
            .attr("font-weight", 750)
            .attr("stroke", "#fff")
            .attr("stroke-width", 3.4)
            .attr("paint-order", "stroke")
            .attr("fill", d => d.color)
            .attr("pointer-events", "none")
            .text(d => d.label);
        const active = activePoint();
        const sample = projections.filter(d =>
            ($("pca-show-projections").checked && d.id % 3 === 0) ||
            d.id === active);
        lineAttributes(connectorsLayer.selectAll("line.pca-connector")
            .data(sample.map(d => ({...d, ...segment(d.v, d.foot)})),
                d => d.id)
            .join("line")
            .attr("class", "pca-connector")
            .attr("stroke", d => d.id === active ? "#526779" : "#a4b3bf")
            .attr("stroke-opacity", d => d.id === active ? .95 : .45)
            .attr("stroke-dasharray", "4 3")
            .attr("stroke-width", d => d.id === active ? 2 : .85)
            .attr("pointer-events", "none"));
        feetLayer.selectAll("circle.pca-foot")
            .data(sample, d=>d.id).join("circle")
            .attr("class", "pca-foot")
            .attr("cx",d=>projectView(d.foot).x)
            .attr("cy",d=>projectView(d.foot).y)
            .attr("r",d=>d.id === active ? 5 : 2.1)
            .attr("fill", "#8497a7")
            .attr("stroke",d=>d.id === active ? "#fff" : "none")
            .attr("stroke-width",1.5)
            .attr("opacity",d=>d.id === active ? 1 : .5)
            .attr("pointer-events", "none");
        const ordered = projections.slice().sort((a,b) =>
            projectView(a.v).depth - projectView(b.v).depth);
        dataLayer.selectAll("circle.pca-point")
            .data(ordered,d=>d.id).join("circle")
            .attr("class","pca-point").attr("data-id",d=>d.id)
            .attr("cx",d=>projectView(d.v).x)
            .attr("cy",d=>projectView(d.v).y)
            .attr("fill",blue).attr("stroke","#fff")
            .attr("stroke-width",.6)
            .on("mouseenter",(event,d)=>focusPoint(d.id))
            .on("mouseleave",()=>focusPoint(-1))
            .on("click",(event,d)=>{
                event.stopPropagation();
                choosePoint(d.id);
            });
        updatePointFocus();
    }
    function render2D(projections, isOptimal) {
        const max = chartRadius;
        const sx = d3.scaleLinear().domain([-max,max]).range([53,W-24]);
        const sy = d3.scaleLinear().domain([-max,max]).range([H-49,23]);
        graphLayer.selectAll("*").remove();
        const grid = graphLayer.append("g");
        for (const t of sx.ticks(5)) {
            grid.append("line").attr("x1",sx(t)).attr("x2",sx(t))
                .attr("y1",23).attr("y2",H-49)
                .attr("stroke","#e7edf2");
            grid.append("line").attr("y1",sy(t)).attr("y2",sy(t))
                .attr("x1",53).attr("x2",W-24)
                .attr("stroke","#e7edf2");
        }
        grid.append("g").attr("transform",`translate(0,${H-49})`)
            .call(d3.axisBottom(sx).ticks(5));
        grid.append("g").attr("transform","translate(53,0)")
            .call(d3.axisLeft(sy).ticks(5));
        graphLayer.append("text").attr("x",W/2).attr("y",H-9)
            .attr("text-anchor","middle").attr("font-size",13)
            .attr("font-weight",700)
            .attr("fill", orange)
            .text(isOptimal ? "Première composante (PC1)" : "Premier axe du plan");
        graphLayer.append("text").attr("transform",`translate(16,${H/2}) rotate(-90)`)
            .attr("text-anchor","middle").attr("font-size",13)
            .attr("font-weight",700)
            .attr("fill", green)
            .text(isOptimal ? "Deuxième composante (PC2)" : "Second axe du plan");
        dotsLayer.selectAll("circle.pca-point")
            .data(projections,d=>d.id).join("circle")
            .attr("class","pca-point")
            .attr("cx",d=>sx(d.s)).attr("cy",d=>sy(d.t))
            .attr("fill",blue).attr("stroke","#fff")
            .attr("stroke-width",.6)
            .on("mouseenter",(event,d)=>focusPoint(d.id))
            .on("mouseleave",()=>focusPoint(-1))
            .on("click",(event,d)=>{
                event.stopPropagation();
                choosePoint(d.id);
            });
        updatePointFocus();
    }
    function render() {
        if (!pca) return;
        const {u,v} = frameForPlane();
        const projections = data.map(p => ({
            id:p.id, v:p.v, ...projectionOf(p.v, u, v)
        }));
        const isOptimal = Math.abs(dot(normal,pca.e3)) > .99998;
        render3D(projections,u,v,isOptimal);
        render2D(projections,isOptimal);
        const varOne = variance(u,pca.cov);
        const varTwo = variance(v,pca.cov);
        const fraction = clamp((varOne+varTwo)/pca.total, 0, 1);
        $("pca-kept").textContent = pct(fraction);
        $("pca-lost").textContent = pct(1-fraction);
        $("pca-axis-one").textContent = pct(varOne/pca.total);
        $("pca-axis-two").textContent = pct(varTwo/pca.total);
        slidersFromNormal();
        return isOptimal;
    }

    function renderSpectrum() {
        ratioChart.selectAll("*").remove();
        const limit = Number($("pca-n-components").value);
        const items = pca.eigenvalues.map((value,i) => ({
            name: `PC${i+1}`, share: value/pca.total, index:i+1
        }));
        const xs = d3.scaleBand().domain(items.map(d=>d.name))
            .range([140,570]).padding(.57);
        const ys = d3.scaleLinear().domain([0,1]).range([169,26]);
        ratioChart.append("g").attr("transform","translate(0,169)")
            .call(d3.axisBottom(xs));
        ratioChart.append("g").attr("transform","translate(140,0)")
            .call(d3.axisLeft(ys).ticks(4).tickFormat(d3.format(".0%")));
        ratioChart.selectAll("rect").data(items).join("rect")
            .attr("x",d=>xs(d.name)).attr("y",d=>ys(d.share))
            .attr("width",xs.bandwidth()).attr("height",d=>169-ys(d.share))
            .attr("rx",3).attr("fill",d=>d.index<=limit?blue:"#becbd5");
        ratioChart.selectAll("text.pca-bar-label").data(items).join("text")
            .attr("class","pca-bar-label")
            .attr("x",d=>xs(d.name)+xs.bandwidth()/2)
            .attr("y",d=>ys(d.share)-8)
            .attr("text-anchor","middle").attr("font-size",13)
            .attr("font-weight",650).attr("fill","#435e76")
            .text(d=>pct(d.share));
        const cumulative = items.slice(0,limit).reduce((a,d)=>a+d.share,0);
        $("pca-spectrum-status").textContent =
            `${limit} composante${limit>1?"s":""} : ` +
            `${pct(cumulative)} de la variance totale conservée ` +
            `(passage de 3D à ${limit}D).`;
    }

    function renderMini() {
        if (!pca) return;
        const angle = radians(Number($("pca-mini-angle").value));
        const ca = Math.cos(angle), sa = Math.sin(angle);
        $("pca-mini-angle-value").textContent = `${Math.round(degrees(angle))}°`;
        const share = (pca.eigenvalues[0]*ca*ca +
            pca.eigenvalues[1]*sa*sa) /
            (pca.eigenvalues[0]+pca.eigenvalues[1]);
        $("pca-mini-ratio").textContent = pct(share);
        const r = chartRadius;
        const sx = d3.scaleLinear().domain([-r,r]).range([28,298]);
        const sy = d3.scaleLinear().domain([-r,r]).range([217,20]);
        const horizontal = d3.scaleLinear().domain([-r,r]).range([371,650]);
        const observations = data.map(p=>{
            const a = dot(p.v,pca.e1), b = dot(p.v,pca.e2);
            const t = a*ca+b*sa;
            return {a,b,t,px:t*ca,py:t*sa};
        });
        miniChart.selectAll("*").remove();
        miniChart.append("rect").attr("x",18).attr("y",14)
            .attr("width",290).attr("height",210)
            .attr("rx",5).attr("fill","#fafcfe")
            .attr("stroke","#e1e8ed");
        miniChart.append("line")
            .attr("x1",sx(-r*ca)).attr("y1",sy(-r*sa))
            .attr("x2",sx(r*ca)).attr("y2",sy(r*sa))
            .attr("stroke",orange).attr("stroke-width",2);
        miniChart.selectAll("line.mini-connector")
            .data(observations.filter((d,i)=>i%4===0))
            .join("line").attr("class","mini-connector")
            .attr("x1",d=>sx(d.a)).attr("y1",d=>sy(d.b))
            .attr("x2",d=>sx(d.px)).attr("y2",d=>sy(d.py))
            .attr("stroke","#94a8b6").attr("stroke-opacity",.5)
            .attr("stroke-dasharray","3 3");
        miniChart.selectAll("circle.mini-point")
            .data(observations).join("circle")
            .attr("class","mini-point")
            .attr("cx",d=>sx(d.a)).attr("cy",d=>sy(d.b))
            .attr("r",2.5).attr("fill",blue).attr("opacity",.8);
        miniChart.append("line").attr("x1",371).attr("x2",650)
            .attr("y1",124).attr("y2",124)
            .attr("stroke","#9aacba");
        miniChart.selectAll("circle.mini-projected")
            .data(observations).join("circle")
            .attr("class","mini-projected")
            .attr("cx",d=>horizontal(d.t))
            .attr("cy",(d,i)=>124+(i%11-5)*2)
            .attr("r",2.8).attr("fill",blue).attr("opacity",.75);
        miniChart.append("text").attr("x",161).attr("y",233)
            .attr("text-anchor","middle").attr("font-size",11)
            .attr("fill","#526779").text("Plan PC1–PC2");
        miniChart.append("text").attr("x",512).attr("y",233)
            .attr("text-anchor","middle").attr("font-size",11)
            .attr("fill","#526779").text("Coordonnées sur la droite");
    }

    function cancelAnimation() {
        if (optimalAnimation) {
            space.interrupt("pca-align");
            optimalAnimation = null;
        }
    }
    function setNormal(v, draw=true) {
        normal = unit(v);
        if (normal[2] < 0) normal = mul(normal,-1);
        if (draw) render();
    }
    function resetOrientation() {
        cancelAnimation();
        setNormal(normalFromAngles(40,35));
        $("pca-comment").textContent =
            "Plan réinitialisé : modifiez son orientation ou recherchez le plan optimal.";
    }
    function resetDataset() {
        cancelAnimation();
        data = makeData($("pca-dataset").value);
        pca = principalComponents(covariance(data));
        const maxDistance = d3.max(data,d=>norm(d.v));
        chartRadius = Math.max(35, maxDistance * 1.13);
        sceneScale = 174 / chartRadius;
        selectedPoint = -1;
        hoveredPoint = -1;
        normal = normalFromAngles(40,35);
        render();
        renderSpectrum();
        renderMini();
        $("pca-comment").textContent =
            "Orientez le plan, puis recherchez le plan optimal pour comparer.";
    }
    $("pca-dataset").addEventListener("change",resetDataset);
    for (const id of ["pca-tilt", "pca-azimuth"]) {
        $(id).addEventListener("input",function () {
            cancelAnimation();
            setNormal(normalFromAngles(
                Number($("pca-tilt").value),
                Number($("pca-azimuth").value)));
            $("pca-comment").textContent =
                "Le plan a changé : observez la projection et la variance conservée.";
        });
    }
    $("pca-show-projections").addEventListener("change",render);
    $("pca-reset").addEventListener("click",resetOrientation);
    $("pca-reset-camera").addEventListener("click",function () {
        camera = {yaw:-.65,elevation:.55};
        render();
        $("pca-comment").textContent =
            "Caméra réinitialisée : le plan et la variance n'ont pas changé.";
    });
    $("pca-n-components").addEventListener("change",renderSpectrum);
    $("pca-mini-angle").addEventListener("input",renderMini);

    $("pca-optimize").addEventListener("click",function () {
        cancelAnimation();
        const start = normal.slice();
        const target = pca.e3.slice();
        optimalAnimation = space.transition("pca-align")
            .duration(1050).ease(d3.easeCubicInOut)
            .tween("plane-orientation",function () {
                return function (t) {
                    setNormal(unit(add(mul(start,1-t),mul(target,t))));
                };
            }).on("end",function () {
                setNormal(target);
                $("pca-comment").textContent =
                    "Plan optimal : les axes affichés sont PC1 et PC2. " +
                    "La variance conservée est maximale parmi les plans 2D.";
                optimalAnimation = null;
            });
    });

    // Glisser dans la scène tourne uniquement la caméra.
    space.call(d3.drag().on("drag",function (event) {
        camera.yaw += event.dx * .009;
        camera.elevation = clamp(
            camera.elevation - event.dy * .007,-1.25,1.25);
        render();
        $("pca-comment").textContent =
            "Seule la caméra a tourné : la variance conservée reste identique.";
    }));
    space.on("keydown",function(event){
        const keys = {ArrowLeft:[-.09,0],ArrowRight:[.09,0],
            ArrowUp:[0,.07],ArrowDown:[0,-.07]};
        if (!keys[event.key]) return;
        event.preventDefault();
        const [da,de] = keys[event.key];
        camera.yaw += da;
        camera.elevation = clamp(camera.elevation+de,-1.25,1.25);
        render();
    });

    resetDataset();
}());
