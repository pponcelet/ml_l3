"use strict";
// Recherche par niveaux de motifs séquentiels : version pédagogique de GSP.
(function () {
    const P = window.Patterns;
    const $ = id => document.getElementById(id);
    const threshold = $("gsp-minsup");
    const speed = $("gsp-speed");
    const timeline = $("gsp-step");
    const btnPlay = $("gsp-play");
    const btnNext = $("gsp-next");
    const btnLast = $("gsp-last");
    const btnReset = $("gsp-reset");
    let stages = [], index = 0, selected = null, timer = null;
    const svg = d3.select("#gsp-bars").append("svg")
        .attr("role", "img")
        .attr("aria-label", "Supports des candidats séquentiels");
    const fmt = values => "⟨" + values.join(" → ") + "⟩";
    function stop() {
        if (timer !== null) clearInterval(timer);
        timer = null;
        btnPlay.textContent = "Lancer";
    }
    function renderRows(stage) {
        const w = 760, rowH = 30;
        const h = Math.max(80, 28 + stage.rows.length * rowH + 16);
        svg.attr("viewBox", `0 0 ${w} ${h}`);
        const x = d3.scaleLinear().domain([0, P.sequences.length])
            .range([0, 385]);
        const g = svg.selectAll("g.pm-bar-row")
            .data(stage.rows, d => d.items.join("|"))
            .join(enter => {
                const row = enter.append("g").attr("class", "pm-bar-row pm-clickable");
                row.append("text").attr("class", "pm-bar-label");
                row.append("rect").attr("class", "pm-bar-bg");
                row.append("rect").attr("class", "pm-bar-actual");
                row.append("text").attr("class", "pm-bar-value");
                return row;
            });
        g.attr("transform", (_, i) => `translate(0,${24 + i * rowH})`)
            .attr("tabindex", 0)
            .attr("role", "button")
            .attr("aria-label", d => fmt(d.items) + " : support " + d.count)
            .on("click", (_, d) => {selected = d.items.slice(); renderExample();})
            .on("keydown", (event, d) => {
                if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    selected = d.items.slice(); renderExample();
                }
            });
        g.select(".pm-bar-label").attr("x", 185)
            .attr("y", 17).attr("text-anchor", "end")
            .text(d => fmt(d.items));
        g.select(".pm-bar-bg").attr("x", 206).attr("y", 2)
            .attr("width", x(P.sequences.length))
            .attr("height", 22).attr("rx", 4);
        g.select(".pm-bar-actual").attr("x", 206).attr("y", 2)
            .attr("height", 22).attr("rx", 4)
            .attr("fill", d => d.frequent ? "#498c81" : "#c2cdd7")
            .attr("width", 0).transition().duration(280)
            .attr("width", d => x(d.count));
        g.select(".pm-bar-value").attr("x", d => 216 + x(d.count))
            .attr("y", 17).text(d => d.count + " / " + P.sequences.length);
        const min = +threshold.value;
        svg.selectAll("line.pm-threshold").data([min]).join("line")
            .attr("class", "pm-threshold")
            .attr("x1", 206 + x(min)).attr("x2", 206 + x(min))
            .attr("y1", 0).attr("y2", h - 8);
        svg.selectAll("text.pm-threshold-label").data([min])
            .join("text").attr("class", "pm-threshold-label")
            .attr("x", 212 + x(min)).attr("y", 10)
            .text("minsup = " + min);
    }
    function renderExample() {
        if (!selected) {
            $("gsp-selected-title").textContent = "Sélectionnez un motif dans le graphique.";
            $("gsp-selected-list").replaceChildren();
            return;
        }
        $("gsp-selected-title").textContent = fmt(selected) +
            " : " + P.supportSequence(selected) + " historique(s) sur 8";
        const list = d3.select("#gsp-selected-list");
        const li = list.selectAll("li").data(P.sequences).join("li")
            .classed("pm-match", d => P.matchIndices(selected, d) !== null);
        li.text((seq, i) => {
            const match = P.matchIndices(selected, seq);
            return "H" + (i + 1) + " : " + seq.join(" → ") +
                (match === null ? " · absent" : " · présent");
        });
    }
    function render() {
        const stage = stages[index];
        $("gsp-stage").textContent =
            (stage.phase === "candidates" ? "C" : "L") + stage.k;
        $("gsp-stage-title").textContent = stage.phase === "candidates"
            ? "Candidats de longueur " + stage.k
            : "Motifs fréquents de longueur " + stage.k;
        $("gsp-stage-desc").textContent = stage.phase === "candidates"
            ? "Les sous-séquences d'un motif candidat doivent toutes être fréquentes. " +
              (stage.pruned ? stage.pruned + " candidat(s) élagué(s) avant comptage." :
                "Comptez les historiques contenant chaque motif.")
            : "Seuls les motifs dont le support atteint le seuil sont conservés.";
        $("gsp-stage-count").textContent = stage.rows.length;
        timeline.value = index;
        $("gsp-step-value").textContent = (index + 1) + " / " + stages.length;
        btnNext.disabled = index >= stages.length - 1;
        btnLast.disabled = index >= stages.length - 1;
        const rows = stage.rows;
        selected = rows.length ? rows[0].items.slice() : null;
        renderRows(stage);
        renderExample();
    }
    function advance() {
        if (index < stages.length - 1) {index++; render();}
        else stop();
    }
    function play() {
        if (timer !== null) {stop(); return;}
        if (index >= stages.length - 1) index = 0;
        render();
        btnPlay.textContent = "Pause";
        timer = setInterval(advance, Number(speed.value));
    }
    function compute() {
        stop();
        const min = Number(threshold.value);
        $("gsp-minsup-value").textContent = min + " sur 8 (" +
            P.percent(min / P.sequences.length, 1) + ")";
        stages = P.gsp(min, 3);
        index = 0;
        timeline.max = Math.max(0, stages.length - 1);
        render();
    }
    btnPlay.addEventListener("click", play);
    btnNext.addEventListener("click", () => {stop(); advance();});
    btnLast.addEventListener("click", () => {
        stop(); index = stages.length - 1; render();
    });
    btnReset.addEventListener("click", () => {stop(); index = 0; render();});
    timeline.addEventListener("input", () => {
        stop(); index = Number(timeline.value); render();
    });
    threshold.addEventListener("input", compute);
    speed.addEventListener("change", () => {
        if (timer !== null) {stop(); play();}
    });
    compute();
}());
