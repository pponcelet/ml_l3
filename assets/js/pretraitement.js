"use strict";
(function () {
    const random=ML.rng(892);
    const pts=[];
    const groups=[[25,2300],[54,2300],[25,5900],[54,5900]];
    groups.forEach(([age,salaire])=>{
        for(let i=0;i<24;i++){
            pts.push({x:Math.max(18,Math.min(65,age+ML.gaussian(random)*5.2)),
                y:Math.max(1200,Math.min(7800,salaire+ML.gaussian(random)*900))});
        }
    });
    const selector=document.getElementById("scale-method");
    function standardize(method) {
        const result=pts.map(p=>({...p}));
        if(method==="raw")return result;
        for(const key of ["x","y"]){
            const vals=pts.map(p=>p[key]);
            const min=Math.min(...vals),max=Math.max(...vals);
            const mean=d3.mean(vals),std=d3.deviation(vals);
            result.forEach((p,i)=>{
                p[key]=method==="minmax"?(vals[i]-min)/(max-min):
                    (vals[i]-mean)/std;
            });
        }
        return result;
    }
    function update(){
        const method=selector.value;
        const result=ML.fitKmeans(standardize(method),3,179,8);
        ML.scatter("#scale-plot",pts,result.labels,{xDomain:[16,68],yDomain:[1000,8000],
            xLabel:"Âge (années)",yLabel:"Salaire (€)",
            aria:"Même nuage de points, couleur selon le prétraitement choisi"});
        document.getElementById("scale-status").textContent={
            raw:"Années et euros",minmax:"Deux variables [0,1]",
            zscore:"Deux variables standardisées"}[method];
    }
    selector.addEventListener("change",update);
    update();
}());
