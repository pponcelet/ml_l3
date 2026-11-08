"use strict";
(function(){
    const select=document.getElementById("multi-case");
    if(!select)return;
    const $=id=>document.getElementById(id);
    const cases={
        balanced:[[8,1,1],[2,7,1],[0,2,8]],
        rare:[[18,1,1],[2,5,1],[1,1,0]]
    };
    function pct(x){return (x*100).toFixed(1).replace(".",",")+" %";}
    function render(){
        const matrix=cases[select.value], totals=matrix.map(row=>row.reduce((s,n)=>s+n,0));
        const columns=[0,1,2].map(j=>matrix.reduce((s,row)=>s+row[j],0));
        const n=totals.reduce((s,v)=>s+v,0);
        const grid=$("multi-matrix");grid.replaceChildren();
        matrix.forEach((row,i)=>{
            const tr=document.createElement("tr");
            const head=document.createElement("th");head.textContent="ABC"[i];tr.appendChild(head);
            row.forEach((value,j)=>{
                const cell=document.createElement("td");
                cell.textContent=value;
                cell.className=i===j?"multi-correct":"multi-error";
                tr.appendChild(cell);
            });
            grid.appendChild(tr);
        });
        const metrics=matrix.map((row,i)=>{
            const tp=row[i];
            const precision=columns[i]?tp/columns[i]:0;
            const recall=totals[i]?tp/totals[i]:0;
            const f1=precision+recall?2*precision*recall/(precision+recall):0;
            return {precision,recall,f1};
        });
        $("multi-details").replaceChildren();
        metrics.forEach((m,i)=>{
            const tr=document.createElement("tr");
            for(const value of ["ABC"[i],pct(m.precision),pct(m.recall),pct(m.f1)]){
                const td=document.createElement("td");td.textContent=value;tr.appendChild(td);
            }
            $("multi-details").appendChild(tr);
        });
        const sum=matrix.reduce((s,row,i)=>s+row[i],0);
        const macro=metrics.reduce((s,m)=>s+m.f1,0)/3;
        const weighted=metrics.reduce((s,m,i)=>s+m.f1*totals[i],0)/n;
        const micro=sum/n; // classification multiclasse à étiquette unique
        $("multi-acc").textContent=pct(micro);
        $("multi-macro").textContent=pct(macro);
        $("multi-micro").textContent=pct(micro);
        $("multi-weighted").textContent=pct(weighted);
        $("multi-reading").textContent=select.value==="rare"?
            "La classe C est peu représentée et aucun de ses deux exemples n'est correctement identifié. L'exactitude peut sembler satisfaisante alors que la moyenne macro signale une faiblesse sur cette classe.":
            "Les trois classes ont le même effectif. La moyenne macro accorde autant d'importance à chacune ; la moyenne pondérée tient compte du nombre d'observations par classe.";
    }
    select.addEventListener("change",render);render();
}());
