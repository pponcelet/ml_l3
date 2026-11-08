"use strict";
// Page unique : base éditable -> Apriori -> règles d'association.
// Toutes les données et tous les résultats proviennent du même tableau.
(function () {
    const P = window.Patterns;
    const $ = id => document.getElementById(id);
    const initialBaskets = P.baskets.map(items => items.slice());
    const threshold = $("as-minsup");
    const confidence = $("as-minconf");
    const speed = $("as-speed");
    const timeline = $("as-step");
    const playButton = $("as-play");
    const nextButton = $("as-next");
    const lastButton = $("as-last");
    const resetButton = $("as-reset");
    const tableRoot = $("as-matrix");
    const rowsRoot = $("as-rules-body");
    let result = null;
    let stages = [];
    let step = 0;
    let timer = null;
    let selectedRuleKey = null;
    let currentRules = [];
    const formatSet = arr => "{" + arr.join(", ") + "}";
    const ruleKey = r => r.left.join("|") + " => " + r.right.join("|");
    const percent = (n, decimals = 1) => P.percent(n, decimals);

    // ---------- Construction d'une matrice réellement modifiable ----------
    function renderBaskets() {
        const table = document.createElement("table");
        table.className = "pm-basket-table";
        table.setAttribute("aria-label", "Transactions modifiables : présence des produits");
        const thead = document.createElement("thead");
        const titleRow = document.createElement("tr");
        const first = document.createElement("th");
        first.textContent = "Panier";
        first.scope = "col";
        titleRow.appendChild(first);
        P.items.forEach(item => {
            const th = document.createElement("th");
            th.scope = "col";
            th.textContent = item;
            titleRow.appendChild(th);
        });
        thead.appendChild(titleRow);
        table.appendChild(thead);
        const tbody = document.createElement("tbody");
        P.baskets.forEach((basket, rowIndex) => {
            const tr = document.createElement("tr");
            const th = document.createElement("th");
            th.scope = "row";
            th.textContent = "T" + (rowIndex + 1);
            tr.appendChild(th);
            P.items.forEach(item => {
                const td = document.createElement("td");
                const button = document.createElement("button");
                const present = basket.includes(item);
                button.type = "button";
                button.className = "pm-basket-cell";
                button.dataset.row = String(rowIndex);
                button.dataset.item = item;
                button.setAttribute("aria-pressed", String(present));
                button.setAttribute("aria-label", "Panier " + (rowIndex + 1) +
                    ", " + item + " : " + (present ? "présent" : "absent") +
                    ". Cliquez pour " + (present ? "retirer" : "ajouter") +
                    " ce produit.");
                button.textContent = present ? "✓" : "·";
                button.addEventListener("click", () => {
                    const current = P.baskets[rowIndex];
                    const itemIndex = current.indexOf(item);
                    if (itemIndex >= 0) current.splice(itemIndex, 1);
                    else current.push(item);
                    current.sort((a, b) => P.items.indexOf(a) - P.items.indexOf(b));
                    $("as-edit-status").textContent =
                        "Panier T" + (rowIndex + 1) + " : " + item +
                        (itemIndex >= 0 ? " retiré." : " ajouté.") +
                        " Calculs mis à jour.";
                    recompute();
                    const buttons = tableRoot.querySelectorAll("button.pm-basket-cell");
                    const idx = rowIndex * P.items.length + P.items.indexOf(item);
                    if (buttons[idx]) buttons[idx].focus();
                });
                td.appendChild(button);
                tr.appendChild(td);
            });
            tbody.appendChild(tr);
        });
        table.appendChild(tbody);
        tableRoot.replaceChildren(table);
        $("as-dataset-summary").textContent = P.baskets.length +
            " paniers · " + P.items.length + " produits";
        highlightBaskets();
    }

    function highlightBaskets() {
        const rule = currentRules.find(r => ruleKey(r) === selectedRuleKey);
        const rows = tableRoot.querySelectorAll("tbody tr");
        rows.forEach((row, rowIndex) => {
            const basket = P.baskets[rowIndex];
            const match = rule && [...rule.left, ...rule.right]
                .every(item => basket.includes(item));
            row.classList.toggle("pm-basket-match", Boolean(match));
            row.querySelectorAll("button.pm-basket-cell").forEach(button => {
                const item = button.dataset.item;
                button.classList.toggle("pm-rule-left", Boolean(rule &&
                    rule.left.includes(item)));
                button.classList.toggle("pm-rule-right", Boolean(rule &&
                    rule.right.includes(item)));
                button.classList.toggle("pm-rule-both", Boolean(match));
            });
        });
    }

    // ---------- Apriori en étapes : mêmes calculs que ceux des règles ----------
    const svg = d3.select("#as-bars").append("svg")
        .attr("role", "img")
        .attr("aria-label", "Comptage des candidats et itemsets fréquents");

    function drawBars(rows) {
        const w = 770, rowH = 31, top = 24;
        const h = Math.max(85, top + rows.length * rowH + 18);
        const N = P.baskets.length;
        svg.attr("viewBox", `0 0 ${w} ${h}`);
        const scale = d3.scaleLinear().domain([0, N]).range([0, 410]);
        const g = svg.selectAll("g.pm-bar-row")
            .data(rows, d => d.items.join("|"))
            .join(enter => {
                const group = enter.append("g").attr("class", "pm-bar-row");
                group.append("text").attr("class", "pm-bar-label");
                group.append("rect").attr("class", "pm-bar-bg");
                group.append("rect").attr("class", "pm-bar-actual");
                group.append("text").attr("class", "pm-bar-value");
                return group;
            });
        g.attr("transform", (_, i) => `translate(0,${top + i * rowH})`);
        g.select(".pm-bar-label").attr("x", 165).attr("y", 17)
            .attr("text-anchor", "end").text(d => formatSet(d.items));
        g.select(".pm-bar-bg").attr("x", 185).attr("y", 2)
            .attr("rx", 4).attr("height", 23).attr("width", scale(N));
        g.select(".pm-bar-actual").interrupt()
            .attr("x", 185).attr("y", 2).attr("rx", 4)
            .attr("height", 23)
            .attr("fill", d => d.frequent ? "#488c82" : "#c4cdd7")
            .attr("width", 0).transition().duration(230)
            .attr("width", d => scale(d.count));
        g.select(".pm-bar-value").attr("x", d => 195 + scale(d.count))
            .attr("y", 18).text(d => d.count + " / " + N);
        const minsup = Number(threshold.value);
        svg.selectAll("line.pm-threshold").data([minsup]).join("line")
            .attr("class", "pm-threshold")
            .attr("x1", 185 + scale(minsup))
            .attr("x2", 185 + scale(minsup))
            .attr("y1", 0).attr("y2", h - 8);
        svg.selectAll("text.pm-threshold-label")
            .data([minsup]).join("text")
            .attr("class", "pm-threshold-label")
            .attr("x", 190 + scale(minsup)).attr("y", 11)
            .text("minsup = " + minsup);
    }

    function renderStage() {
        const stage = stages[step];
        if (!stage) return;
        const candidatePhase = stage.phase === "candidates";
        $("as-stage").textContent = (candidatePhase ? "C" : "L") + stage.k;
        $("as-stage-title").textContent = candidatePhase
            ? "Compter les candidats de taille " + stage.k
            : "Conserver les itemsets fréquents de taille " + stage.k;
        $("as-stage-desc").textContent = candidatePhase
            ? "Supports des candidats comparés au seuil minimal. " +
              (stage.pruned ? stage.pruned + " candidats ont été élagués avant comptage." : "")
            : stage.rows.length + " itemset(s) fréquent(s), utilisés pour le niveau suivant.";
        $("as-stage-count").textContent = stage.rows.length;
        $("as-frequent-total").textContent = result.allFrequent.length;
        timeline.value = step;
        $("as-step-value").textContent = (step + 1) + " / " + stages.length;
        nextButton.disabled = step >= stages.length - 1;
        lastButton.disabled = step >= stages.length - 1;
        drawBars(stage.rows);
    }
    function stop() {
        if (timer !== null) clearInterval(timer);
        timer = null;
        playButton.textContent = "Lancer";
    }
    function advance() {
        if (step < stages.length - 1) {
            step++;
            renderStage();
        } else stop();
    }
    function play() {
        if (timer !== null) { stop(); return; }
        if (step >= stages.length - 1) step = 0;
        renderStage();
        playButton.textContent = "Pause";
        timer = setInterval(advance, Number(speed.value));
    }

    // ---------- Génération des règles à partir des mêmes itemsets ----------
    function renderRules() {
        const minConf = Number(confidence.value) / 100;
        $("as-conf-value").textContent = confidence.value + " %";
        currentRules = P.rules(result.allFrequent)
            .filter(rule => rule.confidence >= minConf - 1e-10);
        if (!currentRules.some(r => ruleKey(r) === selectedRuleKey)) {
            selectedRuleKey = currentRules.length ? ruleKey(currentRules[0]) : null;
        }
        $("as-rules-count").textContent = currentRules.length;
        const rows = d3.select(rowsRoot).selectAll("tr")
            .data(currentRules, ruleKey)
            .join("tr")
            .attr("tabindex", 0)
            .attr("role", "button")
            .attr("aria-label", r => "Sélectionner la règle " +
                formatSet(r.left) + " implique " + formatSet(r.right))
            .on("click", (_, r) => selectRule(r))
            .on("keydown", (event, r) => {
                if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    selectRule(r);
                }
            });
        rows.selectAll("td").data(d => [
            formatSet(d.left) + " ⇒ " + formatSet(d.right),
            percent(d.support),
            percent(d.confidence),
            d.lift.toLocaleString("fr-FR", {
                minimumFractionDigits: 2, maximumFractionDigits: 2
            })
        ]).join("td").text(d => d);
        $("as-empty-rules").hidden = currentRules.length > 0;
        selectRule(currentRules.find(r => ruleKey(r) === selectedRuleKey) || null);
    }
    function selectRule(rule) {
        selectedRuleKey = rule ? ruleKey(rule) : null;
        d3.select(rowsRoot).selectAll("tr")
            .classed("pm-selected-rule", d =>
                rule !== null && ruleKey(d) === selectedRuleKey);
        if (rule) {
            $("as-rule-detail").textContent =
                "Règle " + formatSet(rule.left) + " ⇒ " + formatSet(rule.right) +
                " : " + rule.both + " paniers contiennent X et Y, parmi " +
                rule.leftN + " paniers contenant X. " +
                "Confiance = " + percent(rule.confidence) +
                " ; lift = " + rule.lift.toLocaleString("fr-FR", {
                    maximumFractionDigits: 2
                }) + ". Les paniers contenant les deux sont surlignés ci-dessus.";
        } else {
            $("as-rule-detail").textContent =
                "Aucune règle sélectionnable avec les seuils actuels.";
        }
        highlightBaskets();
    }

    function recompute() {
        stop();
        threshold.max = String(P.baskets.length);
        if (+threshold.value > P.baskets.length) {
            threshold.value = String(P.baskets.length);
        }
        $("as-minsup-value").textContent = threshold.value +
            " sur " + P.baskets.length + " (" +
            percent(+threshold.value / P.baskets.length) + ")";
        result = P.apriori(+threshold.value);
        stages = result.levels;
        timeline.max = String(Math.max(0, stages.length - 1));
        step = 0;
        renderStage();
        renderRules();
        renderBaskets();
    }

    // --------- Commandes : toutes reliées aux mêmes données ----------
    playButton.addEventListener("click", play);
    nextButton.addEventListener("click", () => { stop(); advance(); });
    lastButton.addEventListener("click", () => {
        stop(); step = stages.length - 1; renderStage();
    });
    resetButton.addEventListener("click", () => {
        stop(); step = 0; renderStage();
    });
    timeline.addEventListener("input", () => {
        stop(); step = Number(timeline.value); renderStage();
    });
    threshold.addEventListener("input", recompute);
    confidence.addEventListener("input", renderRules);
    speed.addEventListener("change", () => {
        if (timer !== null) { stop(); play(); }
    });
    $("as-add-basket").addEventListener("click", () => {
        P.baskets.push([]);
        $("as-edit-status").textContent =
            "Panier vide T" + P.baskets.length + " ajouté. Complétez-le en cliquant dans le tableau.";
        recompute();
    });
    $("as-restore").addEventListener("click", () => {
        P.baskets.splice(0, P.baskets.length,
            ...initialBaskets.map(items => items.slice()));
        $("as-edit-status").textContent =
            "Les " + P.baskets.length + " paniers d'origine ont été rétablis.";
        recompute();
    });
    recompute();
}());
