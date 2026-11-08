"use strict";
(function () {
    const data = window.MANIFOLD_DATA;
    const root = document.getElementById("manifold-lab");
    if (!root || !data) return;

    const NS = "http://www.w3.org/2000/svg";
    const $ = (id) => document.getElementById(id);
    const panels = {
        origin: $("mf-origin-chart"),
        tsne: $("mf-tsne-chart"),
        umap: $("mf-umap-chart")
    };
    const state = {
        dataset: "swiss", perplexity: "25", neighbors: "16",
        minDist: "0.1", yaw: 0.82, pitch: 0.38,
        hovered: null, selected: null, dragging: null
    };
    const pointNodes = { origin: [], tsne: [], umap: [] };
    const threeD = { svg: null, axes: null, dots: null };
    const colors = ["#426f9b", "#4b9bb6", "#58a89a", "#c4aa67", "#d17b51"];
    let current = null;

    function svgEl(tag, attrs = {}, parent = null) {
        const node = document.createElementNS(NS, tag);
        for (const [key, value] of Object.entries(attrs)) {
            node.setAttribute(key, String(value));
        }
        if (parent) parent.appendChild(node);
        return node;
    }
    function hexParts(hex) {
        const n = parseInt(hex.slice(1), 16);
        return [(n >>> 16) & 255, (n >>> 8) & 255, n & 255];
    }
    function interpolateColor(t) {
        const scale = Math.max(0, Math.min(0.9999, t)) * (colors.length - 1);
        const i = Math.floor(scale);
        const frac = scale - i;
        const a = hexParts(colors[i]), b = hexParts(colors[i + 1]);
        return "rgb(" + a.map((c, j) => Math.round(c + (b[j] - c) * frac)).join(",") + ")";
    }
    function points3D() { return current.points; }
    function points2D(key) {
        if (key === "tsne") return current.tsne[state.perplexity];
        return current.umap[state.neighbors + "-" + state.minDist];
    }
    function activePoint() {
        return state.hovered === null ? state.selected : state.hovered;
    }

    function createPlotSvg(container, label, w, h) {
        const svg = svgEl("svg", {
            viewBox: `0 0 ${w} ${h}`, role: "img", "aria-label": label,
            preserveAspectRatio: "xMidYMid meet"
        }, container);
        return svg;
    }
    function setAttributes(el, attrs) {
        for (const [key, value] of Object.entries(attrs)) {
            el.setAttribute(key, String(value));
        }
    }
    function camera(p) {
        const [x, y, z] = p;
        const cy = Math.cos(state.yaw), sy = Math.sin(state.yaw);
        const cp = Math.cos(state.pitch), sp = Math.sin(state.pitch);
        const xr = cy * x + sy * z;
        const zr = -sy * x + cy * z;
        const yr = cp * y - sp * zr;
        const depth = sp * y + cp * zr;
        const perspective = 1 + 0.11 * depth;
        return { x: 194 + 118 * xr * perspective,
                 y: 162 - 118 * yr * perspective,
                 depth, perspective };
    }

    function drawAxes3D() {
        const g = threeD.axes;
        g.replaceChildren();
        const specs = [
            { start: [-1.05, 0, 0], end: [1.12, 0, 0], label: "x", labelOffset: [-2, 0] },
            { start: [0, -1.04, 0], end: [0, 1.1, 0], label: "y", labelOffset: [0, -4] },
            { start: [0, 0, -1.04], end: [0, 0, 1.12], label: "z", labelOffset: [3, 0] }
        ];
        for (const ax of specs) {
            const a = camera(ax.start), b = camera(ax.end);
            svgEl("line", { x1: a.x, y1: a.y, x2: b.x, y2: b.y,
                stroke: "#8294a4", "stroke-width": "1.7", opacity: "0.82" }, g);
            svgEl("text", { x: b.x + ax.labelOffset[0], y: b.y + ax.labelOffset[1],
                fill: "#526b7e", "font-size": "15", "font-weight": "700",
                "text-anchor": "middle", "dominant-baseline": "middle" }, g)
                .textContent = ax.label;
        }
    }
    function wirePoint(node, index) {
        node.dataset.point = index;
        node.addEventListener("pointerenter", () => {
            if (state.dragging) return;
            state.hovered = index;
            highlight();
        });
        node.addEventListener("pointerleave", () => {
            if (state.dragging) return;
            state.hovered = null;
            highlight();
        });
        node.addEventListener("click", (event) => {
            if (state.dragging || state.justDragged) return;
            event.stopPropagation();
            state.selected = state.selected === index ? null : index;
            highlight();
        });
    }
    function create3D() {
        const holder = panels.origin;
        holder.replaceChildren();
        const svg = createPlotSvg(holder,
            "Nuage des observations initiales en trois dimensions, orientable à la souris", 388, 326);
        svg.classList.add("mf-view-3d");
        threeD.svg = svg;
        threeD.axes = svgEl("g", {}, svg);
        threeD.dots = svgEl("g", {}, svg);
        pointNodes.origin = [];
        points3D().forEach((_, index) => {
            const dot = svgEl("circle", { r: 3.4, tabindex: 0 }, threeD.dots);
            dot.classList.add("mf-point");
            wirePoint(dot, index);
            dot.addEventListener("keydown", (event) => {
                if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    state.selected = state.selected === index ? null : index;
                    highlight();
                }
            });
            pointNodes.origin.push(dot);
        });
        svg.addEventListener("pointerdown", (event) => {
            if (event.button !== 0) return;
            state.dragging = { x: event.clientX, y: event.clientY, moved: false };
            state.justDragged = false;
            svg.setPointerCapture(event.pointerId);
        });
        svg.addEventListener("pointermove", (event) => {
            const d = state.dragging;
            if (!d) return;
            const dx = event.clientX - d.x;
            const dy = event.clientY - d.y;
            if (Math.abs(dx) + Math.abs(dy) > 1.2) d.moved = true;
            d.x = event.clientX;
            d.y = event.clientY;
            state.yaw += dx * 0.008;
            state.pitch = Math.max(-1.40, Math.min(1.40, state.pitch - dy * 0.008));
            update3D();
        });
        function release() {
            if (state.dragging) {
                state.justDragged = state.dragging.moved;
                state.dragging = null;
                if (state.justDragged) {
                    state.hovered = null;
                    highlight();
                }
            }
        }
        svg.addEventListener("pointerup", release);
        svg.addEventListener("pointercancel", release);
        svg.addEventListener("lostpointercapture", release);
        update3D();
    }
    function update3D() {
        drawAxes3D();
        const projected = points3D().map((p, i) => ({ ...camera(p), index: i }));
        projected.forEach((p) => {
            setAttributes(pointNodes.origin[p.index], {
                cx: p.x.toFixed(2), cy: p.y.toFixed(2),
                r: (3.5 + 0.45 * p.depth).toFixed(2)
            });
        });
        projected.sort((a, b) => a.depth - b.depth);
        projected.forEach((p) => threeD.dots.appendChild(pointNodes.origin[p.index]));
        highlight(false);
    }

    function create2D(panelName) {
        const holder = panels[panelName];
        holder.replaceChildren();
        const svg = createPlotSvg(holder,
            "Nuage de points en deux dimensions : " + panelName, 388, 326);
        const left = 32, top = 16, width = 337, height = 270;
        const mapX = (v) => left + (v + 1.04) / 2.08 * width;
        const mapY = (v) => top + (1.04 - v) / 2.08 * height;
        svgEl("rect", { x: left, y: top, width, height,
            fill: "#ffffff", stroke: "#e8edf2", "stroke-width": 1.2 }, svg);
        for (const t of [-0.5, 0, 0.5]) {
            svgEl("line", { x1: mapX(t), y1: top, x2: mapX(t),
                y2: top + height, stroke: "#eef2f6", "stroke-width": 1 }, svg);
            svgEl("line", { x1: left, y1: mapY(t), x2: left + width,
                y2: mapY(t), stroke: "#eef2f6", "stroke-width": 1 }, svg);
        }
        svgEl("text", { x: left + width / 2, y: 317,
            "text-anchor": "middle", fill: "#718598", "font-size": 11 }, svg)
            .textContent = "Dimension 1";
        svgEl("text", { transform: "rotate(-90)", x: -top - height / 2,
            y: 12, "text-anchor": "middle", fill: "#718598", "font-size": 11 }, svg)
            .textContent = "Dimension 2";
        const g = svgEl("g", {}, svg);
        pointNodes[panelName] = [];
        points2D(panelName).forEach((point, index) => {
            const dot = svgEl("circle", {
                cx: mapX(point[0]).toFixed(2), cy: mapY(point[1]).toFixed(2),
                r: 3.8, tabindex: 0
            }, g);
            dot.classList.add("mf-point");
            wirePoint(dot, index);
            dot.addEventListener("keydown", (event) => {
                if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    state.selected = state.selected === index ? null : index;
                    highlight();
                }
            });
            pointNodes[panelName].push(dot);
        });
    }
    function highlight(writeText = true) {
        if (!current) return;
        const active = activePoint();
        for (const arr of Object.values(pointNodes)) {
            arr.forEach((dot, idx) => {
                const isActive = idx === active;
                dot.classList.toggle("mf-highlight", isActive);
                dot.classList.toggle("mf-muted", active !== null && !isActive);
                const base = current.colors[idx];
                dot.setAttribute("fill", interpolateColor(base));
                dot.setAttribute("r", isActive ? "6.2" :
                    (arr === pointNodes.origin ? dot.dataset.baseRadius || "3.8" : "3.8"));
                dot.setAttribute("stroke", isActive ? "#233349" : "#ffffff");
                dot.setAttribute("stroke-width", isActive ? "2" : "0.65");
            });
        }
        if (!writeText) return;
        if (active === null) {
            $("mf-selected").textContent =
                "Survolez ou cliquez sur un point pour le retrouver dans les trois graphiques.";
        } else {
            const [x,y,z] = current.points[active];
            const group = state.dataset === "blobs" ? " (groupe coloré)" : "";
            $("mf-selected").textContent =
                `Observation ${active + 1}${group} — données initiales : ` +
                `(${x.toFixed(2)} ; ${y.toFixed(2)} ; ${z.toFixed(2)}). ` +
                "Le même point est mis en évidence dans les trois vues.";
        }
    }
    function neighbors(points, k) {
        return points.map((p, i) => {
            return points.map((q, j) => ({ j, d: i === j ? Infinity :
                p.reduce((sum, c, axis) => sum + (c - q[axis]) ** 2, 0) }))
                .sort((a, b) => a.d - b.d)
                .slice(0, k).map((item) => item.j);
        });
    }
    function neighborRecall(origin, projected, k) {
        const before = neighbors(origin, k);
        const after = neighbors(projected, k);
        let preserved = 0;
        for (let i = 0; i < before.length; i++) {
            const set = new Set(before[i]);
            for (const j of after[i]) if (set.has(j)) preserved++;
        }
        return Math.round(100 * preserved / (k * before.length));
    }
    function updateStats() {
        const note = $("mf-umap-note");
        if (note) note.hidden = Boolean(current.umap_reference);
        const tsne = points2D("tsne"), umap = points2D("umap");
        $("mf-count").textContent = String(current.points.length);
        $("mf-tsne-recall").textContent = neighborRecall(current.points, tsne, 8) + " %";
        $("mf-umap-recall").textContent = neighborRecall(current.points, umap, 8) + " %";
        const messages = {
            swiss: "Suivez les couleurs : comment se redistribuent les points lorsque la surface enroulée est représentée dans un plan ?",
            s_curve: "Les observations forment une surface courbée : la disposition en 2D permet-elle de suivre leur voisinage le long de cette surface ?",
            blobs: "Les trois groupes restent-ils distincts en 2D ? Leur distance relative dans le plan est-elle directement interprétable ?"
        };
        const captions = {
            swiss: "Une surface enroulée dans l’espace 3D. Les couleurs repèrent la position des observations le long du rouleau.",
            s_curve: "Une surface courbée en forme de S. Les couleurs suivent la progression le long de la courbe.",
            blobs: "Trois groupes distincts dans l’espace 3D. La même couleur représente le même groupe dans chaque vue."
        };
        $("mf-caption").textContent = captions[state.dataset];
        $("mf-observe").textContent = messages[state.dataset];
    }
    function redraw() {
        current = data[state.dataset];
        pointNodes.tsne = [];
        pointNodes.umap = [];
        create3D();
        create2D("tsne");
        create2D("umap");
        updateStats();
        highlight();
    }

    $("mf-dataset").addEventListener("change", (event) => {
        state.dataset = event.target.value;
        state.selected = null;
        state.hovered = null;
        redraw();
    });
    $("mf-perplexity").addEventListener("change", (event) => {
        state.perplexity = event.target.value;
        state.hovered = null;
        redraw();
    });
    $("mf-neighbors").addEventListener("change", (event) => {
        state.neighbors = event.target.value;
        state.hovered = null;
        redraw();
    });
    $("mf-min-dist").addEventListener("change", (event) => {
        state.minDist = event.target.value;
        state.hovered = null;
        redraw();
    });
    $("mf-reset-camera").addEventListener("click", () => {
        state.yaw = 0.82;
        state.pitch = 0.38;
        update3D();
    });
    redraw();
}());
