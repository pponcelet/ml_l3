"use strict";
(function () {
    const ns = "http://www.w3.org/2000/svg";
    const colors = ["#447aa6", "#d28d59"];
    const $ = (id) => document.getElementById(id);
    function el(tag, attrs, parent, value) {
        const e = document.createElementNS(ns, tag);
        Object.entries(attrs || {}).forEach(([k, v]) => e.setAttribute(k, v));
        if (value !== undefined) e.textContent = value;
        if (parent) parent.appendChild(e);
        return e;
    }
    function rng(seed) {
        let x = seed >>> 0;
        return () => ((x = (Math.imul(1664525, x) + 1013904223) >>> 0) / 4294967296);
    }
    function normal(random) {
        return Math.sqrt(-2 * Math.log(Math.max(random(), 1e-9))) * Math.cos(2 * Math.PI * random());
    }
    function clamp(x) { return Math.max(2, Math.min(98, x)); }
    function data(shape, seed) {
        const r = rng(seed), pts = [];
        function add(x, y, c) { pts.push({x: clamp(x), y: clamp(y), c}); }
        if (shape === "blobs") {
            for (let i = 0; i < 68; i++) {
                add(32 + 12 * normal(r), 40 + 13 * normal(r), 0);
                add(68 + 12 * normal(r), 62 + 13 * normal(r), 1);
            }
        } else if (shape === "moons") {
            for (let i = 0; i < 65; i++) {
                const t = Math.PI * (i + 0.5) / 65;
                add(44 + 27 * Math.cos(t) + normal(r) * 2.1,
                    44 + 22 * Math.sin(t) + normal(r) * 2.1, 0);
                add(59 - 27 * Math.cos(t) + normal(r) * 2.1,
                    55 - 22 * Math.sin(t) + normal(r) * 2.1, 1);
            }
        } else {
            for (let i = 0; i < 68; i++) {
                const t = 2 * Math.PI * r();
                add(50 + (16 + normal(r) * 1.7) * Math.cos(t),
                    50 + (16 + normal(r) * 1.7) * Math.sin(t), 0);
                add(50 + (34 + normal(r) * 2.2) * Math.cos(t),
                    50 + (34 + normal(r) * 2.2) * Math.sin(t), 1);
            }
        }
        return pts;
    }
    function svg(container, label, width = 580, height = 450) {
        container.replaceChildren();
        return el("svg", {viewBox:`0 0 ${width} ${height}`, role:"img", "aria-label": label}, container);
    }
    function drawPlot(container, pts, predict, marks = {}) {
        const w = 580, h = 450, m = {left: 43, right: 14, top: 17, bottom: 42};
        const sx = (x) => m.left + x / 100 * (w - m.left - m.right);
        const sy = (y) => h - m.bottom - y / 100 * (h - m.top - m.bottom);
        const s = svg(container, "Observations et zones de décision", w, h);
        const N = 54;
        for (let iy = 0; iy < N; iy++) {
            for (let ix = 0; ix < N; ix++) {
                const x = (ix + .5) * 100 / N;
                const y = (iy + .5) * 100 / N;
                const c = predict(x, y) === 1 ? colors[1] : colors[0];
                el("rect", {x:sx(ix * 100 / N), y:sy((iy + 1)*100/N),
                    width:(w-m.left-m.right)/N + .2,
                    height:(h-m.top-m.bottom)/N + .2,
                    fill:c, opacity:.125}, s);
            }
        }
        for (let t = 0; t <= 100; t += 20) {
            const x=sx(t), y=sy(t);
            el("line", {x1:x, y1:sy(0), x2:x, y2:sy(100), stroke:"#e2e8ef", "stroke-width":.75}, s);
            el("line", {x1:sx(0), y1:y, x2:sx(100), y2:y, stroke:"#e2e8ef", "stroke-width":.75}, s);
            el("text", {x, y:sy(0)+18, "text-anchor":"middle", "font-size":11, fill:"#71849a"}, s, t);
            el("text", {x:sx(0)-9, y:y+4, "text-anchor":"end", "font-size":11, fill:"#71849a"}, s, t);
        }
        // Couper les droites à la zone de tracé, même pour de fortes pentes.
        function clipSegment([x0,y0,x1,y1]) {
            const dx=x1-x0,dy=y1-y0;
            let t0=0,t1=1;
            for(const [p,q] of [[-dx,x0],[dx,100-x0],[-dy,y0],[dy,100-y0]]) {
                if(Math.abs(p)<1e-12) { if(q<0)return null; continue; }
                const r=q/p;
                if(p<0){ t0=Math.max(t0,r); }
                else { t1=Math.min(t1,r); }
                if(t0>t1)return null;
            }
            return [x0+t0*dx,y0+t0*dy,x0+t1*dx,y0+t1*dy];
        }
        if (marks.lines) marks.lines.forEach((line) => {
            const segment=clipSegment(line);
            if(!segment)return;
            el("line", {x1:sx(segment[0]),y1:sy(segment[1]),
                x2:sx(segment[2]),y2:sy(segment[3]),
                stroke:line[4] || "#243b53","stroke-width":line[5] || 2,
                "stroke-dasharray":line[6] || "none"},s);
        });
        pts.forEach((p, i) => {
            el("circle", {cx:sx(p.x), cy:sy(p.y), r:marks.support?.has(i) ? 5.7 : 4.4,
                fill:colors[p.c], stroke:marks.support?.has(i) ? "#243b53" : "white",
                "stroke-width":marks.support?.has(i) ? 2.4 : 1, opacity:.93},s);
        });
        el("text", {x:w/2,y:h-4,"text-anchor":"middle", "font-size":12, fill:"#647b8e"},s,"Variable 1");
        el("text", {transform:"rotate(-90)",x:-h/2,y:13,"text-anchor":"middle", "font-size":12,fill:"#647b8e"},s,"Variable 2");
    }
    function impurity(a, b) {
        const n = a + b;
        if (!n) return 0;
        return 1 - (a/n)**2 - (b/n)**2;
    }
    function trainTree(points, maxDepth, minLeaf) {
        function build(indices, depth) {
            const n = indices.length;
            const cnt = indices.reduce((sum, i) => sum + points[i].c, 0);
            const node = {n, count0:n-cnt, count1:cnt, pred:cnt > n/2 ? 1 : 0, depth};
            if (depth >= maxDepth || cnt === 0 || cnt === n || n < 2*minLeaf) return node;
            let best = null;
            for (const axis of ["x", "y"]) {
                const sorted = indices.slice().sort((a,b)=>points[a][axis]-points[b][axis]);
                let left1 = 0;
                for (let cut=1; cut<n; cut++) {
                    left1 += points[sorted[cut-1]].c;
                    if (cut < minLeaf || n-cut < minLeaf ||
                        points[sorted[cut-1]][axis]===points[sorted[cut]][axis]) continue;
                    const right1=cnt-left1;
                    const score=(cut*impurity(cut-left1,left1)+(n-cut)*impurity(n-cut-right1,right1))/n;
                    if (!best || score<best.score-1e-10) best={axis,threshold:(points[sorted[cut-1]][axis]+points[sorted[cut]][axis])/2,score};
                }
            }
            if (!best || best.score>=impurity(n-cnt,cnt)-1e-10) return node;
            node.axis=best.axis;
            node.threshold=best.threshold;
            const left=indices.filter(i=>points[i][best.axis]<=best.threshold);
            const right=indices.filter(i=>points[i][best.axis]>best.threshold);
            node.left=build(left,depth+1); node.right=build(right,depth+1);
            return node;
        }
        return build(points.map((_,i)=>i),0);
    }
    function treePredict(node,x,y) {
        let n=node;
        while(n.left) n=(n.axis==="x" ? x:y)<=n.threshold ? n.left:n.right;
        return n.pred;
    }
    function leaves(node) {return node.left ? leaves(node.left)+leaves(node.right) : 1;}
    function splits(node) {return node.left ? 1+splits(node.left)+splits(node.right) : 0;}
    function drawTree(container,node) {
        const width=850,height=390,s=svg(container,"Arbre de décision",width,height);
        let index=0;
        function prepare(n){if(n.left){prepare(n.left);n.x=(n.left.x+n.right.x)/2;prepare(n.right);n.x=(n.left.x+n.right.x)/2;}else{n.x=++index;} }
        // First count leaves to position all terminal branches without overlap.
        const nLeaves=leaves(node);
        let leafIndex=0;
        function locate(n){
            n.y=30+n.depth*77;
            if(n.left){locate(n.left);locate(n.right);n.x=(n.left.x+n.right.x)/2;}
            else n.x=35+(++leafIndex-.5)*(width-70)/nLeaves;
        }
        locate(node);
        const maxDepth=Math.max(1, (function d(n){return n.left?Math.max(d(n.left),d(n.right)):n.depth;})(node));
        s.setAttribute("viewBox",`0 0 ${width} ${Math.max(150,45+maxDepth*78)}`);
        function draw(n){
            if(n.left){
                for(const [child,txt] of [[n.left,"oui"],[n.right,"non"]]){
                    el("line",{x1:n.x,y1:n.y+16,x2:child.x,y2:child.y-16,stroke:"#97aabd","stroke-width":1.6},s);
                    el("text",{x:(n.x+child.x)/2,y:(n.y+child.y)/2-5,"text-anchor":"middle",fill:"#63768a","font-size":11},s,txt);
                }
            }
            const leaf=!n.left;
            el("rect",{x:n.x-37,y:n.y-17,width:74,height:34,rx:7,
                fill:leaf?colors[n.pred]:"#e5eff7",stroke:leaf?"#fff":"#b6cddd","stroke-width":1.2},s);
            el("text",{x:n.x,y:n.y-3,"text-anchor":"middle",fill:leaf?"white":"#2d5677","font-size":12,"font-weight":700},s,
                leaf ? `Classe ${n.pred+1}` : `${n.axis} ≤ ${n.threshold.toFixed(1)}`);
            el("text",{x:n.x,y:n.y+11,"text-anchor":"middle",fill:leaf?"white":"#456a88","font-size":10},s,`n = ${n.n}`);
            if(n.left){draw(n.left);draw(n.right);}
        }
        draw(node);
    }
    function kernel(a,b,type,gamma) {
        if(type==="linear") return (a.x*b.x+a.y*b.y);
        const dx=a.x-b.x,dy=a.y-b.y;
        return Math.exp(-gamma*(dx*dx+dy*dy));
    }
    // Binary C-SVM via deterministic simplified SMO with equality constraint.
    function trainSvm(points,type,C,gamma) {
        const n=points.length, x=points.map(p=>({x:(p.x-50)/25,y:(p.y-50)/25})),
            y=points.map(p=>p.c===1?1:-1), alpha=new Float64Array(n),
            K=Array.from({length:n},()=>new Float64Array(n));
        for(let i=0;i<n;i++) for(let j=0;j<=i;j++){
            K[i][j]=kernel(x[i],x[j],type,gamma);K[j][i]=K[i][j];
        }
        let b=0, passes=0;
        for(let epoch=0;epoch<260 && passes<8;epoch++){
            let changed=0;
            for(let i=0;i<n;i++){
                let f=b;
                for(let q=0;q<n;q++) if(alpha[q]>0)f+=alpha[q]*y[q]*K[q][i];
                const eI=f-y[i];
                if(!((y[i]*eI < -1e-3 && alpha[i] < C-1e-6) ||
                     (y[i]*eI > 1e-3 && alpha[i] > 1e-6))) continue;
                const j=(i+1+((epoch*17+i*13)%(n-1)))%n;
                let fJ=b;
                for(let q=0;q<n;q++)if(alpha[q]>0)fJ+=alpha[q]*y[q]*K[q][j];
                const eJ=fJ-y[j], ai=alpha[i], aj=alpha[j];
                const L=y[i]===y[j] ? Math.max(0,ai+aj-C):Math.max(0,aj-ai);
                const H=y[i]===y[j] ? Math.min(C,ai+aj):Math.min(C,C+aj-ai);
                if(H-L<1e-9)continue;
                const eta=2*K[i][j]-K[i][i]-K[j][j];
                if(eta>=-1e-9)continue;
                const ajNew=Math.max(L,Math.min(H,aj-y[j]*(eI-eJ)/eta));
                if(Math.abs(ajNew-aj)<1e-6)continue;
                const aiNew=ai+y[i]*y[j]*(aj-ajNew);
                const b1=b-eI-y[i]*(aiNew-ai)*K[i][i]-y[j]*(ajNew-aj)*K[i][j];
                const b2=b-eJ-y[i]*(aiNew-ai)*K[i][j]-y[j]*(ajNew-aj)*K[j][j];
                b=(aiNew>1e-7&&aiNew<C-1e-7)?b1:(ajNew>1e-7&&ajNew<C-1e-7)?b2:(b1+b2)/2;
                alpha[i]=aiNew;alpha[j]=ajNew;changed++;
            }
            passes=changed===0?passes+1:0;
        }
        const sv=Array.from(alpha).map((a,i)=>({a,i})).filter(o=>o.a>1e-5);
        const decision=(rawX,rawY)=>{
            const z={x:(rawX-50)/25,y:(rawY-50)/25};
            let value=b;
            for(const v of sv)value+=v.a*y[v.i]*kernel(x[v.i],z,type,gamma);
            return value;
        };
        const result={decision,predict:(rawX,rawY)=>decision(rawX,rawY)>=0?1:0,support:new Set(sv.map(o=>o.i))};
        if(type==="linear"){
            let wx=0,wy=0;
            sv.forEach(({a,i})=>{wx+=a*y[i]*x[i].x;wy+=a*y[i]*x[i].y;});
            result.line = {wx,wy,b};
        }
        return result;
    }
    function runTree(){
        const host=$("dt-lab"); if(!host)return;
        let seed=17;
        function refresh(){
            const points=data($("dt-dataset").value,seed), depth=+$("dt-depth").value,
                leaf=+$("dt-leaf").value;
            $("dt-depth-value").textContent=depth;
            $("dt-leaf-value").textContent=leaf;
            const root=trainTree(points,depth,leaf);
            const pred=(x,y)=>treePredict(root,x,y);
            drawPlot($("dt-plot"),points,pred);
            drawTree($("dt-tree"),root);
            $("dt-splits").textContent=splits(root);
            $("dt-leaves").textContent=leaves(root);
            $("dt-accuracy").textContent=(100*points.filter(p=>pred(p.x,p.y)===p.c).length/points.length).toFixed(1).replace(".",",")+" %";
        }
        ["dt-depth","dt-leaf","dt-dataset"].forEach(id=>$(id).addEventListener("input",refresh));
        $("dt-seed").addEventListener("click",()=>{seed+=31;refresh();});
        refresh();
    }
    function runSvm(){
        const host=$("svm-lab"); if(!host)return;
        let seed=23;
        function refresh(){
            const points=data($("svm-dataset").value,seed),type=$("svm-kernel").value,
                C=+$("svm-c").value,gamma=+$("svm-gamma").value;
            $("svm-c-value").textContent=C.toFixed(1).replace(".",",");
            $("svm-gamma-value").textContent=gamma.toFixed(1).replace(".",",");
            $("svm-gamma").disabled=type==="linear";
            const model=trainSvm(points,type,C,gamma);
            const lines=[];
            if(model.line){
                const {wx,wy,b}=model.line;
                for(const [margin,col,dash] of [[0,"#243b53",null],[1,"#7f90a3","6 5"],[-1,"#7f90a3","6 5"]]){
                    if(Math.abs(wy)>1e-9){
                        const yFor=(x)=>50+25*((margin-b-wx*(x-50)/25)/wy);
                        lines.push([0,yFor(0),100,yFor(100),col,margin?1.5:2.5,dash]);
                    } else if(Math.abs(wx)>1e-9){
                        const x=50+25*(margin-b)/wx;
                        lines.push([x,0,x,100,col,margin?1.5:2.5,dash]);
                    }
                }
            }
            drawPlot($("svm-plot"),points,model.predict,{support:model.support,lines});
            $("svm-support").textContent=model.support.size;
            $("svm-accuracy").textContent=(100*points.filter(p=>model.predict(p.x,p.y)===p.c).length/points.length).toFixed(1).replace(".",",")+" %";
            $("svm-insight").textContent=type==="linear"?
                "Noyau linéaire : une frontière droite et, lorsque le modèle le permet, les deux lignes de marge en pointillés." :
                "Noyau RBF : une frontière courbe construite à partir des similarités avec les vecteurs de support.";
        }
        ["svm-kernel","svm-dataset","svm-c","svm-gamma"].forEach(id=>$(id).addEventListener("input",refresh));
        $("svm-seed").addEventListener("click",()=>{seed+=31;refresh();});
        refresh();
    }
    runTree();runSvm();
}());
