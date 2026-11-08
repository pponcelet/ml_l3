"use strict";
// Page unique : historiques éditables -> motifs -> GSP simplifié.
// Les résultats de la recherche et les supports sont calculés sur P.sequences.
(function () {
    const P = window.Patterns;
    const $ = id => document.getElementById(id);
    const initialSequences = P.sequences.map(s => s.slice());
    const alphabet = P.alphabet;
    const tableRoot = $("seq-table");
    const example = $("seq-example");
    const threshold = $("seq-minsup");
    const speed = $("seq-speed");
    const stepSlider = $("seq-step");
    const btnPlay = $("seq-play");
    const btnNext = $("seq-next");
    const btnResult = $("seq-result");
    const resultsRoot = $("seq-results-body");
    const format = items => "⟨" + items.join(" → ") + "⟩";
    const key = items => items.join("|");

    let motif = ["A", "C"];
    let stages = [];
    let allFrequent = [];
    let selectedKey = key(motif);
    let step = 0;
    let timer = null;

    function stop() {
        if (timer !== null) clearInterval(timer);
        timer = null;
        btnPlay.textContent = "Lancer";
    }
    function updateThreshold() {
        const n = P.sequences.length;
        threshold.max = n;
        threshold.value = Math.min(n, Math.max(1, Number(threshold.value)));
        $("seq-minsup-value").textContent = threshold.value + " sur " + n +
            " (" + P.percent(Number(threshold.value) / n, 1) + ")";
    }
    function matchSequence(sequence) {
        return motif.length ? P.matchIndices(motif, sequence) : null;
    }

    // Base éditable : un clic fait défiler A, B, C, D, puis supprime.
    function drawTable() {
        const count = Math.max(4, ...P.sequences.map(seq => seq.length + 1));
        const slots = Math.min(8, count);
        const table = document.createElement("table");
        table.className = "pm-basket-table pm-seq-table";
        table.setAttribute("aria-label", "Historiques d'événements modifiables");
        const head = document.createElement("thead");
        const trHead = document.createElement("tr");
        ["Historique", ...Array.from({length: slots}, (_, i) =>
            "Position " + (i + 1)), "Action", "Motif présent ?"].forEach(label => {
            const th = document.createElement("th");
            th.textContent = label;
            th.scope = "col";
            trHead.appendChild(th);
        });
        head.appendChild(trHead);
        table.appendChild(head);
        const body = document.createElement("tbody");
        P.sequences.forEach((seq, rowIndex) => {
            const row = document.createElement("tr");
            const heading = document.createElement("th");
            heading.scope = "row";
            heading.textContent = "H" + (rowIndex + 1);
            row.appendChild(heading);
            for (let j = 0; j < slots; j++) {
                const td = document.createElement("td");
                const button = document.createElement("button");
                button.type = "button";
                button.className = "pm-seq-cell";
                const active = j < seq.length;
                const canAdd = j === seq.length && seq.length < 8;
                button.textContent = active ? seq[j] : (canAdd ? "+" : "");
                button.disabled = !active && !canAdd;
                button.dataset.row = rowIndex;
                button.dataset.pos = j;
                button.setAttribute("aria-label", active
                    ? "Historique " + (rowIndex + 1) + ", position " +
                      (j + 1) + ", événement " + seq[j] +
                      ". Cliquez pour changer ou supprimer."
                    : "Historique " + (rowIndex + 1) +
                      ", ajouter un événement en position " + (j + 1));
                button.addEventListener("click", () => {
                    const current = P.sequences[rowIndex];
                    if (j === current.length) {
                        if (current.length < 8) current.push("A");
                        $("seq-edit-status").textContent =
                            "Événement ajouté à l'historique H" + (rowIndex + 1) + ".";
                    } else if (current[j] === "D") {
                        current.splice(j, 1);
                        $("seq-edit-status").textContent =
                            "Événement supprimé dans H" + (rowIndex + 1) + ".";
                    } else {
                        current[j] = alphabet[alphabet.indexOf(current[j]) + 1];
                        $("seq-edit-status").textContent =
                            "Événement modifié dans H" + (rowIndex + 1) + ".";
                    }
                    compute();
                    const focus = tableRoot.querySelector(
                        `.pm-seq-cell[data-row="${rowIndex}"][data-pos="${j}"]`);
                    if (focus && !focus.disabled) focus.focus();
                });
                td.appendChild(button);
                row.appendChild(td);
            }
            const action = document.createElement("td");
            const remove = document.createElement("button");
            remove.type = "button";
            remove.className = "pm-seq-delete";
            remove.textContent = "−";
            remove.disabled = P.sequences.length <= 2;
            remove.setAttribute("aria-label", "Supprimer l'historique H" + (rowIndex + 1));
            remove.title = "Supprimer cet historique";
            remove.addEventListener("click", () => {
                P.sequences.splice(rowIndex, 1);
                $("seq-edit-status").textContent =
                    "Historique H" + (rowIndex + 1) + " supprimé.";
                compute();
            });
            action.appendChild(remove);
            row.appendChild(action);
            const found = document.createElement("td");
            found.className = "pm-seq-yesno";
            row.appendChild(found);
            body.appendChild(row);
        });
        table.appendChild(body);
        tableRoot.replaceChildren(table);
        $("seq-data-summary").textContent = P.sequences.length +
            " historiques · " + alphabet.length + " événements possibles";
        highlightTable();
    }

    // Une seule sous-séquence trouvée par historique est surlignée.
    function highlightTable() {
        const rows = tableRoot.querySelectorAll("tbody tr");
        let hits = 0;
        rows.forEach((row, i) => {
            const indices = matchSequence(P.sequences[i]);
            if (indices !== null) hits++;
            const selected = new Set(indices || []);
            row.classList.toggle("pm-seq-matching", indices !== null);
            const status = row.querySelector(".pm-seq-yesno");
            if (status) status.textContent = !motif.length ? "—" :
                (indices === null ? "Non" : "Oui");
            row.querySelectorAll(".pm-seq-cell").forEach(button => {
                button.classList.toggle("pm-seq-highlight",
                    indices !== null && selected.has(Number(button.dataset.pos)));
            });
        });
        $("seq-pattern").textContent = motif.length
            ? format(motif) : "(aucun événement)";
        $("seq-support").textContent = (motif.length ? hits : 0) +
            " / " + P.sequences.length;
        $("seq-rate").textContent = P.percent(
            motif.length ? hits / P.sequences.length : 0, 1);
        $("seq-pattern-caption").textContent = motif.length
            ? "Le motif apparaît dans " + hits + " historique(s). " +
              "Les cases bleues indiquent une occurrence possible, " +
              "avec des événements intermédiaires autorisés."
            : "Ajoutez au moins un événement pour chercher un motif.";
        const matches = d3.select("#seq-matches").selectAll("li")
            .data(P.sequences).join("li")
            .classed("pm-match", s => motif.length && matchSequence(s) !== null);
        matches.text((s, i) => "H" + (i + 1) + " : " +
            (s.length ? s.join(" → ") : "(vide)") +
            (motif.length && matchSequence(s) !== null
                ? " · présent" : " · absent"));
        $("seq-selected-summary").textContent = motif.length
            ? format(motif) + " — " + hits + " historique(s) sur " +
              P.sequences.length : "Choisissez un motif.";
    }
    function chooseMotif(items) {
        motif = items.slice();
        selectedKey = key(motif);
        const preset = [...example.options].find(o =>
            o.value !== "custom" && o.value === motif.join(""));
        example.value = preset ? preset.value : "custom";
        highlightTable();
        d3.select("#seq-results-body").selectAll("tr")
            .classed("pm-seq-selected", row => key(row.items) === selectedKey);
    }

    // Dessiner un niveau de GSP : mêmes calculs que ceux des résultats.
    const svg = d3.select("#seq-bars").append("svg")
        .attr("role", "img")
        .attr("aria-label", "Supports des motifs séquentiels candidats");
    function drawBars(rows) {
        const w = 780, rowH = 30, top = 26;
        const h = Math.max(85, top + rows.length * rowH + 15);
        const n = P.sequences.length;
        svg.attr("viewBox", `0 0 ${w} ${h}`);
        const scale = d3.scaleLinear().domain([0, n]).range([0, 385]);
        const groups = svg.selectAll("g.pm-bar-row")
            .data(rows, d => key(d.items)).join(enter => {
                const group = enter.append("g")
                    .attr("class", "pm-bar-row pm-clickable");
                group.append("text").attr("class", "pm-bar-label");
                group.append("rect").attr("class", "pm-bar-bg");
                group.append("rect").attr("class", "pm-bar-actual");
                group.append("text").attr("class", "pm-bar-value");
                return group;
            });
        groups.attr("transform", (_, i) =>
            `translate(0,${top + i * rowH})`)
            .attr("tabindex", 0).attr("role", "button")
            .attr("aria-label", d => format(d.items) + " : support " + d.count)
            .on("click", (_, d) => chooseMotif(d.items))
            .on("keydown", (event, d) => {
                if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    chooseMotif(d.items);
                }
            });
        groups.select(".pm-bar-label")
            .attr("x", 187).attr("y", 18)
            .attr("text-anchor", "end")
            .text(d => format(d.items));
        groups.select(".pm-bar-bg")
            .attr("x", 208).attr("y", 2)
            .attr("rx", 4).attr("height", 22).attr("width", scale(n));
        groups.select(".pm-bar-actual").interrupt()
            .attr("x", 208).attr("y", 2)
            .attr("rx", 4).attr("height", 22)
            .attr("fill", d => d.frequent ? "#448c80" : "#c3ced8")
            .attr("width", 0).transition().duration(230)
            .attr("width", d => scale(d.count));
        groups.select(".pm-bar-value")
            .attr("x", d => 219 + scale(d.count))
            .attr("y", 18)
            .text(d => d.count + " / " + n);
        const min = Number(threshold.value);
        svg.selectAll("line.pm-threshold")
            .data([min]).join("line").attr("class", "pm-threshold")
            .attr("x1", 208 + scale(min))
            .attr("x2", 208 + scale(min))
            .attr("y1", 0).attr("y2", h - 7);
        svg.selectAll("text.pm-threshold-label")
            .data([min]).join("text")
            .attr("class", "pm-threshold-label")
            .attr("x", 213 + scale(min)).attr("y", 11)
            .text("minsup = " + min);
    }
    function renderStage() {
        const stage = stages[step];
        if (!stage) return;
        const candidate = stage.phase === "candidates";
        $("seq-stage").textContent = stage.phase === "summary"
            ? "Bilan" : (candidate ? "C" : "L") + stage.k;
        $("seq-stage-title").textContent = stage.phase === "summary"
            ? "Tous les motifs fréquents (longueur ≤ 3)"
            : candidate ? "Candidats de longueur " + stage.k
                : "Motifs fréquents de longueur " + stage.k;
        $("seq-stage-desc").textContent = stage.phase === "summary"
            ? "La liste complète se trouve dans le tableau des résultats, plus bas."
            : candidate
                ? "Comptage des supports. " +
                  (stage.pruned ? stage.pruned +
                   " candidat(s) éliminé(s) avant comptage." :
                   "Les sous-séquences plus courtes doivent être fréquentes.")
                : "Seuls les motifs atteignant le support minimal sont conservés.";
        $("seq-stage-count").textContent = stage.rows.length;
        $("seq-frequent-count").textContent = allFrequent.length;
        stepSlider.value = step;
        $("seq-step-value").textContent = (step + 1) + " / " + stages.length;
        btnNext.disabled = step >= stages.length - 1;
        btnResult.disabled = step >= stages.length - 1;
        drawBars(stage.rows);
    }
    function advance() {
        if (step < stages.length - 1) {
            step++;
            renderStage();
        } else stop();
    }
    function play() {
        if (timer !== null) {stop(); return;}
        if (step >= stages.length - 1) step = 0;
        renderStage();
        btnPlay.textContent = "Pause";
        timer = setInterval(() => {
            if (step >= stages.length - 1) {stop(); return;}
            advance();
            if (step >= stages.length - 1) stop();
        }, Number(speed.value));
    }
    function drawResults() {
        $("seq-result-info").textContent = allFrequent.length +
            " motifs fréquents (longueur 1 à 3, support minimal " +
            threshold.value + " / " + P.sequences.length + ").";
        const rows = d3.select(resultsRoot).selectAll("tr")
            .data(allFrequent, d => key(d.items)).join("tr")
            .attr("tabindex", 0).attr("role", "button")
            .attr("aria-label", d => "Choisir le motif " + format(d.items))
            .classed("pm-seq-selected", d => key(d.items) === selectedKey)
            .on("click", (_, d) => chooseMotif(d.items))
            .on("keydown", (event, d) => {
                if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    chooseMotif(d.items);
                }
            });
        rows.selectAll("td").data(d => [
            format(d.items), d.items.length,
            d.count + " / " + P.sequences.length,
            P.percent(d.count / P.sequences.length, 1)
        ]).join("td").text(d => d);
    }
    function compute() {
        stop();
        updateThreshold();
        const levels = P.gsp(Number(threshold.value), 3);
        allFrequent = levels.filter(s => s.phase === "frequent")
            .flatMap(s => s.rows)
            .sort((a, b) => a.items.length - b.items.length ||
                b.count - a.count || key(a.items).localeCompare(key(b.items), "fr"));
        stages = levels.concat([{
            phase: "summary", k: 0,
            rows: allFrequent, pruned: 0
        }]);
        step = 0;
        stepSlider.max = stages.length - 1;
        drawTable();
        drawResults();
        renderStage();
        highlightTable();
    }

    // Interactions indépendantes, toutes fondées sur P.sequences.
    $("seq-new-row").addEventListener("click", () => {
        if (P.sequences.length >= 16) return;
        P.sequences.push(["A"]);
        $("seq-edit-status").textContent = "Nouvel historique ajouté.";
        compute();
    });
    $("seq-original").addEventListener("click", () => {
        P.sequences.splice(0, P.sequences.length,
            ...initialSequences.map(s => s.slice()));
        $("seq-edit-status").textContent = "Données d'origine restaurées.";
        compute();
    });
    example.addEventListener("change", () => {
        chooseMotif(example.value === "custom" ? [] : example.value.split(""));
    });
    $("seq-add").querySelectorAll("button[data-event]").forEach(button => {
        button.addEventListener("click", () => {
            if (motif.length >= 4) return;
            chooseMotif([...motif, button.dataset.event]);
        });
    });
    $("seq-undo").addEventListener("click", () =>
        chooseMotif(motif.slice(0, -1)));
    $("seq-pattern-reset").addEventListener("click", () =>
        chooseMotif(["A", "C"]));
    threshold.addEventListener("input", compute);
    btnPlay.addEventListener("click", play);
    btnNext.addEventListener("click", () => {stop(); advance();});
    btnResult.addEventListener("click", () => {
        stop(); step = stages.length - 1; renderStage();
    });
    $("seq-restart").addEventListener("click", () => {
        stop(); step = 0; renderStage();
    });
    stepSlider.addEventListener("input", () => {
        stop(); step = Number(stepSlider.value); renderStage();
    });
    speed.addEventListener("change", () => {
        if (timer !== null) {stop(); play();}
    });
    compute();
}());
