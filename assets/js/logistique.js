"use strict";
(function () {
    const root = document.getElementById("log-lab");
    if (!root) return;
    const $ = id => document.getElementById(id);
    const NS = "http://www.w3.org/2000/svg";
    const palette = ["#447aa6", "#d28d59"];
    const svg = (tag, attr, parent, str) => {
        const node = document.createElementNS(NS, tag);
        Object.entries(attr || {}).forEach(([k, v]) => node.setAttribute(k, v));
        if (str !== undefined) node.textContent = str;
        if (parent) parent.appendChild(node);
        return node;
    };
    function rng(seed) {
        let state = seed >>> 0;
        return () => ((state = (Math.imul(1664525, state) + 1013904223) >>> 0) / 4294967296);
    }
    function normal(r) {
        return Math.sqrt(-2 * Math.log(Math.max(1e-9, r()))) * Math.cos(2 * Math.PI * r());
    }
    function generate(shape, seed) {
        const r = rng(seed), points = [];
        function push(x, y, label) {
            points.push({ id: points.length, x: Math.max(2, Math.min(98, x)),
                y: Math.max(2, Math.min(98, y)), label });
        }
        if (shape === "blobs") {
            for (let i = 0; i < 46; i++) {
                push(32 + normal(r)*12, 40 + normal(r)*13, 0);
                push(66 + normal(r)*12, 60 + normal(r)*13, 1);
            }
        } else if (shape === "moons") {
            for (let i = 0; i < 48; i++) {
                const t = Math.PI * (i+.5)/48;
                push(42 + 28*Math.cos(t)+normal(r)*2,
                    44 + 22*Math.sin(t)+normal(r)*2, 0);
                push(60 - 28*Math.cos(t)+normal(r)*2,
                    56 - 22*Math.sin(t)+normal(r)*2, 1);
            }
        } else {
            for (let i = 0; i < 25; i++) {
                push(27 + normal(r)*9, 26 + normal(r)*9, 0);
                push(73 + normal(r)*9, 74 + normal(r)*9, 0);
                push(27 + normal(r)*9, 74 + normal(r)*9, 1);
                push(73 + normal(r)*9, 26 + normal(r)*9, 1);
            }
        }
        return points;
    }
    function split(points, seed) {
        const random = rng(seed + 29), training = [], validation = [];
        for (let c = 0; c <= 1; c++) {
            const arr = points.filter(p => p.label === c);
            for (let i = arr.length - 1; i > 0; i--) {
                const j = Math.floor(random()*(i+1));
                [arr[i], arr[j]] = [arr[j], arr[i]];
            }
            const cut = Math.round(arr.length * .75);
            training.push(...arr.slice(0,cut));
            validation.push(...arr.slice(cut));
        }
        return {training, validation};
    }
    function sigmoid(z) {
        if (z >= 0) return 1/(1+Math.exp(-z));
        const ez = Math.exp(z);
        return ez/(1+ez);
    }
    function fitLogistic(points, lambda) {
        let w = [0,0,0];
        for (let iter = 0; iter < 1000; iter++) {
            let g0 = 0, g1 = 0, g2 = 0;
            for (const p of points) {
                const x1 = (p.x - 50)/25, x2 = (p.y - 50)/25;
                const residual = sigmoid(w[0]+w[1]*x1+w[2]*x2) - p.label;
                g0 += residual; g1 += residual*x1; g2 += residual*x2;
            }
            w[0] -= .36*g0/points.length;
            w[1] -= .36*(g1/points.length + lambda*w[1]);
            w[2] -= .36*(g2/points.length + lambda*w[2]);
        }
        return {
            weights:w,
            score:(x,y)=>w[0]+w[1]*(x-50)/25+w[2]*(y-50)/25,
            probability:(x,y)=>sigmoid(w[0]+w[1]*(x-50)/25+w[2]*(y-50)/25)
        };
    }
    const state = {shape:"blobs", seed:43, lambda:.05, threshold:.5, point:{x:56,y:54}};
    function percent(x) { return (100*x).toFixed(1).replace(".",",") + " %"; }
    function text(x) { return x.toFixed(2).replace(".",","); }
    function plot(points, training, model) {
        const W=480,H=368,m={l:43,r:15,t:17,b:38};
        const X=x=>m.l+(W-m.l-m.r)*x/100;
        const Y=y=>H-m.b-(H-m.t-m.b)*y/100;
        const parent=svg("svg",{viewBox:`0 0 ${W} ${H}`,role:"img",
            "aria-label":"Nuage de points et régions de décision de la régression logistique"});
        const N=45;
        for(let xi=0;xi<N;xi++) for(let yi=0;yi<N;yi++) {
            const p=model.probability(100*(xi+.5)/N,100*(yi+.5)/N);
            svg("rect",{x:X(100*xi/N),y:Y(100*(yi+1)/N),
                width:(W-m.l-m.r)/N+.2,height:(H-m.b-m.t)/N+.2,
                fill:p>=state.threshold?palette[1]:palette[0],opacity:.125},parent);
        }
        for(let v=0;v<=100;v+=25) {
            svg("line",{x1:X(v),x2:X(v),y1:Y(0),y2:Y(100),stroke:"#e6edf2"},parent);
            svg("line",{x1:X(0),x2:X(100),y1:Y(v),y2:Y(v),stroke:"#e6edf2"},parent);
            svg("text",{x:X(v),y:Y(0)+18,"text-anchor":"middle","font-size":10,fill:"#78899a"},parent,v);
            svg("text",{x:X(0)-7,y:Y(v)+4,"text-anchor":"end","font-size":10,fill:"#78899a"},parent,v);
        }
        svg("text",{x:W/2,y:H-2,"text-anchor":"middle",fill:"#71879a","font-size":11},parent,"Variable 1");
        svg("text",{transform:"rotate(-90)",x:-H/2,y:13,"text-anchor":"middle",fill:"#71879a","font-size":11},parent,"Variable 2");
        // Frontière logit(p) = log(seuil/(1-seuil)), avec découpage aux bords.
        const target=Math.log(state.threshold/(1-state.threshold));
        const w=model.weights;
        const intercept=w[0]-2*w[1]-2*w[2]-target;
        const endpoints=[];
        if(Math.abs(w[2])>1e-9) for(const xx of [0,100]) {
            const yy=-25*(intercept+(w[1]/25)*xx)/w[2];
            if(yy>=0&&yy<=100) endpoints.push({x:xx,y:yy});
        }
        if(Math.abs(w[1])>1e-9) for(const yy of [0,100]) {
            const xx=-25*(intercept+(w[2]/25)*yy)/w[1];
            if(xx>=0&&xx<=100) endpoints.push({x:xx,y:yy});
        }
        if(endpoints.length>=2) svg("line",{
            x1:X(endpoints[0].x),y1:Y(endpoints[0].y),
            x2:X(endpoints[1].x),y2:Y(endpoints[1].y),
            stroke:"#274f6f","stroke-width":3.1},parent);
        const inTraining=new Set(training.map(p=>p.id));
        for(const p of points) {
            const isTrain=inTraining.has(p.id);
            svg("circle",{cx:X(p.x),cy:Y(p.y),r:4.7,
                fill:isTrain?palette[p.label]:"white",stroke:isTrain?"white":palette[p.label],
                "stroke-width":isTrain?1:2.2,opacity:.9},parent);
        }
        svg("circle",{cx:X(state.point.x),cy:Y(state.point.y),r:8,
            fill:"white",stroke:"#182f43","stroke-width":2.7},parent);
        svg("circle",{cx:X(state.point.x),cy:Y(state.point.y),r:2.7,fill:"#182f43"},parent);
        svg("rect",{x:X(0),y:Y(100),width:X(100)-X(0),height:Y(0)-Y(100),
            fill:"transparent",style:"cursor:crosshair"},parent)
            .addEventListener("click",evt=>{
                const rect=parent.getBoundingClientRect();
                const ux=(evt.clientX-rect.left)*W/rect.width;
                const uy=(evt.clientY-rect.top)*H/rect.height;
                state.point={x:Math.max(0,Math.min(100,(ux-m.l)/(W-m.l-m.r)*100)),
                    y:Math.max(0,Math.min(100,(H-m.b-uy)/(H-m.b-m.t)*100))};
                render();
            });
        $("log-scatter").replaceChildren(parent);
    }
    function curve(z) {
        const W=420,H=328,m={l:47,r:18,t:22,b:45};
        const X=x=>m.l+(W-m.l-m.r)*(x+6)/12;
        const Y=p=>H-m.b-(H-m.t-m.b)*p;
        const pic=svg("svg",{viewBox:`0 0 ${W} ${H}`,role:"img","aria-label":"Fonction sigmoïde et seuil de décision"});
        for(let v=0;v<=1.01;v+=.25) {
            svg("line",{x1:X(-6),x2:X(6),y1:Y(v),y2:Y(v),stroke:"#e7eef3"},pic);
            svg("text",{x:X(-6)-8,y:Y(v)+4,"font-size":10.5,"text-anchor":"end",fill:"#78899a"},pic,v.toFixed(2));
        }
        for(let v=-6;v<=6;v+=2) svg("text",{x:X(v),y:Y(0)+18,"font-size":10.5,"text-anchor":"middle",fill:"#78899a"},pic,v);
        const d=Array.from({length:101},(_,i)=>{
            const x=-6+12*i/100;
            return `${i?"L":"M"}${X(x).toFixed(2)},${Y(sigmoid(x)).toFixed(2)}`;
        }).join(" ");
        svg("path",{d,fill:"none",stroke:"#447aa6","stroke-width":3},pic);
        svg("line",{x1:X(-6),x2:X(6),y1:Y(state.threshold),y2:Y(state.threshold),
            stroke:"#d28d59","stroke-width":2,"stroke-dasharray":"6 4"},pic);
        svg("circle",{cx:X(Math.max(-6,Math.min(6,z))),cy:Y(sigmoid(z)),
            r:7,fill:"#d28d59",stroke:"white","stroke-width":2},pic);
        svg("text",{x:W/2,y:H-3,"text-anchor":"middle","font-size":11,fill:"#71879a"},pic,"Score linéaire z");
        svg("text",{transform:"rotate(-90)",x:-H/2,y:13,"text-anchor":"middle","font-size":11,fill:"#71879a"},pic,"Probabilité P(classe 2)");
        $("log-sigmoid").replaceChildren(pic);
    }
    function render() {
        const points=generate(state.shape,state.seed);
        const {training,validation}=split(points,state.seed);
        const model=fitLogistic(training,state.lambda);
        plot(points,training,model);
        const z=model.score(state.point.x,state.point.y),p=model.probability(state.point.x,state.point.y);
        curve(z);
        const accuracy=validation.filter(item=>(model.probability(item.x,item.y)>=state.threshold?1:0)===item.label).length/validation.length;
        $("log-p").textContent=percent(p);
        $("log-class").textContent=p>=state.threshold?"Classe 2":"Classe 1";
        $("log-accuracy").textContent=percent(accuracy);
        $("log-selected").textContent=`Observation (${text(state.point.x)} ; ${text(state.point.y)}) : z = ${text(z)}, p = ${text(p)}.`;
        $("log-count").textContent=`${training.length} observations d'entraînement, ${validation.length} de validation.`;
        $("log-threshold-value").textContent=text(state.threshold);
        $("log-regularization-value").textContent=text(state.lambda);
    }
    $("log-shape").addEventListener("change",function(){state.shape=this.value;render();});
    $("log-regenerate").addEventListener("click",function(){state.seed+=29;render();});
    $("log-regularization").addEventListener("input",function(){state.lambda=+this.value;render();});
    $("log-threshold").addEventListener("input",function(){state.threshold=+this.value;render();});
    render();
}());
