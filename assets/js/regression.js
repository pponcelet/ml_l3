"use strict";
(function () {
    const random=ML.rng(2026),pts=[];
    for(let i=0;i<29;i++) {
        const x=9+3*i, y=14+.69*x+ML.gaussian(random)*7;
        pts.push({x,y});
    }
    const outlier={x:79,y:96};pts.push(outlier);
    const initial={...outlier};
    function update() {
        const n=pts.length, mx=d3.mean(pts,p=>p.x),my=d3.mean(pts,p=>p.y);
        let sumxy=0,sumxx=0;
        pts.forEach(p=>{sumxy+=(p.x-mx)*(p.y-my);sumxx+=(p.x-mx)**2;});
        const slope=sumxx?sumxy/sumxx:0,b=my-slope*mx;
        const mse=d3.mean(pts,p=>(p.y-slope*p.x-b)**2);
        const view=ML.scatter("#reg-plot",pts,[],{
            aria:"Régression linéaire : droite des moindres carrés et point déplaçable",
            xLabel:"Variable explicative",yLabel:"Cible numérique"});
        const sx=view.sx,sy=view.sy;
        view.svg.append("line")
            .attr("x1",sx(0)).attr("y1",sy(b))
            .attr("x2",sx(100)).attr("y2",sy(100*slope+b))
            .attr("stroke","#356b93").attr("stroke-width",2.4);
        const handle=view.svg.append("circle").attr("cx",sx(outlier.x))
            .attr("cy",sy(outlier.y)).attr("r",8)
            .attr("fill","#c57d3b").attr("stroke","white")
            .attr("stroke-width",1.7).style("cursor","grab");
        handle.call(d3.drag().subject(()=>({x:sx(outlier.x),y:sy(outlier.y)}))
            .on("drag",function(event){
                outlier.x=Math.max(2,Math.min(98,sx.invert(event.x)));
                outlier.y=Math.max(2,Math.min(98,sy.invert(event.y)));
                d3.select(this).attr("cx",sx(outlier.x)).attr("cy",sy(outlier.y));
            })
            .on("end",update));
        document.getElementById("reg-slope").textContent=slope.toFixed(3);
        document.getElementById("reg-intercept").textContent=b.toFixed(2);
        document.getElementById("reg-mse").textContent=mse.toFixed(1);
    }
    document.getElementById("reg-reset").addEventListener("click",()=>{
        outlier.x=initial.x;outlier.y=initial.y;update();
    });
    update();
}());
