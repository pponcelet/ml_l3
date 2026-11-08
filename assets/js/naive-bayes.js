"use strict";
(function () {
    const host = document.getElementById("nb-lab");
    if (!host) return;
    const $ = (id) => document.getElementById(id);
    const SVG = "http://www.w3.org/2000/svg";
    const colors = ["#447aa6", "#d28d59"];

    function node(tag, attrs, parent, value) {
        const e = document.createElementNS(SVG, tag);
        Object.entries(attrs || {}).forEach(([key, val]) => e.setAttribute(key, val));
        if (value !== undefined) e.textContent = value;
        parent.appendChild(e);
        return e;
    }
    function rng(seed) {
        let s = seed >>> 0;
        return () => ((s = (Math.imul(1664525, s) + 1013904223) >>> 0) / 4294967296);
    }
    function gaussian(random) {
        return Math.sqrt(-2 * Math.log(Math.max(1e-9, random()))) *
            Math.cos(2 * Math.PI * random());
    }
    function clamp(v) { return Math.max(2, Math.min(98, v)); }
    function dataset(name, seed) {
        const random = rng(seed), points = [];
        function add(x, y, c) { points.push({x:clamp(x), y:clamp(y), c}); }
        if (name === "blobs") {
            for (let i = 0; i < 62; i++) {
                add(33 + 12 * gaussian(random), 36 + 13 * gaussian(random), 0);
                add(67 + 12 * gaussian(random), 65 + 13 * gaussian(random), 1);
            }
        } else if (name === "inclined") {
            for (let i = 0; i < 62; i++) {
                const z0 = gaussian(random), z1 = gaussian(random);
                add(27 + 14 * z0, 42 + 12 * z0 + 3.5 * z1, 0);
                const z2 = gaussian(random), z3 = gaussian(random);
                add(72 + 14 * z2, 59 + 12 * z2 + 3.5 * z3, 1);
            }
        } else {
            for (let i = 0; i < 35; i++) {
                add(25 + 5.1 * gaussian(random), 25 + 5.1 * gaussian(random), 0);
                add(75 + 5.1 * gaussian(random), 75 + 5.1 * gaussian(random), 0);
                add(25 + 5.1 * gaussian(random), 75 + 5.1 * gaussian(random), 1);
                add(75 + 5.1 * gaussian(random), 25 + 5.1 * gaussian(random), 1);
            }
        }
        return points;
    }
    function trainGaussianNB(points, priorBlue, smoothFactor) {
        const groups = [[], []];
        points.forEach(p => groups[p.c].push(p));
        const stats = groups.map(g => {
            const n = g.length;
            const mx = g.reduce((a, p) => a+p.x, 0)/n;
            const my = g.reduce((a, p) => a+p.y, 0)/n;
            const vx = g.reduce((a, p) => a+(p.x-mx)**2, 0)/n;
            const vy = g.reduce((a, p) => a+(p.y-my)**2, 0)/n;
            return {mean:[mx,my], variance:[vx,vy]};
        });
        const maxVar = Math.max(...stats.flatMap(s => s.variance));
        const regularizer = smoothFactor * maxVar;
        stats.forEach(s => { s.variance = s.variance.map(v => v + regularizer + 1e-9); });
        function logDensity(x, mu, variance) {
            return -.5 * Math.log(2*Math.PI*variance) - .5 * ((x-mu)**2/variance);
        }
        function logScores(x, y) {
            return stats.map((s, i) => {
                const prior = i === 0 ? priorBlue : 1-priorBlue;
                return Math.log(prior) +
                    logDensity(x, s.mean[0], s.variance[0]) +
                    logDensity(y, s.mean[1], s.variance[1]);
            });
        }
        function posterior(x,y) {
            const logs = logScores(x,y);
            const maxLog = Math.max(...logs);
            const likelihoods = logs.map(v=>Math.exp(v-maxLog));
            const sum = likelihoods[0]+likelihoods[1];
            return likelihoods.map(v=>v/sum);
        }
        return {stats, posterior, predict:(x,y)=>posterior(x,y)[0]>=.5?0:1};
    }
    const W = 580, H = 420, m = {left:43,right:17,top:15,bottom:39};
    const sx = x => m.left + x/100 * (W-m.left-m.right);
    const sy = y => H-m.bottom - y/100 * (H-m.top-m.bottom);
    const invX = x => (x-m.left)/(W-m.left-m.right)*100;
    const invY = y => (H-m.bottom-y)/(H-m.top-m.bottom)*100;

    function makeSVG(container, width, height, ariaLabel) {
        container.replaceChildren();
        return node("svg", {viewBox:`0 0 ${width} ${height}`,role:"img",
            "aria-label":ariaLabel}, container);
    }

    function drawPlot(points, model, queryPoint) {
        const svg = makeSVG($("nb-plot"), W, H, "Zones de décision Naive Bayes et observations");
        const N = 68;
        const bg = node("g", {}, svg);
        for (let iy=0; iy<N; iy++) {
            for (let ix=0; ix<N; ix++) {
                const x=100*(ix+.5)/N, y=100*(iy+.5)/N;
                const c=model.predict(x,y);
                node("rect",{x:sx(ix*100/N), y:sy((iy+1)*100/N),
                    width:(W-m.left-m.right)/N+.25,
                    height:(H-m.top-m.bottom)/N+.25,
                    fill:colors[c],opacity:.13},bg);
            }
        }
        for(let t=0;t<=100;t+=20){
            node("line",{x1:sx(t),y1:sy(0),x2:sx(t),y2:sy(100),
                stroke:"#e2e8ef","stroke-width":.8},svg);
            node("line",{x1:sx(0),y1:sy(t),x2:sx(100),y2:sy(t),
                stroke:"#e2e8ef","stroke-width":.8},svg);
            node("text",{x:sx(t),y:sy(0)+18,"text-anchor":"middle",
                "font-size":11,fill:"#728699"},svg,t);
            node("text",{x:sx(0)-9,y:sy(t)+4,"text-anchor":"end",
                "font-size":11,fill:"#728699"},svg,t);
        }
        node("text",{x:W/2,y:H-4,"text-anchor":"middle",fill:"#687f92",
            "font-size":12},svg,"Variable 1");
        node("text",{transform:"rotate(-90)",x:-H/2,y:14,
            "text-anchor":"middle",fill:"#687f92","font-size":12},svg,"Variable 2");
        points.forEach(p=>node("circle",{cx:sx(p.x),cy:sy(p.y),r:4.5,
            fill:colors[p.c],stroke:"white","stroke-width":1,opacity:.95},svg));
        node("circle",{cx:sx(queryPoint.x),cy:sy(queryPoint.y),r:10,
            fill:"white",stroke:"#243b53","stroke-width":2.5},svg);
        node("circle",{cx:sx(queryPoint.x),cy:sy(queryPoint.y),r:3.3,
            fill:"#243b53"},svg);
        // Le point de prédiction se déplace uniquement à l'intérieur du cadre.
        const overlay=node("rect",{x:sx(0),y:sy(100),
            width:sx(100)-sx(0),height:sy(0)-sy(100),
            fill:"transparent",style:"cursor:crosshair"},svg);
        overlay.addEventListener("click",event=>{
            const pt=svg.createSVGPoint();
            pt.x=event.clientX;pt.y=event.clientY;
            const inverse=svg.getScreenCTM();
            if(!inverse)return;
            const local=pt.matrixTransform(inverse.inverse());
            state.query={x:Math.max(0,Math.min(100,invX(local.x))),
                y:Math.max(0,Math.min(100,invY(local.y)))};
            render();
        });
        // Le contour du point doit rester visible sous la zone de clic.
        node("circle",{cx:sx(queryPoint.x),cy:sy(queryPoint.y),r:9.2,
            fill:"none",stroke:"#243b53","stroke-width":2.2,
            "pointer-events":"none"},svg);
        node("circle",{cx:sx(queryPoint.x),cy:sy(queryPoint.y),r:3.3,
            fill:"#243b53","pointer-events":"none"},svg);
    }

    function drawDensity(container, title, model, axis, selectedValue) {
        const width=480, height=155;
        const mx=35, mr=14, top=25, base=height-30;
        const scaleX=x=>mx+x/100*(width-mx-mr);
        function density(x,mean,variance){
            return Math.exp(-.5*(x-mean)**2/variance)/Math.sqrt(2*Math.PI*variance);
        }
        const peaks=model.stats.map(s=>density(s.mean[axis],s.mean[axis],s.variance[axis]));
        const maxPeak=Math.max(...peaks)*1.1;
        const scaleY=d=>base-d/maxPeak*(base-top);
        const svg=makeSVG(container,width,height,`Densités gaussiennes de ${title}`);
        node("text",{x:mx,y:17,"font-size":12.5,"font-weight":700,fill:"#3a526a"},svg,title);
        node("line",{x1:mx,y1:base,x2:width-mr,y2:base,stroke:"#d0dbe5"},svg);
        for(let t=0;t<=100;t+=25){
            node("line",{x1:scaleX(t),y1:base,x2:scaleX(t),y2:base+4,stroke:"#a3b4c4"},svg);
            node("text",{x:scaleX(t),y:base+16,"text-anchor":"middle",
                "font-size":10.5,fill:"#8495a5"},svg,t);
        }
        model.stats.forEach((s,i)=>{
            const coords=[];
            for(let j=0;j<=150;j++) {
                const x=j*100/150;
                coords.push(`${j===0?"M":"L"}${scaleX(x).toFixed(2)},${scaleY(density(x,s.mean[axis],s.variance[axis])).toFixed(2)}`);
            }
            node("path",{d:coords.join(" "),fill:"none",stroke:colors[i],
                "stroke-width":2.5,"stroke-linecap":"round","stroke-linejoin":"round"},svg);
        });
        node("line",{x1:scaleX(selectedValue),y1:top,x2:scaleX(selectedValue),y2:base,
            stroke:"#364d61","stroke-width":1.8,"stroke-dasharray":"4 4"},svg);
    }

    function updatePosteriors(model, query) {
        const posterior=model.posterior(query.x,query.y);
        $("nb-chosen").textContent=`Observation : (${query.x.toFixed(1).replace(".",",")} ; ${query.y.toFixed(1).replace(".",",")})`;
        ["blue","orange"].forEach((name,i)=>{
            const value=100*posterior[i];
            $("nb-bar-"+name).style.width=value.toFixed(2)+"%";
            $("nb-prob-"+name).textContent=value.toFixed(1).replace(".",",")+" %";
        });
        $("nb-prediction").textContent="Classe prédite : "+
            (posterior[0]>=posterior[1]?"bleue":"orange")+".";
    }

    const insights={
        blobs:"Observez l'effet des probabilités a priori : la frontière se déplace même si les observations ne changent pas.",
        inclined:"Les variables évoluent ensemble à l’intérieur des groupes. Or Naive Bayes les modélise séparément : comparez les courbes et les zones de décision.",
        xor:"Les classes forment un damier : la distribution de chaque variable est presque identique d’une classe à l’autre. C’est leur combinaison qui permet de distinguer les classes, ce que Naive Bayes ne modélise pas directement."
    };
    const state={dataset:"blobs",seed:43,prior:.5,smoothing:.05,query:{x:50,y:50}};
    function render() {
        const points=dataset(state.dataset,state.seed);
        const model=trainGaussianNB(points,state.prior,state.smoothing);
        drawPlot(points,model,state.query);
        drawDensity($("nb-density-x"),"Variable 1",model,0,state.query.x);
        drawDensity($("nb-density-y"),"Variable 2",model,1,state.query.y);
        updatePosteriors(model,state.query);
        $("nb-count").textContent=points.length;
        const accuracy=100*points.filter(p=>model.predict(p.x,p.y)===p.c).length/points.length;
        $("nb-accuracy").textContent=accuracy.toFixed(1).replace(".",",")+" %";
        $("nb-insight").textContent=insights[state.dataset];
    }
    $("nb-dataset").addEventListener("change",function(){
        state.dataset=this.value;
        state.query={x:50,y:50};
        render();
    });
    $("nb-seed").addEventListener("click",()=>{state.seed+=29;render();});
    $("nb-prior").addEventListener("input",function(){
        state.prior=Number(this.value)/100;
        $("nb-prior-value").textContent=this.value+" %";
        render();
    });
    $("nb-smoothing").addEventListener("input",function(){
        state.smoothing=Number(this.value);
        $("nb-smoothing-value").textContent=state.smoothing.toFixed(2).replace(".",",");
        render();
    });
    render();
}());
