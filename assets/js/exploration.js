"use strict";
(function () {
    const lab = document.getElementById("eda-lab");
    const datasets = window.ExplorationData;
    if (!lab || !datasets) return;

    const NS = "http://www.w3.org/2000/svg";
    const colors = ["#447aa6", "#d28d59", "#4e9582"];
    const $ = (id) => document.getElementById(id);
    const state = {
        dataset: "iris", feature: 2, filter: -1, x: 0, y: 2,
        method: "pca", selected: null, yaw: -0.64, pitch: 0.43
    };
    const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
    const fmt = (v, digits = 2) => Number.isFinite(v) ? v.toLocaleString("fr-FR", {
        minimumFractionDigits: 0, maximumFractionDigits: digits
    }) : "—";
    const lerp = (a, b, t) => a + (b - a) * t;

    function node(tag, attrs = {}, text) {
        const el = document.createElementNS(NS, tag);
        Object.keys(attrs).forEach((key) => el.setAttribute(key, String(attrs[key])));
        if (text !== undefined) el.textContent = text;
        return el;
    }
    function add(parent, tag, attrs = {}, text) {
        const el = node(tag, attrs, text);
        parent.appendChild(el);
        return el;
    }
    function svgFor(id, w, h, label) {
        const host = $(id);
        let svg = host.querySelector("svg");
        if (!svg) {
            svg = node("svg");
            host.appendChild(svg);
        }
        svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
        svg.setAttribute("role", "img");
        svg.setAttribute("aria-label", label);
        svg.replaceChildren();
        return svg;
    }
    function linear(d0, d1, r0, r1) {
        if (d0 === d1) return () => (r0 + r1) / 2;
        return (v) => r0 + (v - d0) / (d1 - d0) * (r1 - r0);
    }
    function ext(values) {
        let mn = Math.min(...values), mx = Math.max(...values);
        const pad = Math.max((mx - mn) * 0.08, (Math.abs(mx) + 1) * 0.015);
        return [mn - pad, mx + pad];
    }
    function quantile(sorted, q) {
        const pos = (sorted.length - 1) * q;
        const lo = Math.floor(pos), hi = Math.ceil(pos);
        return lerp(sorted[lo], sorted[hi], pos - lo);
    }
    function stats(values) {
        const a = values.slice().sort((x, y) => x - y);
        const n = a.length;
        const mean = a.reduce((s, v) => s + v, 0) / n;
        const variance = a.reduce((s, v) => s + (v - mean) ** 2, 0) / (n - 1);
        return { n, mean, median: quantile(a, .5), q1: quantile(a, .25),
            q3: quantile(a, .75), sd: Math.sqrt(variance), min: a[0], max: a[n - 1] };
    }
    function data() { return datasets[state.dataset]; }
    function pairs(d, filter = -1) {
        return d.x.map((values, i) => ({values, i, label: d.y[i]}))
            .filter((o) => filter < 0 || o.label === filter);
    }
    function shortLabel(text, count = 17) {
        return text.length > count ? text.slice(0, count - 1) + "…" : text;
    }
    function selectOptions(select, items, selected, formatter = (item) => item) {
        select.replaceChildren();
        items.forEach((item, i) => {
            const option = document.createElement("option");
            option.value = String(i);
            option.textContent = formatter(item);
            select.appendChild(option);
        });
        select.value = String(selected);
    }
    function resetDataset() {
        const d = data();
        state.feature = state.dataset === "iris" ? 2 : 0;
        state.x = 0;
        state.y = state.dataset === "iris" ? 2 : 9;
        state.filter = -1;
        state.selected = null;
        selectOptions($("eda-feature"), d.names, state.feature);
        selectOptions($("eda-x"), d.names, state.x);
        selectOptions($("eda-y"), d.names, state.y);
        const filter = $("eda-filter");
        filter.replaceChildren();
        const all = document.createElement("option");
        all.value = "-1";
        all.textContent = "Toutes les classes";
        filter.appendChild(all);
        d.classes.forEach((name, i) => {
            const option = document.createElement("option");
            option.value = String(i);
            option.textContent = name;
            filter.appendChild(option);
        });
        filter.value = "-1";
        $("eda-legend").replaceChildren();
        d.classes.forEach((name, i) => {
            const span = document.createElement("span");
            span.className = "eda-legend-item";
            const swatch = document.createElement("i");
            swatch.style.backgroundColor = colors[i];
            span.appendChild(swatch);
            span.appendChild(document.createTextNode(name));
            $("eda-legend").appendChild(span);
        });
        refresh();
    }
    function axes(svg, sx, sy, bounds, xName, yName) {
        const [x0, y0, x1, y1] = bounds;
        const ticks = 4;
        for (let i = 0; i <= ticks; i++) {
            const x = lerp(x0, x1, i / ticks);
            const y = lerp(y1, y0, i / ticks);
            add(svg, "line", {x1:x, y1:y0, x2:x, y2:y1, stroke:"#edf1f5"});
            add(svg, "line", {x1:x0, y1:y, x2:x1, y2:y, stroke:"#edf1f5"});
        }
        add(svg, "line", {x1:x0,y1:y1,x2:x1,y2:y1,stroke:"#c1cfdb", "stroke-width":1.1});
        add(svg, "line", {x1:x0,y1:y0,x2:x0,y2:y1,stroke:"#c1cfdb", "stroke-width":1.1});
        add(svg, "text", {x:(x0+x1)/2,y:y1+28,"text-anchor":"middle",fill:"#74869b", "font-size":12}, xName);
        add(svg, "text", {x:12,y:(y0+y1)/2,transform:`rotate(-90 12 ${(y0+y1)/2})`,
            "text-anchor":"middle",fill:"#74869b","font-size":12}, yName);
    }
    function plotStats() {
        const d = data();
        const vals = pairs(d, state.filter).map((p) => p.values[state.feature]);
        const st = stats(vals);
        for (const [key, id] of [
            ["n","eda-n"],["mean","eda-mean"],["median","eda-median"],
            ["q1","eda-q1"],["q3","eda-q3"],["sd","eda-std"],
            ["min","eda-min"],["max","eda-max"]
        ]) $(id).textContent = fmt(st[key]);
        return st;
    }
    function histogram(st) {
        const d = data();
        const all = d.x.map((v) => v[state.feature]);
        const selected = pairs(d, state.filter).map((p) => p.values[state.feature]);
        const [domainMin, domainMax] = ext(all);
        const W = 560, H = 320, x0 = 44, y0 = 24, x1 = 544, y1 = 272;
        const svg = svgFor("eda-hist", W, H, "Histogramme des valeurs de la variable sélectionnée");
        const bins = 12, width = (domainMax - domainMin) / bins;
        const counts = Array(bins).fill(0);
        selected.forEach((v) => { counts[clamp(Math.floor((v - domainMin) / width), 0, bins - 1)]++; });
        const maxC = Math.max(1, ...counts);
        const sx = linear(domainMin, domainMax, x0, x1);
        const sy = linear(0, maxC * 1.12, y1, y0);
        axes(svg, sx, sy, [x0,y0,x1,y1], d.names[state.feature], "Effectif");
        counts.forEach((count, i) => {
            const xa = sx(domainMin + i * width), xb = sx(domainMin + (i+1)*width);
            add(svg,"rect",{x:xa+1,y:sy(count),width:Math.max(0,xb-xa-2),height:y1-sy(count),
                fill:"#91b4d0",stroke:"#477fa7","stroke-width":.7});
        });
        const marks = [{v:st.mean,color:"#c37c43",label:"Moy."},
            {v:st.median,color:"#3b967e",label:"Méd."}];
        marks.forEach((mark,i) => {
            const x = sx(mark.v);
            add(svg,"line",{x1:x,y1:y0,x2:x,y2:y1,stroke:mark.color,
                "stroke-width":2.5,"stroke-dasharray":i===0?"5 3":"2 3"});
            add(svg,"text",{x:clamp(x+(i===0?5:-5),x0+15,x1-15),y:y0+14+i*16,
                "text-anchor":i===0?"start":"end",fill:mark.color,"font-weight":700,"font-size":11},mark.label);
        });
        for (let i=0;i<=4;i++) {
            const x=lerp(x0,x1,i/4);
            add(svg,"text",{x,y:y1+14,"text-anchor":"middle",fill:"#7c8a9b","font-size":11},
                fmt(lerp(domainMin,domainMax,i/4),1));
        }
        for(let i=0;i<=4;i++) add(svg,"text",{x:x0-7,y:lerp(y1,y0,i/4)+4,
            "text-anchor":"end",fill:"#7c8a9b","font-size":11},
        fmt(maxC*1.12*i/4,0));
    }
    function boxplots() {
        const d = data();
        const all = d.x.map((v) => v[state.feature]);
        const [mi,ma] = ext(all);
        const W=560,H=320,x0=136,x1=544,y0=22,y1=274;
        const svg=svgFor("eda-box",W,H,"Boxplots de la variable selon la classe");
        const sx=linear(mi,ma,x0,x1);
        const rows = d.classes.map((name,j) => ({name,j,
            values: pairs(d,j).map((o) => ({v:o.values[state.feature], i:o.i}))}));
        for (let k=0;k<=4;k++) {
            const pos=lerp(x0,x1,k/4);
            add(svg,"line",{x1:pos,y1:y0,x2:pos,y2:y1,stroke:"#edf1f5"});
            add(svg,"text",{x:pos,y:y1+17,"text-anchor":"middle",fill:"#7c8a9b","font-size":11},fmt(lerp(mi,ma,k/4),1));
        }
        rows.forEach((group,j) => {
            const cy=60+j*82;
            const sorted=group.values.map((p)=>p.v).sort((a,b)=>a-b);
            const q1=quantile(sorted,.25),q3=quantile(sorted,.75),med=quantile(sorted,.5);
            const iqr=q3-q1,low=q1-1.5*iqr,high=q3+1.5*iqr;
            const inside=sorted.filter((v)=>v>=low&&v<=high);
            const whiskerL=inside[0],whiskerR=inside[inside.length-1];
            add(svg,"text",{x:6,y:cy+4,fill:"#586b7f","font-size":12},shortLabel(group.name,17));
            add(svg,"line",{x1:sx(whiskerL),y1:cy,x2:sx(whiskerR),y2:cy,
                stroke:colors[j],"stroke-width":2});
            add(svg,"rect",{x:sx(q1),y:cy-19,width:Math.max(1,sx(q3)-sx(q1)),height:38,
                fill:colors[j],"fill-opacity":.21,stroke:colors[j],"stroke-width":2});
            add(svg,"line",{x1:sx(med),y1:cy-19,x2:sx(med),y2:cy+19,
                stroke:colors[j],"stroke-width":3});
            for (const v of [whiskerL,whiskerR]) add(svg,"line",{x1:sx(v),y1:cy-9,x2:sx(v),y2:cy+9,
                stroke:colors[j],"stroke-width":2});
            group.values.filter((o)=>o.v<low||o.v>high).forEach((o) => {
                add(svg,"circle",{cx:sx(o.v),cy:cy+((o.i%5)-2)*3.2,r:3.4,
                    fill:"white",stroke:colors[j],"stroke-width":1.7});
            });
        });
        add(svg,"text",{x:(x0+x1)/2,y:H-7,"text-anchor":"middle",
            fill:"#74869b","font-size":12},d.names[state.feature]);
    }
    function categoricalBars() {
        const d = data();
        const n = d.y.length;
        const counts = d.classes.map((_, cls) =>
            d.y.reduce((sum, v) => sum + (v === cls ? 1 : 0), 0));
        const max = Math.max(...counts, 1);
        const W = 720, H = 248, x0 = 162, x1 = 591;
        const svg = svgFor("eda-category-chart", W, H,
            "Diagramme en barres : effectifs et fréquences des classes");
        const sy = (i) => 41 + i * 66;
        const length = x1 - x0;
        d.classes.forEach((name, i) => {
            const y = sy(i);
            const isHighlighted = state.filter < 0 || state.filter === i;
            const opacity = isHighlighted ? 1 : 0.32;
            add(svg, "text", {
                x:x0-12, y:y+18, "text-anchor":"end", fill:"#536a80",
                "font-size":13, opacity
            }, shortLabel(name, 21));
            add(svg, "rect", {
                x:x0, y, width:length, height:25,
                fill:"#eef2f6", rx:4
            });
            add(svg, "rect", {
                x:x0, y, width:length * counts[i]/max, height:25,
                fill:colors[i], rx:4, opacity
            });
            const pct = 100 * counts[i] / n;
            add(svg, "text", {
                x:x1+14, y:y+17, fill:"#41566c", "font-size":12.5,
                "font-weight":650, opacity
            }, `${counts[i]} (${fmt(pct, 1)} %)`);
        });
        add(svg, "text", {x:x0, y:H-12,fill:"#74869b", "font-size":11},
            `Total : ${n} observations`);
    }
    function pearson(x,y) {
        const n=x.length;
        const mx=x.reduce((a,b)=>a+b,0)/n, my=y.reduce((a,b)=>a+b,0)/n;
        let a=0,b=0,c=0;
        for(let i=0;i<n;i++) {
            const dx=x[i]-mx,dy=y[i]-my;
            a+=dx*dy;b+=dx*dx;c+=dy*dy;
        }
        return b*c>1e-18 ? a/Math.sqrt(b*c) : 0;
    }
    function correlation() {
        const d=data();
        const a=d.x.map(v=>v[state.x]), b=d.x.map(v=>v[state.y]);
        return pearson(a,b);
    }
    function scatter() {
        const d=data();
        const x=d.x.map(v=>v[state.x]),y=d.x.map(v=>v[state.y]);
        const [miX,maX]=ext(x),[miY,maY]=ext(y);
        const W=560,H=320,x0=51,y0=19,x1=544,y1=271;
        const svg=svgFor("eda-scatter",W,H,"Nuage de points des variables sélectionnées");
        const sx=linear(miX,maX,x0,x1),sy=linear(miY,maY,y1,y0);
        axes(svg,sx,sy,[x0,y0,x1,y1],d.names[state.x],d.names[state.y]);
        d.x.forEach((values,i)=>{
            const selected=state.selected===i;
            const c=add(svg,"circle",{cx:sx(values[state.x]),cy:sy(values[state.y]),
                r:selected?6.4:3.5,fill:colors[d.y[i]],"fill-opacity":.79,
                stroke:selected?"#182e45":"#fff","stroke-width":selected?2:0.7,
                "data-obs":i,style:"cursor:pointer"});
            add(c,"title",{},`Observation ${i+1} — ${d.classes[d.y[i]]}`);
        });
    }
    function blend(a,b,t) {
        return a.map((x,i)=>Math.round(lerp(x,b[i],t)));
    }
    function heatColor(r) {
        const neutral=[251,252,253],blue=[77,130,171],orange=[210,141,89];
        const rgb=blend(neutral,r<0?blue:orange,Math.pow(Math.abs(r),.83));
        return `rgb(${rgb.join(",")})`;
    }
    function matrix() {
        const d=data(),n=d.names.length;
        const W=600,H=n>5?490:330;
        const svg=svgFor("eda-corr",W,H,"Matrice de corrélation entre les variables numériques");
        const left=n>5?134:136,top=n>5?25:24;
        const cell=Math.min(n>5?36:54,(W-left-30)/n,(H-top-92)/n);
        const cols=d.names.map((name,j)=>d.x.map(v=>v[j]));
        for(let i=0;i<n;i++) {
            const yy=top+i*cell;
            add(svg,"text",{x:left-8,y:yy+cell/2+4,"text-anchor":"end",
                fill:"#536a80","font-size":n>5?10.6:12},
                n>5?`${i+1}. ${shortLabel(d.names[i],17)}`:d.names[i]);
            for(let j=0;j<n;j++) {
                const xx=left+j*cell;
                const r=pearson(cols[i],cols[j]);
                const selected=(i===state.y&&j===state.x)||(i===state.x&&j===state.y);
                const rect=add(svg,"rect",{x:xx,y:yy,width:cell-2,height:cell-2,
                    rx:2,fill:heatColor(r),stroke:selected?"#233349":"#ffffff",
                    "stroke-width":selected?2.4:1,"data-x":j,"data-y":i,
                    tabindex:0,role:"button","aria-label":`${d.names[i]} et ${d.names[j]}, corrélation ${fmt(r)}. Afficher le nuage de points`,
                    style:"cursor:pointer"});
                add(rect,"title",{},`${d.names[i]} / ${d.names[j]} : r = ${fmt(r)}`);
                if(n<=5)add(svg,"text",{x:xx+(cell-2)/2,y:yy+cell/2+4,
                    "text-anchor":"middle",fill:Math.abs(r)>.72?"#fff":"#43546b",
                    "font-size":11,"pointer-events":"none"},fmt(r));
            }
            const x=left+i*cell+(cell-2)/2;
            add(svg,"text",{x,y:top+n*cell+12,"text-anchor":"end",
                transform:`rotate(-58 ${x} ${top+n*cell+12})`,
                fill:"#536a80","font-size":n>5?11:12},
                n>5?String(i+1):d.names[i]);
        }
        const footer=H-16;
        add(svg,"text",{x:left,y:footer,fill:"#74869b","font-size":11},"−1");
        const steps=24,sx=left+28,cellWidth=144/steps;
        for(let k=0;k<steps;k++)add(svg,"rect",{x:sx+k*cellWidth,y:footer-12,
            width:cellWidth+0.25,height:10,fill:heatColor(-1+2*k/(steps-1))});
        add(svg,"text",{x:sx+144+7,y:footer,fill:"#74869b","font-size":11},"+1");
        svg.querySelectorAll("rect[data-x]").forEach((rect)=>{
            const act=()=>{
                state.x=+rect.getAttribute("data-x");state.y=+rect.getAttribute("data-y");
                $("eda-x").value=String(state.x);$("eda-y").value=String(state.y);
                plotRelations();
            };
            rect.addEventListener("click",act);
            rect.addEventListener("keydown",(ev)=>{
                if(ev.key==="Enter"||ev.key===" "){ev.preventDefault();act();}
            });
        });
    }
    function plotRelations() {
        $("eda-r").textContent=fmt(correlation());
        scatter();matrix();
    }
    function embedding() {
        return data().methods[state.method];
    }
    function embeddingViews() {
        const d=data(), embed=embedding();
        const method=state.method==="pca"?"ACP":"t-SNE";
        $("eda-2d-title").textContent=`${method} — 2D`;
        $("eda-3d-title").textContent=`${method} — 3D`;
        $("eda-2d-help").textContent=state.method==="pca"?
            `Variance conservée : ${fmt(100*(embed.variance[0]+embed.variance[1]),1)} % en 2D, ${fmt(100*embed.variance.reduce((a,b)=>a+b,0),1)} % en 3D.`:
            "Les dimensions t-SNE n’ont pas d’interprétation directe ; la disposition 3D est calculée indépendamment de la 2D.";
        $("eda-interpret").textContent=state.method==="pca"?
            "En ACP, les directions sont choisies pour conserver le maximum de variance. Comparez la séparation des classes en 2D et en 3D." :
            "t-SNE privilégie les voisinages locaux. La taille apparente des groupes et les distances entre groupes ne doivent pas être interprétées directement.";
        render2D();render3D();
        if(state.selected===null)$("eda-selection").textContent=
            "Cliquez sur un point pour retrouver cette observation dans les représentations 2D et 3D.";
        else $("eda-selection").textContent=
            `Observation ${state.selected+1} — ${d.classes[d.y[state.selected]]}. Le même point est mis en évidence en 2D et en 3D.`;
    }
    function selectPoint(index) {
        state.selected=state.selected===index?null:index;
        render2D();render3D();scatter();
        const d=data();
        $("eda-selection").textContent=state.selected===null?
            "Cliquez sur un point pour retrouver cette observation dans les représentations 2D et 3D." :
            `Observation ${state.selected+1} — ${d.classes[d.y[state.selected]]}. Le même point est mis en évidence en 2D et en 3D.`;
    }
    function render2D() {
        const d=data(), pts=embedding().two;
        const X=pts.map(p=>p[0]),Y=pts.map(p=>p[1]);
        const [minx,maxx]=ext(X),[miny,maxy]=ext(Y);
        const W=560,H=340,x0=45,y0=21,x1=542,y1=286;
        const svg=svgFor("eda-2d",W,H,"Représentation des observations en deux dimensions");
        const sx=linear(minx,maxx,x0,x1),sy=linear(miny,maxy,y1,y0);
        const names=state.method==="pca"?["CP1","CP2"]:["Dimension 1","Dimension 2"];
        axes(svg,sx,sy,[x0,y0,x1,y1],names[0],names[1]);
        pts.forEach((p,i)=>{
            const selected=state.selected===i;
            const circle=add(svg,"circle",{cx:sx(p[0]),cy:sy(p[1]),r:selected?7.1:4.2,
                fill:colors[d.y[i]],"fill-opacity":.88,
                stroke:selected?"#1e334a":"#fff","stroke-width":selected?2.3:.9,
                "data-obs":i,style:"cursor:pointer"});
            add(circle,"title",{},`Observation ${i+1} — ${d.classes[d.y[i]]}`);
            circle.addEventListener("click",()=>selectPoint(i));
        });
    }
    function rotate(p) {
        const [x,y,z]=p;
        const cy=Math.cos(state.yaw),sy=Math.sin(state.yaw);
        const cp=Math.cos(state.pitch),sp=Math.sin(state.pitch);
        const h=cy*x-sy*y;
        const depth=sy*x+cy*y;
        return {x:h,y:sp*depth-cp*z,depth:cp*depth+sp*z};
    }
    function render3D() {
        const d=data(),pts=embedding().three;
        const W=560,H=340;
        const svg=svgFor("eda-3d",W,H,"Représentation 3D orientable des observations");
        const mins=[0,1,2].map(k=>Math.min(...pts.map(v=>v[k])));
        const maxs=[0,1,2].map(k=>Math.max(...pts.map(v=>v[k])));
        const means=mins.map((v,k)=>(v+maxs[k])/2);
        const centered=pts.map(p=>p.map((v,k)=>v-means[k]));
        const radius=Math.max(...centered.map(p=>Math.hypot(...p)))||1;
        const scale=160/radius;
        const ox=W/2,oy=H/2+3;
        const coord=(v)=>({x:ox+v.x*scale,y:oy-v.y*scale});
        const axes=state.method==="pca"?["CP1","CP2","CP3"]:["Dim. 1","Dim. 2","Dim. 3"];
        const axisColors=["#9fb4c5","#d7b090","#8eb6aa"];
        const o=coord(rotate([0,0,0]));
        for(let k=0;k<3;k++){
            const vec=[0,0,0];vec[k]=radius*.85;
            const target=coord(rotate(vec));
            add(svg,"line",{x1:o.x,y1:o.y,x2:target.x,y2:target.y,
                stroke:axisColors[k],"stroke-width":2.2});
            add(svg,"text",{x:clamp(target.x+5,18,W-25),y:clamp(target.y-4,16,H-18),
                fill:"#536b81","font-size":11,"font-weight":650},axes[k]);
        }
        const projected=centered.map((p,i)=>({i,...rotate(p)})).sort((a,b)=>a.depth-b.depth);
        projected.forEach((p)=>{
            const selected=state.selected===p.i;
            const pos=coord(p);
            const circle=add(svg,"circle",{cx:pos.x,cy:pos.y,r:selected?7.3:4.15,
                fill:colors[d.y[p.i]],"fill-opacity":selected?1:.87,
                stroke:selected?"#192e43":"#fff","stroke-width":selected?2.5:.85,
                "data-obs":p.i,style:"cursor:grab"});
            add(circle,"title",{},`Observation ${p.i+1} — ${d.classes[d.y[p.i]]}`);
        });
        add(svg,"text",{x:W/2,y:H-9,"text-anchor":"middle",fill:"#8a98a9",
            "font-size":11,"pointer-events":"none"},"Glissez pour faire tourner le nuage");
    }

    let dragging=null,suppressClick=false;
    const space=$("eda-3d");
    space.addEventListener("pointerdown",(ev)=>{
        const svg=space.querySelector("svg");
        if(!svg)return;
        dragging={x:ev.clientX,y:ev.clientY,yaw:state.yaw,pitch:state.pitch,
            target:ev.target.closest("[data-obs]")};
        svg.setPointerCapture(ev.pointerId);
        suppressClick=false;
    });
    space.addEventListener("pointermove",(ev)=>{
        if(!dragging)return;
        const dx=ev.clientX-dragging.x,dy=ev.clientY-dragging.y;
        if(Math.hypot(dx,dy)>4)suppressClick=true;
        if(suppressClick){
            state.yaw=dragging.yaw+dx*.011;
            state.pitch=clamp(dragging.pitch+dy*.009,-1.45,1.45);
            render3D();
        }
    });
    function finishDrag(ev) {
        if(!dragging)return;
        const original=dragging.target;
        if(!suppressClick&&original)selectPoint(+original.getAttribute("data-obs"));
        dragging=null;
    }
    space.addEventListener("pointerup",finishDrag);
    space.addEventListener("pointercancel",()=>{dragging=null;});

    function refresh() {
        const st=plotStats();
        histogram(st);boxplots();categoricalBars();plotRelations();embeddingViews();
    }
    $("eda-dataset").addEventListener("change",(ev)=>{
        state.dataset=ev.target.value;
        resetDataset();
    });
    $("eda-feature").addEventListener("change",(ev)=>{
        state.feature=+ev.target.value;
        const st=plotStats();histogram(st);boxplots();
    });
    $("eda-filter").addEventListener("change",(ev)=>{
        state.filter=+ev.target.value;
        const st=plotStats();histogram(st);categoricalBars();
    });
    for(const [id,key] of [["eda-x","x"],["eda-y","y"]]){
        $(id).addEventListener("change",(ev)=>{
            state[key]=+ev.target.value;
            plotRelations();
        });
    }
    $("eda-method").addEventListener("change",(ev)=>{
        state.method=ev.target.value;
        state.selected=null;
        embeddingViews();scatter();
    });
    resetDataset();
}());
