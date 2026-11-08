"use strict";
(function () {
    const byId = (id) => document.getElementById(id);
    const percent = (v) => `${(100 * v).toFixed(1).replace(".", ",")} %`;
    const number = (v, n = 2) => v.toFixed(n).replace(".", ",");

    if (byId("fond-split-lab")) {
        const trainSlider = byId("fond-train");
        const valSlider = byId("fond-validation");
        const mode = byId("fond-strat-mode");
        const track = byId("fond-split-track");
        const trainHandle = byId("fond-handle-train");
        const valHandle = byId("fond-handle-validation");
        const N = 50;
        const MIN_TRAIN = 40;
        const MIN_PART = 10;
        const state = { train: 60, validation: 20 };
        const positiveIds = new Set([2, 7, 13, 18, 24, 29, 34, 40, 45, 49]);
        const ids = Array.from({ length: N }, (_, i) => i);

        function shuffle(values, seed) {
            const result = values.slice();
            let s = seed >>> 0;
            const random = () => {
                s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
                return s / 4294967296;
            };
            for (let i = result.length - 1; i > 0; i--) {
                const j = Math.floor(random() * (i + 1));
                [result[i], result[j]] = [result[j], result[i]];
            }
            return result;
        }
        const randomOrder = shuffle(ids, 2026);
        const positiveOrder = shuffle(ids.filter((id) => positiveIds.has(id)), 2071);
        const negativeOrder = shuffle(ids.filter((id) => !positiveIds.has(id)), 2072);

        function stratifiedOrder(sizes) {
            // Répartition entière au plus près de 20 % dans chaque ensemble.
            // Méthode des plus grands restes : exactement dix positifs.
            const targets = sizes.map((n) => (n * positiveOrder.length) / N);
            const allocations = targets.map(Math.floor);
            let left = positiveOrder.length - allocations.reduce((sum, n) => sum + n, 0);
            const ranks = targets.map((t, i) => ({ i, fraction: t - allocations[i] }))
                .sort((a, b) => b.fraction - a.fraction || a.i - b.i);
            for (let i = 0; i < left; i++) allocations[ranks[i].i]++;
            let posAt = 0, negAt = 0;
            const ordered = [];
            sizes.forEach((size, i) => {
                const positives = positiveOrder.slice(posAt, posAt + allocations[i]);
                const negatives = negativeOrder.slice(negAt, negAt + size - allocations[i]);
                ordered.push(...shuffle(positives.concat(negatives), 2401 + i));
                posAt += allocations[i];
                negAt += size - allocations[i];
            });
            return ordered;
        }
        function updateTrain(value) {
            const next = Math.max(MIN_TRAIN, Math.min(80, Math.round(value / 2) * 2));
            state.train = next;
            state.validation = Math.min(state.validation, 100 - MIN_PART - next);
            draw();
        }
        function updateValidation(value) {
            const max = Math.min(40, 100 - MIN_PART - state.train);
            state.validation = Math.max(MIN_PART, Math.min(max, Math.round(value / 2) * 2));
            draw();
        }
        function draw() {
            const test = 100 - state.train - state.validation;
            const train = state.train / 2;
            const validation = state.validation / 2;
            const testCount = test / 2;
            const regions = [
                { name: "Entraînement", key: "train", n: train, start: 0 },
                { name: "Validation", key: "validation", n: validation, start: train },
                { name: "Test", key: "test", n: testCount, start: train + validation }
            ];
            const ordered = mode.value === "stratified"
                ? stratifiedOrder(regions.map((r) => r.n)) : randomOrder;
            trainSlider.value = state.train;
            valSlider.max = Math.min(40, 90 - state.train);
            valSlider.value = state.validation;
            byId("fond-train-value").textContent = `${state.train} %`;
            byId("fond-validation-value").textContent = `${state.validation} %`;
            byId("fond-summary-train").textContent = `${state.train} %`;
            byId("fond-summary-validation").textContent = `${state.validation} %`;
            byId("fond-summary-test").textContent = `${test} %`;
            byId("fond-train-count").textContent = train;
            byId("fond-val-count").textContent = validation;
            byId("fond-test-count").textContent = testCount;
            byId("fond-track-train").style.width = `${state.train}%`;
            byId("fond-track-validation").style.width = `${state.validation}%`;
            byId("fond-track-test").style.width = `${test}%`;
            trainHandle.style.left = `${state.train}%`;
            valHandle.style.left = `${state.train + state.validation}%`;
            trainHandle.setAttribute("aria-valuemax", 80);
            trainHandle.setAttribute("aria-valuenow", state.train);
            trainHandle.setAttribute("aria-valuetext", `${state.train} % d'entraînement`);
            valHandle.setAttribute("aria-valuemin", state.train + 10);
            valHandle.setAttribute("aria-valuenow", state.train + state.validation);
            valHandle.setAttribute("aria-valuetext", `${state.validation} % de validation, ${test} % de test`);

            byId("fond-split-bars").innerHTML = ordered.map((id, i) => {
                const region = regions.find((r) => i >= r.start && i < r.start + r.n);
                const positive = positiveIds.has(id);
                return `<span class="fond-split-dot fond-${region.key}${positive ? " fond-positive" : ""}" ` +
                    `title="Observation ${id + 1} : ${region.name}, classe ${positive ? "positive" : "négative"}"></span>`;
            }).join("");
            const counts = regions.map((r) => {
                const positives = ordered.slice(r.start, r.start + r.n)
                    .filter((id) => positiveIds.has(id)).length;
                return `${r.name} : ${positives}/${r.n} positifs (${number(100 * positives / r.n, 1)} %)`;
            });
            byId("fond-strat-result").textContent = counts.join(" ; ") + ".";
            byId("fond-split-bars").setAttribute("aria-label", counts.join(" ; "));
        }
        // Les séparateurs sont déplaçables avec la souris, au toucher et au clavier.
        function positionPercent(evt) {
            const rect = track.getBoundingClientRect();
            return 100 * (evt.clientX - rect.left) / rect.width;
        }
        function attachHandle(handle, setter, getValue) {
            handle.addEventListener("pointerdown", (evt) => {
                evt.preventDefault();
                handle.setPointerCapture(evt.pointerId);
                setter(positionPercent(evt));
            });
            handle.addEventListener("pointermove", (evt) => {
                if (handle.hasPointerCapture(evt.pointerId)) setter(positionPercent(evt));
            });
            handle.addEventListener("keydown", (evt) => {
                let v = getValue();
                if (evt.key === "ArrowLeft" || evt.key === "ArrowDown") v -= 2;
                else if (evt.key === "ArrowRight" || evt.key === "ArrowUp") v += 2;
                else if (evt.key === "Home") v = 0;
                else if (evt.key === "End") v = 100;
                else return;
                evt.preventDefault();
                setter(v);
            });
        }
        attachHandle(trainHandle, updateTrain, () => state.train);
        attachHandle(valHandle, (v) => updateValidation(v - state.train),
            () => state.train + state.validation);
        trainSlider.addEventListener("input", () => updateTrain(Number(trainSlider.value)));
        valSlider.addEventListener("input", () => updateValidation(Number(valSlider.value)));
        mode.addEventListener("change", draw);
        draw();
    }

    if (byId("fond-eval-lab")) {
        const positives = [0.95,0.90,0.87,0.83,0.79,0.76,0.72,0.69,0.65,0.63,
            0.59,0.57,0.55,0.53,0.48,0.45,0.41,0.37,0.31,0.24];
        // Scores contrastés, avec des erreurs réalistes dans les deux classes.
        const negatives = Array.from({ length: 80 }, (_, i) => {
            if (i < 10) return 0.82 - i * 0.034;
            return 0.44 - (i - 10) * (0.36 / 69);
        });
        const ratio = (a, b) => b ? a / b : null;
        const print = (v) => v == null ? "Non définie" : percent(v);
        // Courbes empiriques du classificateur, calculées sur les mêmes scores
        // que la matrice de confusion. Le point varie avec le seuil choisi.
        function makeCurvePoints() {
            const thresholds = [Infinity, ...new Set([...positives, ...negatives])]
                .sort((a, b) => b - a);
            return thresholds.map((threshold) => {
                const tp = positives.filter((v) => v >= threshold).length;
                const fp = negatives.filter((v) => v >= threshold).length;
                const recall = tp / positives.length;
                const fpr = fp / negatives.length;
                // Convention usuelle au seuil +infini : précision = 1.
                const precision = tp + fp === 0 ? 1 : tp / (tp + fp);
                return { threshold, recall, fpr, precision };
            });
        }
        const curvePoints = makeCurvePoints();
        function svgNode(tag, attrs, value) {
            const el = document.createElementNS("http://www.w3.org/2000/svg", tag);
            Object.entries(attrs || {}).forEach(([k, v]) => el.setAttribute(k, v));
            if (value != null) el.textContent = value;
            return el;
        }
        function drawCurve(which, selected) {
            const W = 460, H = 275;
            const m = { l: 44, r: 18, t: 20, b: 37 };
            const x = (v) => m.l + v * (W - m.l - m.r);
            const y = (v) => H - m.b - v * (H - m.t - m.b);
            const svg = svgNode("svg", { viewBox: `0 0 ${W} ${H}`, role: "img",
                "aria-label": which === "roc" ? "Courbe ROC" : "Courbe précision-rappel" });
            for (let j = 0; j <= 4; j++) {
                const v = j / 4;
                svg.appendChild(svgNode("line", {x1: x(v), x2: x(v), y1: y(0), y2: y(1), stroke: "#e9eff4"}));
                svg.appendChild(svgNode("line", {x1: x(0), x2: x(1), y1: y(v), y2: y(v), stroke: "#e9eff4"}));
                svg.appendChild(svgNode("text", {x: x(v), y: y(0) + 17,
                    "text-anchor": "middle", "font-size": 10.5, fill: "#75899b"}, number(v, 2)));
                svg.appendChild(svgNode("text", {x: x(0) - 9, y: y(v) + 3,
                    "text-anchor": "end", "font-size": 10.5, fill: "#75899b"}, number(v, 2)));
            }
            const keyX = which === "roc" ? "fpr" : "recall";
            const keyY = which === "roc" ? "recall" : "precision";
            const pts = curvePoints.map((p) => `${x(p[keyX])},${y(p[keyY])}`).join(" ");
            if (which === "roc") svg.appendChild(svgNode("line", {
                x1: x(0), y1: y(0), x2: x(1), y2: y(1), stroke: "#b3bcc6",
                "stroke-width": 1.2, "stroke-dasharray": "5 5"
            }));
            if (which === "pr") svg.appendChild(svgNode("line", {
                x1: x(0), y1: y(0.2), x2: x(1), y2: y(0.2), stroke: "#b3bcc6",
                "stroke-width": 1.2, "stroke-dasharray": "5 5"
            }));
            svg.appendChild(svgNode("polyline", {points: pts,
                fill: "none", stroke: "#447aa6", "stroke-width": 2.6,
                "stroke-linejoin": "round", "stroke-linecap": "round"}));
            svg.appendChild(svgNode("circle", {cx: x(selected[keyX]), cy: y(selected[keyY]),
                r: 6.2, fill: "#d28d59", stroke: "white", "stroke-width": 2}));
            const dest = byId(which === "roc" ? "fond-roc-chart" : "fond-pr-chart");
            dest.replaceChildren(svg);
        }
        const draw = () => {
            const threshold = Number(byId("fond-threshold").value);
            let tp = positives.filter((v) => v >= threshold).length;
            let fn = positives.length - tp;
            let fp = negatives.filter((v) => v >= threshold).length;
            let tn = negatives.length - fp;
            const precision = ratio(tp, tp + fp);
            const recall = ratio(tp, tp + fn);
            const specificity = ratio(tn, tn + fp);
            const f1 = precision !== null && recall !== null && precision + recall > 0
                ? (2 * precision * recall) / (precision + recall) :
                tp === 0 && fp === 0 ? null : 0;
            byId("fond-threshold-value").textContent = number(threshold, 2);
            byId("fond-tp").textContent = tp;
            byId("fond-fp").textContent = fp;
            byId("fond-fn").textContent = fn;
            byId("fond-tn").textContent = tn;
            byId("fond-acc").textContent = percent((tp + tn) / 100);
            byId("fond-prec").textContent = print(precision);
            byId("fond-rec").textContent = print(recall);
            byId("fond-f1").textContent = print(f1);
            byId("fond-spec").textContent = print(specificity);
            byId("fond-bacc").textContent = print((recall + specificity) / 2);
            byId("fond-threshold-hint").textContent =
                `Le modèle détecte ${tp} des 20 cas positifs, et classe à tort ${fp} des 80 cas négatifs parmi les positifs. ` +
                `Comparez le rappel et la précision lorsque vous déplacez le seuil.`;
            const current = {recall, fpr: fp / negatives.length,
                precision: precision == null ? 1 : precision};
            drawCurve("roc", current);
            drawCurve("pr", current);
        };
        byId("fond-threshold").addEventListener("input", draw);
        draw();
    }

    if (byId("fond-reg-lab")) {
        const real = [2.2, 3.1, 4.2, 4.5, 6.3, 6.9, 7.9];
        const xs = [1, 2, 3, 4, 5, 6, 7];
        const NS = "http://www.w3.org/2000/svg";
        function svgNode(tag, attrs, text) {
            const el = document.createElementNS(NS, tag);
            for (const [key, value] of Object.entries(attrs || {})) el.setAttribute(key, value);
            if (text != null) el.textContent = text;
            return el;
        }
        const draw = () => {
            const offset = Number(byId("fond-offset").value);
            const prediction = xs.map((x) => 1 + 0.9 * x + offset);
            const errors = real.map((y, i) => y - prediction[i]);
            const mae = errors.reduce((s, e) => s + Math.abs(e), 0) / real.length;
            const mse = errors.reduce((s, e) => s + e * e, 0) / real.length;
            byId("fond-offset-value").textContent = number(offset, 1);
            byId("fond-mae").textContent = number(mae);
            byId("fond-mse").textContent = number(mse);
            byId("fond-rmse").textContent = number(Math.sqrt(mse));
            const avg = real.reduce((sum, v) => sum + v, 0) / real.length;
            const sst = real.reduce((sum, v) => sum + (v - avg) ** 2, 0);
            const sse = errors.reduce((sum, e) => sum + e * e, 0);
            byId("fond-r2").textContent = number(1 - sse / sst, 3);
            const W = 760, H = 285, m = { l: 45, r: 22, t: 20, b: 37 };
            const X = (x) => m.l + (x / 8) * (W - m.l - m.r);
            const Y = (y) => H - m.b - ((y + 1) / 12) * (H - m.t - m.b);
            const svg = svgNode("svg", { viewBox: `0 0 ${W} ${H}`, role: "img",
                "aria-label": "Valeurs réelles et prédites, et écarts entre elles" });
            for (let tick = 0; tick <= 10; tick += 2) {
                svg.appendChild(svgNode("line", { x1: m.l, x2: W - m.r,
                    y1: Y(tick), y2: Y(tick), stroke: "#e7edf2", "stroke-width": 1 }));
                svg.appendChild(svgNode("text", { x: m.l - 11, y: Y(tick) + 4,
                    "text-anchor": "end", fill: "#677e92", "font-size": 11 }, String(tick)));
            }
            svg.appendChild(svgNode("line", { x1: m.l, x2: W - m.r, y1: H - m.b,
                y2: H - m.b, stroke: "#bdcad6" }));
            for (const x of xs) {
                svg.appendChild(svgNode("text", { x: X(x), y: H - m.b + 19,
                    "text-anchor": "middle", fill: "#677e92", "font-size": 11 }, String(x)));
            }
            svg.appendChild(svgNode("text", { x: W / 2, y: H - 2,
                "text-anchor": "middle", fill: "#677e92", "font-size": 11 }, "Observation"));
            const points = xs.map((x, i) => `${X(x)},${Y(prediction[i])}`).join(" ");
            svg.appendChild(svgNode("polyline", { points, fill: "none", stroke: "#d28d59",
                "stroke-width": 2.8, "stroke-linecap": "round", "stroke-linejoin": "round" }));
            xs.forEach((x, i) => {
                svg.appendChild(svgNode("line", { x1: X(x), x2: X(x), y1: Y(real[i]),
                    y2: Y(prediction[i]), stroke: "#9daab5", "stroke-width": 1.6,
                    "stroke-dasharray": "4 4" }));
                svg.appendChild(svgNode("circle", { cx: X(x), cy: Y(real[i]), r: 5.3,
                    fill: "#447aa6", stroke: "white", "stroke-width": 1.2 }));
                svg.appendChild(svgNode("circle", { cx: X(x), cy: Y(prediction[i]), r: 4.4,
                    fill: "#d28d59", stroke: "white", "stroke-width": 1.0 }));
            });
            const container = byId("fond-reg-figure");
            container.replaceChildren(svg);
        };
        byId("fond-offset").addEventListener("input", draw);
        draw();
    }
}());
