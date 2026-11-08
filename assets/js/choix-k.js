"use strict";
// Heuristiques pour choisir K (coude et silhouette).
(function () {
    const $ = id => document.getElementById(id);
    const data=ML.dataset("blobs",124);
    let scores=[],choice=3;
    function compute() {
        $("choice-explain").textContent="Calcul des courbes en cours…";
        // Libère l'affichage avant le calcul synchrone, court sur 150 points.
        setTimeout(() => {
            scores = [];
            for (let k=1;k<=8;k++) {
                const fit=ML.fitKmeans(data,k,118,7);
                scores.push({k,fit,inertia:fit.inertia,
                    silhouette:k===1?null:ML.silhouette(data,fit.labels)});
            }
            drawCurves();showChoice(choice);
        },20);
    }
    function curve(el,key,ylabel) {
        const w=365,h=245,m={l:58,r:16,t:17,b:35};
        const values=scores.filter(p=>p[key]!==null);
        const sx=d3.scaleLinear().domain([1,8]).range([m.l,w-m.r]);
        const max=d3.max(values,d=>d[key]),min=d3.min(values,d=>d[key]);
        const dy=Math.max(.05,(max-min)*.18);
        const sy=d3.scaleLinear().domain([Math.max(0,min-dy),max+dy]).range([h-m.b,m.t]);
        const svg=d3.select(el).selectAll("svg").data([0]).join("svg")
            .attr("viewBox",`0 0 ${w} ${h}`)
            .attr("role","img").attr("aria-label",ylabel+" en fonction de K");
        svg.selectAll("*").remove();
        svg.append("g").attr("transform",`translate(0,${h-m.b})`)
            .call(d3.axisBottom(sx).ticks(8).tickFormat(d3.format("d")));
        svg.append("g").attr("transform",`translate(${m.l},0)`)
            .call(d3.axisLeft(sy).ticks(5).tickFormat(key==="inertia"?d3.format("~s"):d3.format(".2f")));
        svg.selectAll(".domain").attr("stroke","#c8d4df");
        svg.selectAll(".tick text").attr("fill","#7a8a9c").attr("font-size",10);
        svg.append("path").datum(values)
            .attr("d",d3.line().x(d=>sx(d.k)).y(d=>sy(d[key])))
            .attr("fill","none").attr("stroke","#447aa6").attr("stroke-width",2);
        svg.selectAll("circle.choice").data(values).join("circle")
            .attr("class","choice")
            .attr("cx",d=>sx(d.k)).attr("cy",d=>sy(d[key]))
            .attr("r",d=>d.k===choice?6:4.5)
            .attr("stroke","white").attr("stroke-width",1.5)
            .attr("fill",d=>d.k===choice?"#c57d3b":"#447aa6")
            .style("cursor","pointer")
            .append("title").text(d=>`K = ${d.k} : ${d[key].toFixed(3)}`);
        svg.selectAll("circle.choice").on("click",function(event,d) {
            showChoice(d.k);
            if(window.mlSetK)window.mlSetK(d.k);
        });
    }
    function drawCurves() {
        curve("#elbow-plot","inertia","Inertie");
        curve("#silhouette-plot","silhouette","Silhouette moyenne");
    }
    function showChoice(k) {
        choice=k;
        const score=scores.find(s=>s.k===k);
        if (!score)return;
        drawCurves();
        ML.scatter("#choice-partition",data,score.fit.labels,
            {aria:`Partition pour K = ${k}`,xLabel:"Caractéristique 1",
                yLabel:"Caractéristique 2"});
        $("choice-explain").textContent=`K = ${k} · inertie = `+
            `${Math.round(score.inertia).toLocaleString("fr-FR")} unités²`+
            (score.silhouette===null?" · silhouette non définie pour K = 1" :
                ` · silhouette moyenne = ${score.silhouette.toFixed(3)}`)+
            ". Cliquez sur un point d'une courbe pour comparer les partitions.";
    }
    $("choice-recompute").addEventListener("click",compute);
    compute();
}());
