"use strict";
(function () {
    const pts = ML.dataset("blobs", 887);
    const training = pts.map((p,i) => ({...p, group:i<50?0:i<100?1:2}));
    let query={x:55,y:44};
    const $=id=>document.getElementById(id);
    function distance(a,b,m) {
        const dx=Math.abs(a.x-b.x),dy=Math.abs(a.y-b.y);
        if(m==="manhattan")return dx+dy;
        if(m==="chebyshev")return Math.max(dx,dy);
        return Math.hypot(dx,dy);
    }
    function update() {
        const k=Number($("knn-k").value),metric=$("knn-metric").value;
        const nearest=training.map((p,i)=>({i,d:distance(p,query,metric)}))
            .sort((a,b)=>a.d-b.d||a.i-b.i).slice(0,k);
        const votes=[0,0,0];
        nearest.forEach(v=>votes[training[v.i].group]++);
        const predict=votes.indexOf(Math.max(...votes));
        const g=ML.scatter("#knn-plot",training,training.map(p=>p.group),
            {xLabel:"Caractéristique 1",yLabel:"Caractéristique 2",
                aria:"KNN : observations et voisins d'une nouvelle observation"});
        g.svg.append("g").selectAll("circle").data(nearest).join("circle")
            .attr("cx",v=>g.sx(training[v.i].x))
            .attr("cy",v=>g.sy(training[v.i].y))
            .attr("r",7).attr("fill","none")
            .attr("stroke","#cb8c42").attr("stroke-width",2);
        g.svg.append("path").attr("d","M-8 0H8M0 -8V8")
            .attr("transform",`translate(${g.sx(query.x)},${g.sy(query.y)})`)
            .attr("stroke","#172e45").attr("stroke-width",3)
            .attr("pointer-events","none");
        g.rect.on("click",function(event) {
            const [px,py]=d3.pointer(event,g.svg.node());
            query={x:Math.max(0,Math.min(100,g.sx.invert(px))),
                y:Math.max(0,Math.min(100,g.sy.invert(py)))};
            update();
        });
        $("knn-pred").textContent="Classe "+(predict+1);
        $("knn-votes").textContent=votes.join(" / ");
    }
    $("knn-k").addEventListener("change",update);
    $("knn-metric").addEventListener("change",update);
    update();
}());
