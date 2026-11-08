"use strict";
(function () {
    const metric = document.getElementById("dist-metric");
    const w=650,h=365,m={left:52,right:30,top:20,bottom:42};
    const sx=d3.scaleLinear().domain([0,6]).range([m.left,w-m.right]);
    const sy=d3.scaleLinear().domain([0,6]).range([h-m.bottom,m.top]);
    const plot=d3.select("#distance-plot").append("svg")
        .attr("viewBox",`0 0 ${w} ${h}`)
        .attr("role","img").attr("aria-label","Deux points déplaçables et une distance");
    for(let i=0;i<=6;i++){
        plot.append("line").attr("x1",sx(i)).attr("x2",sx(i))
            .attr("y1",sy(6)).attr("y2",sy(0)).attr("stroke","#edf2f6");
        plot.append("line").attr("x1",sx(0)).attr("x2",sx(6))
            .attr("y1",sy(i)).attr("y2",sy(i)).attr("stroke","#edf2f6");
    }
    plot.append("g").attr("transform",`translate(0,${sy(0)})`)
        .call(d3.axisBottom(sx).ticks(6)).call(g=>g.selectAll("text").attr("fill","#8292a1"));
    plot.append("g").attr("transform",`translate(${sx(0)},0)`)
        .call(d3.axisLeft(sy).ticks(6)).call(g=>g.selectAll("text").attr("fill","#8292a1"));
    const geom=plot.append("g").attr("pointer-events","none");
    const dots=plot.append("g");
    const points=[{name:"A",x:1,y:1},{name:"B",x:4,y:5}];
    const dot=dots.selectAll("g").data(points).join("g")
        .style("cursor","grab")
        .call(d3.drag().on("drag",function(event,d){
            d.x=Math.max(0,Math.min(6,sx.invert(event.x)));
            d.y=Math.max(0,Math.min(6,sy.invert(event.y)));
            update();
        }));
    dot.append("circle").attr("r",9).attr("fill","#d28d59")
        .attr("stroke","white").attr("stroke-width",2);
    dot.append("text").attr("x",13).attr("y",-13)
        .attr("font-size",13).attr("font-weight",700)
        .attr("fill","#415b74").text(d=>d.name);
    function update(){
        const [a,b]=points,kind=metric.value;
        geom.selectAll("*").remove();
        if(kind==="euclidean"){
            geom.append("line").attr("x1",sx(a.x)).attr("y1",sy(a.y))
                .attr("x2",sx(b.x)).attr("y2",sy(b.y))
                .attr("stroke","#447aa6").attr("stroke-width",2.8);
        }else if(kind==="manhattan"){
            geom.append("path").attr("d",`M${sx(a.x)},${sy(a.y)}L${sx(b.x)},${sy(a.y)}L${sx(b.x)},${sy(b.y)}`)
                .attr("fill","none").attr("stroke","#447aa6")
                .attr("stroke-width",2.8);
        }else if(kind==="chebyshev"){
            geom.append("rect").attr("x",sx(Math.min(a.x,b.x)))
                .attr("y",sy(Math.max(a.y,b.y)))
                .attr("width",Math.abs(sx(a.x)-sx(b.x)))
                .attr("height",Math.abs(sy(a.y)-sy(b.y)))
                .attr("fill","#447aa6").attr("fill-opacity",.075)
                .attr("stroke","#447aa6").attr("stroke-dasharray","6 4");
        }else{
            for(const p of points){
                geom.append("line").attr("x1",sx(0)).attr("y1",sy(0))
                    .attr("x2",sx(p.x)).attr("y2",sy(p.y))
                    .attr("stroke",p===a?"#447aa6":"#d28d59")
                    .attr("stroke-width",2.5);
            }
        }
        dot.attr("transform",d=>`translate(${sx(d.x)},${sy(d.y)})`);
        const dx=a.x-b.x,dy=a.y-b.y;
        let value,description;
        if(kind==="euclidean"){
            value=Math.hypot(dx,dy);
            description="Distance directe : √(Δx² + Δy²).";
        }else if(kind==="manhattan"){
            value=Math.abs(dx)+Math.abs(dy);
            description="Trajet suivant les axes : |Δx| + |Δy|.";
        }else if(kind==="chebyshev"){
            value=Math.max(Math.abs(dx),Math.abs(dy));
            description="Le rectangle indique les écarts : distance = max(|Δx|,|Δy|).";
        }else{
            const na=Math.hypot(a.x,a.y),nb=Math.hypot(b.x,b.y);
            value=na*nb<1e-9?null:(a.x*b.x+a.y*b.y)/(na*nb);
            description="Similarité de direction par rapport à l’origine. Indéfinie si un vecteur est nul.";
        }
        document.getElementById("dist-a").textContent=`(${a.x.toFixed(1)} ; ${a.y.toFixed(1)})`;
        document.getElementById("dist-b").textContent=`(${b.x.toFixed(1)} ; ${b.y.toFixed(1)})`;
        document.getElementById("dist-value").textContent=value===null?"non définie":value.toFixed(3);
        document.getElementById("dist-desc").textContent=description;
    }
    metric.addEventListener("change",update);
    update();
    // Boules unités de rayon 1 dans les métriques L2, L1 et L∞.
    const balls=d3.select("#distance-balls").append("svg").attr("viewBox","0 0 440 140")
        .attr("role","img").attr("aria-label","Cercle, losange et carré pour trois métriques");
    const shapes=["Euclidienne","Manhattan","Chebyshev"];
    shapes.forEach((name,i)=>{
        const cx=76+i*145,cy=67,r=35;
        balls.append("line").attr("x1",cx-46).attr("x2",cx+46).attr("y1",cy).attr("y2",cy).attr("stroke","#dee7ef");
        balls.append("line").attr("x1",cx).attr("x2",cx).attr("y1",cy-44).attr("y2",cy+44).attr("stroke","#dee7ef");
        if(i===0)balls.append("circle").attr("cx",cx).attr("cy",cy).attr("r",r);
        if(i===1)balls.append("path").attr("d",`M${cx},${cy-r}L${cx+r},${cy}L${cx},${cy+r}L${cx-r},${cy}Z`);
        if(i===2)balls.append("rect").attr("x",cx-r).attr("y",cy-r).attr("width",2*r).attr("height",2*r);
        balls.append("circle").attr("cx",cx).attr("cy",cy).attr("r",2.5).attr("fill","#3a708c");
        balls.append("text").attr("x",cx).attr("y",126).attr("text-anchor","middle")
            .attr("font-size",11).attr("fill","#64778b").text(name);
    });
    balls.selectAll("circle:not([fill]),rect,path").attr("stroke","#447aa6")
        .attr("fill","#447aa6").attr("fill-opacity",.1).attr("stroke-width",2);
}());
