"use strict";
// Animation exacte du comptage d'itemsets et de l'élagage Apriori.
(function () {
    const P = window.Patterns;
    const $ = id => document.getElementById(id);
    const threshold = $("ap-minsup");
    const speed = $("ap-speed");
    const timeline = $("ap-step");
    const start = $("ap-play");
    const next = $("ap-next");
    const end = $("ap-last");
    const reset = $("ap-reset");
    const confidence = $("ap-minconf");
    let result, stages, index = 0, timer = null;
    const formatSet = items => "{" + items.join(", ") + "}";

    const svg = d3.select("#ap-bars").append("svg")
        .attr("role", "img").attr("aria-label",
            "Supports comptés et itemsets fréquents au niveau sélectionné");

    function draw(rows) {
        const w = 770;
        const rowH = 31;
        const top = 24;
        const h = Math.max(85, top + rows.length * rowH + 18);
        svg.attr("viewBox", `0 0 ${w} ${h}`);
        const x = d3.scaleLinear().domain([0, P.baskets.length])
            .range([0, 410]);
        const groups = svg.selectAll("g.pm-bar-row")
            .data(rows, d => d.items.join("|"))
            .join(enter => {
                const g = enter.append("g").attr("class", "pm-bar-row");
                g.append("text").attr("class", "pm-bar-label");
                g.append("rect").attr("class", "pm-bar-bg");
                g.append("rect").attr("class", "pm-bar-actual");
                g.append("text").attr("class", "pm-bar-value");
                return g;
            });
        groups.attr("transform", (_, i) =>
            `translate(0,${top + i * rowH})`);
        groups.select(".pm-bar-label").attr("x", 165)
            .attr("y", 17).attr("text-anchor", "end")
            .text(d => formatSet(d.items));
        groups.select(".pm-bar-bg").attr("x", 185)
            .attr("y", 2).attr("rx", 4)
            .attr("height", 23).attr("width", x(P.baskets.length));
        groups.select(".pm-bar-actual").attr("x", 185)
            .attr("y", 2).attr("rx", 4)
            .attr("height", 23)
            .attr("fill", d => d.frequent ? "#488c82" : "#c4cdd7")
            .attr("width", 0).transition().duration(280)
            .attr("width", d => x(d.count));
        groups.select(".pm-bar-value").attr("x", d => 195 + x(d.count))
            .attr("y", 18)
            .text(d => d.count + " / " + P.baskets.length);
        const min = +threshold.value;
        svg.selectAll("line.pm-threshold")
            .data([min]).join("line").attr("class", "pm-threshold")
            .attr("x1", 185 + x(min)).attr("x2", 185 + x(min))
            .attr("y1", 0).attr("y2", h - 8);
        svg.selectAll("text.pm-threshold-label")
            .data([min]).join("text")
            .attr("class", "pm-threshold-label")
            .attr("x", 190 + x(min)).attr("y", 11)
            .text("minsup = " + min);
    }

    function render() {
        const stage = stages[index];
        const isCandidate = stage.phase === "candidates";
        const name = (isCandidate ? "C" : "L") + stage.k;
        $("ap-stage").textContent = name;
        $("ap-stage-title").textContent = isCandidate
            ? "Compter les candidats de taille " + stage.k
            : "Garder les itemsets fréquents de taille " + stage.k;
        $("ap-stage-desc").textContent = isCandidate
            ? "Chaque barre indique le nombre de transactions contenant l'itemset. " +
              (stage.pruned ? stage.pruned + " candidats ont été élagués avant comptage." :
               "Les supports sont comparés au seuil minimal.")
            : stage.rows.length + " itemset(s) franchissent le seuil. " +
              "Ils servent à générer les candidats du niveau suivant.";
        $("ap-stage-count").textContent = stage.rows.length;
        $("ap-frequent-total").textContent = result.allFrequent.length;
        timeline.value = index;
        $("ap-step-value").textContent =
            (index + 1) + " / " + stages.length;
        next.disabled = index >= stages.length - 1;
        end.disabled = index >= stages.length - 1;
        draw(stage.rows);
    }
    function stop() {
        if (timer !== null) clearInterval(timer);
        timer = null;
        start.textContent = "Lancer";
    }
    function advance() {
        if (index < stages.length - 1) {
            index++;
            render();
        } else stop();
    }
    function play() {
        if (timer !== null) { stop(); return; }
        if (index === stages.length - 1) index = 0;
        render();
        start.textContent = "Pause";
        timer = setInterval(advance, Number(speed.value));
    }
    function renderRules() {
        const minConf = Number(confidence.value) / 100;
        $("ap-conf-value").textContent = Number(confidence.value) + " %";
        const filtered = P.rules(result.allFrequent)
            .filter(rule => rule.confidence >= minConf - 1e-10);
        $("ap-rules-count").textContent = filtered.length;
        const body = d3.select("#ap-rules-body");
        const tr = body.selectAll("tr").data(filtered, d =>
            d.left.join("|") + "->" + d.right.join("|"))
            .join("tr");
        tr.selectAll("td").data(d => [
            formatSet(d.left) + " ⇒ " + formatSet(d.right),
            P.percent(d.support, 1),
            P.percent(d.confidence, 1),
            d.lift.toLocaleString("fr-FR", {
                minimumFractionDigits: 2, maximumFractionDigits: 2
            })
        ]).join("td").text(d => d);
        $("ap-empty-rules").hidden = filtered.length > 0;
    }
    function compute() {
        stop();
        const count = Number(threshold.value);
        $("ap-minsup-value").textContent = count + " sur 12 (" +
            P.percent(count / P.baskets.length, 1) + ")";
        result = P.apriori(count);
        stages = result.levels;
        timeline.max = Math.max(0, stages.length - 1);
        index = 0;
        render();
        renderRules();
    }
    start.addEventListener("click", play);
    next.addEventListener("click", () => {stop(); advance();});
    end.addEventListener("click", () => {
        stop(); index = stages.length - 1; render();
    });
    reset.addEventListener("click", () => {stop(); index = 0; render();});
    timeline.addEventListener("input", () => {
        stop(); index = Number(timeline.value); render();
    });
    threshold.addEventListener("input", compute);
    confidence.addEventListener("input", renderRules);
    speed.addEventListener("change", () => {
        if (timer !== null) {stop(); play();}
    });
    compute();
}());
