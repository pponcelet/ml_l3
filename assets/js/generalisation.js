"use strict";
(function () {
    const host=document.getElementById("gen-lab");
    if(!host) return;
    const $=id=>document.getElementById(id);
    const NS="http://www.w3.org/2000/svg";
    function node(tag,attrs,parent,value){
        const n=document.createElementNS(NS,tag);
        Object.entries(attrs||{}).forEach(([k,v])=>n.setAttribute(k,v));
        if(parent)parent.appendChild(n);
        if(value!==undefined)n.textContent=value;
        return n;
    }
    function rng(seed){let s=seed>>>0;return()=>((s=(Math.imul(1664525,s)+1013904223)>>>0)/4294967296);}
    const random=rng(13044);
    function generate(n){return Array.from({length:n},()=>{
        const x=-1+2*random();
        const probability=.18+.64/(1+Math.exp(-6*x));
        return {x,label:random()<probability?1:0};
    });}
    const train=generate(36), validation=generate(100);
    function impurity(items){
        if(!items.length)return 0;
        const p=items.reduce((s,d)=>s+d.label,0)/items.length;
        return 2*p*(1-p);
    }
    function fitTree(data,limit){
        function build(items,depth){
            const pos=items.reduce((s,p)=>s+p.label,0);
            const out={pred:pos>items.length/2?1:0};
            if(depth===limit||!pos||pos===items.length||items.length<2)return out;
            const sorted=items.slice().sort((a,b)=>a.x-b.x);
            const parentGini=impurity(items);let best=null;
            for(let i=1;i<sorted.length;i++){
                if(sorted[i-1].x===sorted[i].x)continue;
                const left=sorted.slice(0,i),right=sorted.slice(i);
                const g=(left.length*impurity(left)+right.length*impurity(right))/items.length;
                if(best===null||g<best.g){best={g,x:(sorted[i-1].x+sorted[i].x)/2};}
            }
            if(!best||best.g>=parentGini-1e-10)return out;
            out.x=best.x;
            out.left=build(items.filter(p=>p.x<=best.x),depth+1);
            out.right=build(items.filter(p=>p.x>best.x),depth+1);
            return out;
        }
        const tree=build(data,0);
        return x=>{let t=tree;while(t.left)t=x<=t.x?t.left:t.right;return t.pred;};
    }
    const fits=Array.from({length:10},(_,i)=>fitTree(train,i+1));
    const error=(data,f)=>data.filter(p=>p.label!==f(p.x)).length/data.length;
    const trainErrors=fits.map(f=>error(train,f)),valErrors=fits.map(f=>error(validation,f));
    const W=590,H=310,m={l:44,r:18,t:23,b:40};
    function plotFit(f){
        const sx=x=>m.l+(x+1)/2*(W-m.l-m.r);
        const sy=v=>H-m.b-(v+0.15)/1.3*(H-m.t-m.b);
        const s=node("svg",{viewBox:`0 0 ${W} ${H}`,role:"img","aria-label":"Arbre de classification selon sa profondeur"});
        [-1,-.5,0,.5,1].forEach(x=>{
            node("line",{x1:sx(x),x2:sx(x),y1:sy(-.15),y2:sy(1.15),stroke:"#edf1f5"},s);
            node("text",{x:sx(x),y:H-12,"text-anchor":"middle",fill:"#718294","font-size":11},s,x.toFixed(1));
        });
        const steps=Array.from({length:250},(_,i)=>{
            const x=-1+2*i/249;return {x,y:f(x)};
        });
        node("polyline",{points:steps.map(q=>`${sx(q.x)},${sy(q.y)}`).join(" "),
            stroke:"#294f72","stroke-width":3,fill:"none"},s);
        train.forEach(p=>node("circle",{cx:sx(p.x),cy:sy(p.label),
            r:4.6,fill:p.label?"#d28d59":"#447aa6",stroke:"white","stroke-width":1},s));
        node("text",{x:W/2,y:H-1,"text-anchor":"middle",fill:"#718294","font-size":11},s,"Variable x");
        $("gen-fit").replaceChildren(s);
    }
    function plotErrors(chosen){
        const x=d=>m.l+(d-1)/9*(W-m.l-m.r);
        const upper=Math.max(.4,Math.max(...valErrors,...trainErrors)*1.15);
        const y=e=>H-m.b-e/upper*(H-m.t-m.b);
        const s=node("svg",{viewBox:`0 0 ${W} ${H}`,role:"img","aria-label":"Erreurs d'entraînement et de validation selon la profondeur"});
        for(let tick=0;tick<=4;tick++){
            const v=upper*tick/4;
            node("line",{x1:m.l,x2:W-m.r,y1:y(v),y2:y(v),stroke:"#e8eef3"},s);
            node("text",{x:m.l-6,y:y(v)+3,"text-anchor":"end",fill:"#718294","font-size":11},s,`${(100*v).toFixed(0)} %`);
        }
        [1,3,5,7,10].forEach(v=>node("text",{x:x(v),y:H-13,"text-anchor":"middle",fill:"#718294","font-size":11},s,v));
        const series=[{values:trainErrors,color:"#447aa6"},{values:valErrors,color:"#d28d59"}];
        series.forEach(serie=>node("polyline",{
            points:serie.values.map((v,i)=>`${x(i+1)},${y(v)}`).join(" "),
            stroke:serie.color,"stroke-width":3,fill:"none"},s));
        node("line",{x1:x(chosen),x2:x(chosen),y1:m.t,y2:H-m.b,
            stroke:"#687989","stroke-dasharray":"4 4"},s);
        series.forEach(serie=>node("circle",{cx:x(chosen),cy:y(serie.values[chosen-1]),
            r:6,fill:serie.color,stroke:"white","stroke-width":2},s));
        node("text",{x:W/2,y:H-1,"text-anchor":"middle",fill:"#718294","font-size":11},s,"Profondeur maximale");
        $("gen-errors").replaceChildren(s);
    }
    function render(){
        const d=Number($("gen-depth").value);
        $("gen-depth-value").textContent=d;
        $("gen-train-error").textContent=(100*trainErrors[d-1]).toFixed(1).replace(".",",")+" %";
        $("gen-val-error").textContent=(100*valErrors[d-1]).toFixed(1).replace(".",",")+" %";
        const best=valErrors.indexOf(Math.min(...valErrors))+1;
        $("gen-best").textContent=`La plus faible erreur de validation est observée ici pour une profondeur de ${best}.`;
        plotFit(fits[d-1]);plotErrors(d);
    }
    $("gen-depth").addEventListener("input",render);
    render();
}());
