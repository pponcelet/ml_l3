"use strict";
(function () {
    const host = document.getElementById("supcmp-lab");
    if (!host) return;
    const svgNS = "http://www.w3.org/2000/svg";
    const colors = ["#447aa6", "#d28d59", "#4e9582"];
    const $ = (id) => document.getElementById(id);

    function element(tag, attrs, parent, value) {
        const item = document.createElementNS(svgNS, tag);
        Object.entries(attrs || {}).forEach(([name, val]) => item.setAttribute(name, val));
        if (value !== undefined) item.textContent = value;
        if (parent) parent.appendChild(item);
        return item;
    }
    function rng(seed) {
        let state = seed >>> 0;
        return () => ((state = (Math.imul(1664525, state) + 1013904223) >>> 0) / 4294967296);
    }
    function gaussian(random) {
        return Math.sqrt(-2 * Math.log(Math.max(1e-9, random()))) *
            Math.cos(2 * Math.PI * random());
    }
    function clamp(v) { return Math.min(98, Math.max(2, v)); }
    const irisNames = ["Longueur sépale (cm)", "Largeur sépale (cm)",
        "Longueur pétale (cm)", "Largeur pétale (cm)"];
    // Domaines fixes, choisis indépendamment de la partition d'évaluation.
    const irisDomains = [[4, 8.5], [1.8, 4.6], [0.5, 7.5], [0, 2.8]];
    function irisDataset(axisX, axisY) {
        const source = window.ExplorationData && window.ExplorationData.iris;
        if (!source) throw new Error("Les données Iris sont absentes.");
        function scaled(v, axis) {
            const d = irisDomains[axis];
            return 100 * (v - d[0]) / (d[1] - d[0]);
        }
        return source.x.map((row, id) => ({
            id, x: scaled(row[axisX], axisX), y: scaled(row[axisY], axisY),
            c: source.y[id], raw: row
        }));
    }
    function sqdist(a, b) { return (a.x - b.x) ** 2 + (a.y - b.y) ** 2; }

    function dataset(shape, seed) {
        const random = rng(seed), points = [];
        function add(x, y, c) {
            points.push({ id: points.length, x: clamp(x), y: clamp(y), c });
        }
        if (shape === "blobs") {
            for (let i = 0; i < 56; i++) {
                add(30 + 12 * gaussian(random), 36 + 12 * gaussian(random), 0);
                add(70 + 12 * gaussian(random), 64 + 12 * gaussian(random), 1);
            }
        } else if (shape === "moons") {
            for (let i = 0; i < 56; i++) {
                const t = Math.PI * (i + 0.5) / 56;
                add(41 + 28 * Math.cos(t) + gaussian(random) * 2.1,
                    43 + 20 * Math.sin(t) + gaussian(random) * 2.1, 0);
                add(60 - 28 * Math.cos(t) + gaussian(random) * 2.1,
                    56 - 20 * Math.sin(t) + gaussian(random) * 2.1, 1);
            }
        } else if (shape === "circles") {
            for (let i = 0; i < 58; i++) {
                const t = 2 * Math.PI * i / 58;
                add(50 + (17 + gaussian(random) * 1.9) * Math.cos(t),
                    50 + (17 + gaussian(random) * 1.9) * Math.sin(t), 0);
                add(50 + (34 + gaussian(random) * 2.1) * Math.cos(t),
                    50 + (34 + gaussian(random) * 2.1) * Math.sin(t), 1);
            }
        } else if (shape === "xor") {
            for (let i = 0; i < 30; i++) {
                add(25 + 7 * gaussian(random), 25 + 7 * gaussian(random), 0);
                add(75 + 7 * gaussian(random), 75 + 7 * gaussian(random), 0);
                add(25 + 7 * gaussian(random), 75 + 7 * gaussian(random), 1);
                add(75 + 7 * gaussian(random), 25 + 7 * gaussian(random), 1);
            }
        } else if (shape === "imbalanced") {
            for (let i = 0; i < 96; i++) {
                add(44 + 17 * gaussian(random), 48 + 17 * gaussian(random), 0);
            }
            for (let i = 0; i < 16; i++) {
                add(68 + 12 * gaussian(random), 63 + 12 * gaussian(random), 1);
            }
        }
        return points;
    }

    // Répartition stratifiée : 60 % entraînement, 20 % validation, 20 % test.
    function splitStratified(points, seed) {
        const random = rng(seed + 9727), train = [], validation = [], test = [];
        for (const c of [...new Set(points.map(p => p.c))].sort((a,b) => a-b)) {
            const arr = points.filter(p => p.c === c);
            for (let i = arr.length - 1; i > 0; i--) {
                const j = Math.floor(random() * (i + 1));
                [arr[i], arr[j]] = [arr[j], arr[i]];
            }
            const nTest = Math.round(arr.length * .2);
            const nValidation = Math.round(arr.length * .2);
            test.push(...arr.slice(0, nTest));
            validation.push(...arr.slice(nTest, nTest + nValidation));
            train.push(...arr.slice(nTest + nValidation));
        }
        [train, validation, test].forEach(arr => arr.sort((a, b) => a.id - b.id));
        return { train, validation, test };
    }

    function fitNB(train, smoothing) {
        const labels = [...new Set(train.map(p => p.c))].sort((a, b) => a - b);
        const stats = labels.map(c => {
            const arr = train.filter(p => p.c === c);
            const mx = arr.reduce((sum, p) => sum + p.x, 0) / arr.length;
            const my = arr.reduce((sum, p) => sum + p.y, 0) / arr.length;
            const vx = arr.reduce((sum, p) => sum + (p.x - mx) ** 2, 0) / arr.length;
            const vy = arr.reduce((sum, p) => sum + (p.y - my) ** 2, 0) / arr.length;
            return { c, prior: arr.length / train.length,
                mean: [mx, my], var: [vx, vy] };
        });
        const maxVar = Math.max(...stats.flatMap(stat => stat.var));
        stats.forEach(stat => stat.var = stat.var.map(
            v => Math.max(1e-8, v + smoothing * maxVar)));
        return (x, y) => {
            let winner = 0, best = -Infinity;
            for (const stat of stats) {
                let logLikelihood = Math.log(stat.prior);
                [x, y].forEach((v, j) => {
                    logLikelihood -= .5 * (Math.log(2 * Math.PI * stat.var[j]) +
                        (v - stat.mean[j]) ** 2 / stat.var[j]);
                });
                if (logLikelihood > best) {
                    best = logLikelihood;
                    winner = stat.c;
                }
            }
            return winner;
        };
    }

    function fitLogistic(train, lambda) {
        const weights = [0,0,0];
        function sigmoid(z) {
            if (z >= 0) return 1 / (1 + Math.exp(-z));
            const q = Math.exp(z);
            return q / (1 + q);
        }
        for (let iter = 0; iter < 1000; iter++) {
            let g0 = 0, g1 = 0, g2 = 0;
            for (const p of train) {
                const x1 = (p.x - 50)/25, x2 = (p.y - 50)/25;
                const e = sigmoid(weights[0] + weights[1]*x1 + weights[2]*x2) - p.c;
                g0 += e; g1 += e*x1; g2 += e*x2;
            }
            weights[0] -= .36*g0/train.length;
            weights[1] -= .36*(g1/train.length + lambda*weights[1]);
            weights[2] -= .36*(g2/train.length + lambda*weights[2]);
        }
        return (x,y) => sigmoid(weights[0]+weights[1]*(x-50)/25+
            weights[2]*(y-50)/25) >= .5 ? 1 : 0;
    }

    function fitSoftmax(train, lambda) {
        const nClasses = 3;
        const weights = Array.from({ length: nClasses }, () => [0, 0, 0]);
        function features(x, y) { return [1, (x - 50) / 25, (y - 50) / 25]; }
        function probabilities(f) {
            const values = weights.map(w => w[0]*f[0] + w[1]*f[1] + w[2]*f[2]);
            const highest = Math.max(...values);
            const exps = values.map(v => Math.exp(v - highest));
            const total = exps.reduce((sum, v) => sum + v, 0);
            return exps.map(v => v / total);
        }
        for (let iteration = 0; iteration < 650; iteration++) {
            const gradient = Array.from({ length: nClasses }, () => [0, 0, 0]);
            for (const p of train) {
                const f = features(p.x, p.y);
                const probs = probabilities(f);
                for (let c = 0; c < nClasses; c++) {
                    const delta = probs[c] - (p.c === c ? 1 : 0);
                    for (let j = 0; j < 3; j++) gradient[c][j] += delta * f[j];
                }
            }
            for (let c = 0; c < nClasses; c++) for (let j = 0; j < 3; j++) {
                weights[c][j] -= .5 * (gradient[c][j]/train.length +
                    (j ? lambda * weights[c][j] : 0));
            }
        }
        return (x, y) => {
            const probs = probabilities(features(x, y));
            return probs.indexOf(Math.max(...probs));
        };
    }

    function fitKNN(train, k) {
        const labels = [...new Set(train.map(p => p.c))].sort((a, b) => a - b);
        return (x, y) => {
            const neighbors = train.map(p => ({ d: (x - p.x)**2 + (y - p.y)**2,
                c: p.c })).sort((a, b) => a.d - b.d).slice(0, k);
            let chosen = labels[0], bestCount = -1;
            for (const c of labels) {
                const count = neighbors.filter(p => p.c === c).length;
                if (count > bestCount) { bestCount = count; chosen = c; }
            }
            return chosen;
        };
    }

    function gini(counts) {
        const n = counts.reduce((sum, v) => sum + v, 0);
        if (!n) return 0;
        return 1 - counts.reduce((sum, v) => sum + (v/n)**2, 0);
    }
    function fitTree(train, maxDepth, minLeaf = 4) {
        const labels = [...new Set(train.map(p => p.c))].sort((a, b) => a - b);
        function counts(data) { return labels.map(c => data.filter(p => p.c === c).length); }
        function grow(data, depth) {
            const n = data.length, classCounts = counts(data);
            const majority = Math.max(...classCounts);
            const node = { pred: labels[classCounts.indexOf(majority)] };
            if (depth >= maxDepth || majority === n || n < 2 * minLeaf) return node;
            const parentGini = gini(classCounts);
            let best = null;
            for (const axis of ["x", "y"]) {
                const sorted = data.slice().sort((a, b) => a[axis] - b[axis]);
                const leftCounts = new Array(labels.length).fill(0);
                for (let cut = 1; cut < n; cut++) {
                    leftCounts[labels.indexOf(sorted[cut - 1].c)]++;
                    if (cut < minLeaf || n - cut < minLeaf ||
                        sorted[cut-1][axis] === sorted[cut][axis]) continue;
                    const rightCounts = classCounts.map((v, j) => v - leftCounts[j]);
                    const impurity = (cut * gini(leftCounts) +
                        (n - cut) * gini(rightCounts)) / n;
                    if (!best || impurity < best.score - 1e-10) {
                        best = { axis, score: impurity,
                            threshold: (sorted[cut-1][axis] + sorted[cut][axis]) / 2 };
                    }
                }
            }
            if (!best || best.score >= parentGini - 1e-10) return node;
            node.axis = best.axis;
            node.threshold = best.threshold;
            node.left = grow(data.filter(p => p[best.axis] <= best.threshold), depth + 1);
            node.right = grow(data.filter(p => p[best.axis] > best.threshold), depth + 1);
            return node;
        }
        const tree = grow(train, 0);
        return (x, y) => {
            let node = tree;
            while (node.left) {
                node = (node.axis === "x" ? x : y) <= node.threshold ?
                    node.left : node.right;
            }
            return node.pred;
        };
    }

    function kernel(a, b, type, gamma) {
        if (type === "linear") return a.x * b.x + a.y * b.y;
        return Math.exp(-gamma * sqdist(a, b));
    }

    // SVM binaire à marge souple : ajustement par optimisation SMO.
    function fitSVM(points, type, C, gamma, returnScore = false) {
        const n = points.length,
            x = points.map(p => ({ x: (p.x - 50) / 25, y: (p.y - 50) / 25 })),
            labels = points.map(p => p.c ? 1 : -1),
            alpha = new Float64Array(n),
            K = Array.from({ length: n }, () => new Float64Array(n));
        for (let i = 0; i < n; i++) for (let j = 0; j <= i; j++) {
            const k = kernel(x[i], x[j], type, gamma);
            K[i][j] = k;
            K[j][i] = k;
        }
        let b = 0, passes = 0;
        for (let epoch = 0; epoch < 260 && passes < 8; epoch++) {
            let changed = 0;
            for (let i = 0; i < n; i++) {
                let fI = b;
                for (let q = 0; q < n; q++) if (alpha[q] > 0)
                    fI += alpha[q] * labels[q] * K[q][i];
                const eI = fI - labels[i];
                if (!((labels[i] * eI < -1e-3 && alpha[i] < C - 1e-6) ||
                    (labels[i] * eI > 1e-3 && alpha[i] > 1e-6))) continue;
                const j = (i + 1 + ((epoch * 17 + i * 13) % (n - 1))) % n;
                let fJ = b;
                for (let q = 0; q < n; q++) if (alpha[q] > 0)
                    fJ += alpha[q] * labels[q] * K[q][j];
                const eJ = fJ - labels[j];
                const ai = alpha[i], aj = alpha[j];
                const L = labels[i] === labels[j] ? Math.max(0, ai + aj - C) :
                    Math.max(0, aj - ai);
                const H = labels[i] === labels[j] ? Math.min(C, ai + aj) :
                    Math.min(C, C + aj - ai);
                if (H - L < 1e-9) continue;
                const eta = 2 * K[i][j] - K[i][i] - K[j][j];
                if (eta >= -1e-9) continue;
                const ajNew = Math.max(L, Math.min(H, aj - labels[j] * (eI - eJ) / eta));
                if (Math.abs(ajNew - aj) < 1e-6) continue;
                const aiNew = ai + labels[i] * labels[j] * (aj - ajNew);
                const b1 = b - eI - labels[i] * (aiNew - ai) * K[i][i] -
                    labels[j] * (ajNew - aj) * K[i][j];
                const b2 = b - eJ - labels[i] * (aiNew - ai) * K[i][j] -
                    labels[j] * (ajNew - aj) * K[j][j];
                b = aiNew > 1e-7 && aiNew < C - 1e-7 ? b1 :
                    ajNew > 1e-7 && ajNew < C - 1e-7 ? b2 : (b1 + b2) / 2;
                alpha[i] = aiNew;
                alpha[j] = ajNew;
                changed++;
            }
            passes = changed ? 0 : passes + 1;
        }
        const support = [];
        for (let i = 0; i < n; i++) if (alpha[i] > 1e-5)
            support.push({ i, a: alpha[i] * labels[i] });
        return (rawX, rawY) => {
            const point = { x: (rawX - 50) / 25, y: (rawY - 50) / 25 };
            let score = b;
            for (const v of support) score += v.a * kernel(x[v.i], point, type, gamma);
            return returnScore ? score : (score >= 0 ? 1 : 0);
        };
    }

    function fitMulticlassSVM(train, kernelType, C, gamma) {
        const predictors = [0, 1, 2].map(c => fitSVM(
            train.map(p => ({...p, c: p.c === c ? 1 : 0})),
            kernelType, C, gamma, true));
        return (x, y) => {
            const scores = predictors.map(predict => predict(x,y));
            return scores.indexOf(Math.max(...scores));
        };
    }

    function score(items, predict, nClasses, labelMode) {
        let errors = 0;
        const found = new Array(nClasses).fill(0);
        const total = new Array(nClasses).fill(0);
        for (const p of items) {
            const guess = predict(p.x, p.y);
            if (guess !== p.c) errors++;
            total[p.c]++;
            if (guess === p.c) found[p.c]++;
        }
        const recalls = total.map((n, c) => n ? found[c] / n : null);
        const recall = labelMode === "macro" ?
            recalls.reduce((sum, r) => sum + (r || 0), 0) / nClasses : recalls[1];
        return { errors, accuracy: (items.length - errors) / items.length,
            recall, recalls };
    }
    function percentage(value) {
        return value == null ? "—" : (value * 100).toFixed(1).replace(".", ",") + " %";
    }

    function highlighted(id, on) {
        document.querySelectorAll(`.supcmp-dot[data-index="${id}"]`).forEach(circle => {
            circle.setAttribute("r", on ? "7.4" : circle.dataset.radius);
            circle.setAttribute("stroke-width", on ? "2.6" : circle.dataset.width);
            circle.style.opacity = on ? "1" : "0.95";
        });
    }

    function draw(container, points, train, predict, description, axes) {
        const w = 460, h = 358, margin = { l: 41, r: 14, t: 16, b: 38 };
        const sx = x => margin.l + x * (w - margin.l - margin.r) / 100;
        const sy = y => h - margin.b - y * (h - margin.t - margin.b) / 100;
        const svg = element("svg", { viewBox: `0 0 ${w} ${h}`, role: "img",
            "aria-label": description }, null);
        const n = 42;
        const background = element("g", {}, svg);
        for (let iy = 0; iy < n; iy++) for (let ix = 0; ix < n; ix++) {
            const c = predict((ix + .5) * 100 / n, (iy + .5) * 100 / n);
            element("rect", {
                x: sx(ix * 100 / n), y: sy((iy + 1) * 100 / n),
                width: (w - margin.l - margin.r) / n + .15,
                height: (h - margin.t - margin.b) / n + .15,
                fill: colors[c], opacity: ".13"
            }, background);
        }
        for (let tick = 0; tick <= 100; tick += 25) {
            const x = sx(tick), y = sy(tick);
            element("line", { x1: x, x2: x, y1: sy(0), y2: sy(100),
                stroke: "#dfe7ed", "stroke-width": ".65" }, svg);
            element("line", { x1: sx(0), x2: sx(100), y1: y, y2: y,
                stroke: "#dfe7ed", "stroke-width": ".65" }, svg);
            element("text", { x, y: sy(0) + 17, "font-size": 10.5,
                "text-anchor": "middle", fill: "#75889a" }, svg, axes ? (axes.x[0] + tick*(axes.x[1]-axes.x[0])/100).toFixed(1).replace(".", ",") : tick);
            element("text", { x: sx(0) - 7, y: y + 3.5, "font-size": 10.5,
                "text-anchor": "end", fill: "#75889a" }, svg, axes ? (axes.y[0] + tick*(axes.y[1]-axes.y[0])/100).toFixed(1).replace(".", ",") : tick);
        }
        element("text", { x: w / 2, y: h - 4, "font-size": 11,
            "text-anchor": "middle", fill: "#708294" }, svg, axes ? axes.xLabel : "Variable 1");
        element("text", { transform: "rotate(-90)", x: -h / 2, y: 12,
            "font-size": 11, "text-anchor": "middle", fill: "#708294" }, svg,
            axes ? axes.yLabel : "Variable 2");
        const trainingIds = new Set(train.map(p => p.id));
        points.forEach(p => {
            const isTrain = trainingIds.has(p.id);
            const circle = element("circle", {
                cx: sx(p.x), cy: sy(p.y), r: isTrain ? 3.8 : 4.4,
                fill: isTrain ? colors[p.c] : "#ffffff",
                stroke: isTrain ? "#ffffff" : colors[p.c],
                "stroke-width": isTrain ? 1.0 : 2.1,
                opacity: ".95",
                class: "supcmp-dot", "data-index": p.id,
                style: "cursor:crosshair"
            }, svg);
            circle.dataset.radius = isTrain ? "3.8" : "4.4";
            circle.dataset.width = isTrain ? "1.0" : "2.1";
            circle.addEventListener("mouseenter", () => highlighted(p.id, true));
            circle.addEventListener("mouseleave", () => highlighted(p.id, false));
            element("title", {}, circle, `Observation ${p.id + 1} — ${isTrain ? "entraînement" : "validation"} — ${axes ? ["Setosa", "Versicolor", "Virginica"][p.c] : "classe " + (p.c + 1)}`);
        });
        container.replaceChildren(svg);
    }

    const captions = {
        blobs: "Deux groupes compacts : comparez les frontières simples et complexes.",
        moons: "Deux lunes : une frontière droite ne peut pas séparer correctement les deux formes.",
        circles: "Cercles concentriques : les classes ne sont pas linéairement séparables.",
        xor: "Damier : la combinaison des deux variables est déterminante pour classer les observations.",
        imbalanced: "Classes déséquilibrées : l’exactitude peut masquer les erreurs sur la classe minoritaire.",
        iris: "Iris : trois espèces, 150 fleurs et deux variables de mesure pour construire les frontières."
    };
    const state = { shape: "moons", seed: 31, k: 5, depth: 4,
        smoothing: .05, lambda: .05, kernel: "rbf", C: 2, gamma: 1,
        finalUsed: false, finalVisible: false, irisX: 2, irisY: 3 };
    let currentEvaluation = null;

    function finalTest() {
        if (state.finalUsed || !currentEvaluation) return;
        state.finalUsed = true;
        state.finalVisible = true;
        $("supcmp-final-button").disabled = true;
        $("supcmp-final-results").hidden = false;
        const tbody = $("supcmp-final-rows");
        tbody.replaceChildren();
        for (const model of currentEvaluation.models) {
            const result = score(currentEvaluation.test, model.predict,
                currentEvaluation.nClasses, currentEvaluation.labelMode);
            const tr = document.createElement("tr");
            for (const value of [model.title, percentage(result.accuracy),
                `${result.errors} / ${currentEvaluation.test.length}`,
                percentage(result.recall)]) {
                const td = document.createElement("td");
                td.textContent = value;
                tr.appendChild(td);
            }
            tbody.appendChild(tr);
        }
        $("supcmp-final-info").textContent =
            "Test consulté. Un nouvel essai nécessite de nouvelles observations.";
    }
    function render() {
        const isIris = state.shape === "iris";
        const points = isIris ? irisDataset(state.irisX, state.irisY) :
            dataset(state.shape, state.seed);
        const nClasses = isIris ? 3 : 2;
        const labelMode = isIris ? "macro" : "class2";
        const axes = isIris ? {
            x: irisDomains[state.irisX], y: irisDomains[state.irisY],
            xLabel: irisNames[state.irisX], yLabel: irisNames[state.irisY]
        } : null;
        const { train, validation, test } = splitStratified(points, state.seed);
        const models = [
            { id: "nb", title: "Naive Bayes", predict: fitNB(train, state.smoothing) },
            { id: "log", title: "Régression logistique", predict: isIris ?
                fitSoftmax(train, state.lambda) : fitLogistic(train, state.lambda) },
            { id: "knn", title: "KNN", predict: fitKNN(train, state.k) },
            { id: "tree", title: "Arbre de décision", predict: fitTree(train, state.depth) },
            { id: "svm", title: "SVM", predict: isIris ?
                fitMulticlassSVM(train, state.kernel, state.C, state.gamma) :
                fitSVM(train, state.kernel, state.C, state.gamma) }
        ];
        currentEvaluation = { models, test, nClasses, labelMode };
        for (const model of models) {
            draw($("supcmp-plot-" + model.id), [...train, ...validation],
                train, model.predict, `Zones de décision et observations pour ${model.title}`, axes);
            const trainScore = score(train, model.predict, nClasses, labelMode);
            const validationScore = score(validation, model.predict, nClasses, labelMode);
            $("supcmp-train-" + model.id).textContent = percentage(trainScore.accuracy);
            $("supcmp-test-" + model.id).textContent = percentage(validationScore.accuracy);
            $("supcmp-error-" + model.id).textContent = percentage(validationScore.recall);
        }
        $("supcmp-count").textContent = `${train.length} entraînement, ${validation.length} validation, ${test.length} test (stratifié par classe).`;
        $("supcmp-iris-fields").hidden = !isIris;
        $("supcmp-legend-3").hidden = !isIris;
        $("supcmp-legend-1").textContent = isIris ? "Setosa" : "Classe 1";
        $("supcmp-legend-2").textContent = isIris ? "Versicolor" : "Classe 2";
        const recallLabel = isIris ? "Rappel macro" :
            state.shape === "imbalanced" ? "Rappel minoritaire" : "Rappel classe 2";
        document.querySelectorAll(".supcmp-recall-label").forEach(label => {
            label.textContent = recallLabel;
        });
        $("supcmp-final-recall-heading").textContent = recallLabel;
        $("supcmp-caption").textContent = captions[state.shape];
        $("supcmp-k-value").textContent = state.k;
        $("supcmp-depth-value").textContent = state.depth;
        $("supcmp-smoothing-value").textContent = state.smoothing.toFixed(2).replace(".", ",");
        $("supcmp-lambda-value").textContent = state.lambda.toFixed(2).replace(".", ",");
        $("supcmp-c-value").textContent = state.C.toFixed(1).replace(".", ",");
        $("supcmp-gamma-value").textContent = state.gamma.toFixed(2).replace(".", ",");
        $("supcmp-gamma").disabled = state.kernel === "linear";
        state.finalVisible = false;
        $("supcmp-final-results").hidden = true;
        $("supcmp-final-button").disabled = state.finalUsed;
        $("supcmp-regenerate").textContent = isIris ? "Nouvelle répartition" : "Nouvelles observations";
        $("supcmp-final-info").textContent = state.finalUsed ?
            "Test déjà consulté : chargez de nouvelles observations pour une nouvelle évaluation finale." :
            "Le jeu de test est masqué pendant les réglages.";
    }

    $("supcmp-shape").addEventListener("change", function () {
        state.shape = this.value;
        state.finalUsed = false;
        render();
    });
    $("supcmp-regenerate").addEventListener("click", function () {
        state.seed += 37;
        state.finalUsed = false;
        render();
    });
    function changeIrisAxis(axis, value) {
        state[axis] = Number(value);
        if (state.irisX === state.irisY) {
            const other = axis === "irisX" ? "irisY" : "irisX";
            state[other] = (state[axis] + 1) % 4;
            $("supcmp-iris-" + (other === "irisX" ? "x" : "y")).value = state[other];
        }
        render();
    }
    $("supcmp-iris-x").addEventListener("change", function () {
        changeIrisAxis("irisX", this.value);
    });
    $("supcmp-iris-y").addEventListener("change", function () {
        changeIrisAxis("irisY", this.value);
    });
    const controlMap = {
        "supcmp-smoothing": "smoothing", "supcmp-lambda": "lambda", "supcmp-k": "k",
        "supcmp-depth": "depth", "supcmp-kernel": "kernel",
        "supcmp-c": "C", "supcmp-gamma": "gamma"
    };
    for (const [id, key] of Object.entries(controlMap)) {
        $(id).addEventListener("input", function () {
            state[key] = key === "kernel" ? this.value : Number(this.value);
            render();
        });
    }
    $("supcmp-final-button").addEventListener("click", finalTest);
    render();
}());
