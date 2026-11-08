"use strict";
// Bibliothèque minimale de fonctions mathématiques et de tracé.
// Fonctions communes aux simulations, sans framework.
window.ML = (function () {
    const palette = ["#447aa6", "#d28d59", "#4e9582", "#8977a6",
        "#b6985c", "#748a9a", "#af727b", "#7d9d57"];
    function rng(seed) {
        let state = seed >>> 0;
        return function () {
            state = (Math.imul(1664525, state) + 1013904223) >>> 0;
            return state / 4294967296;
        };
    }
    function gaussian(random) {
        const u = Math.max(1e-10, random());
        return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * random());
    }
    function clamp(v, a = 2, b = 98) {
        return Math.max(a, Math.min(b, v));
    }
    function dist2(a, b) {
        return (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
    }
    function dist(a, b) { return Math.sqrt(dist2(a, b)); }
    function shuffleIndices(n, random) {
        const a = Array.from({length:n}, (_, i) => i);
        for (let i = n - 1; i > 0; i--) {
            const j = Math.floor(random() * (i + 1));
            [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
    }
    function dataset(shape = "blobs", seed = 124) {
        const random = rng(seed), pts = [];
        function add(cx, cy, n, sx = 6, sy = sx, slope = 0) {
            for (let i = 0; i < n; i++) {
                const dx = gaussian(random) * sx;
                pts.push({x:clamp(cx + dx),
                    y:clamp(cy + gaussian(random) * sy + dx * slope)});
            }
        }
        if (shape === "blobs") {
            add(25, 28, 50, 6); add(76, 30, 50, 6); add(51, 75, 50, 6);
        } else if (shape === "elongated") {
            add(26, 34, 45, 13, 3, .9);
            add(73, 62, 45, 13, 3, .9);
            add(48, 80, 45, 12, 3, .75);
        } else if (shape === "moons") {
            for (let i = 0; i < 70; i++) {
                const t = Math.PI * (i + .5) / 70;
                pts.push({x:clamp(39 + 29*Math.cos(t) + gaussian(random)*1.4),
                    y:clamp(41 + 23*Math.sin(t) + gaussian(random)*1.4)});
                pts.push({x:clamp(64 - 29*Math.cos(t) + gaussian(random)*1.4),
                    y:clamp(53 - 23*Math.sin(t) + gaussian(random)*1.4)});
            }
        } else if (shape === "circles") {
            for (let i = 0; i < 75; i++) {
                const t = 2*Math.PI*(i + .5)/75;
                pts.push({x:clamp(50 + 18*Math.cos(t)+gaussian(random)*1.2),
                    y:clamp(50 + 18*Math.sin(t)+gaussian(random)*1.2)});
                pts.push({x:clamp(50 + 36*Math.cos(t)+gaussian(random)*1.2),
                    y:clamp(50 + 36*Math.sin(t)+gaussian(random)*1.2)});
            }
        } else if (shape === "varying") {
            add(20, 22, 37, 2.5);add(72, 25, 50, 6);add(52, 73, 55, 13);
        } else if (shape === "noise") {
            add(28, 29, 42, 5);add(73, 69, 42, 5);
            for (let i = 0; i < 38; i++) {
                pts.push({x:clamp(2+96*random()), y:clamp(2+96*random())});
            }
        }
        return pts;
    }
    // K-means de Lloyd : sélection du meilleur de plusieurs départs.
    function fitKmeans(points, k, seed = 7, restarts = 6) {
        const n = points.length;
        if (k < 1 || k > n) throw Error("K invalide");
        let best = null;
        for (let run = 0; run < restarts; run++) {
            const random = rng(seed + 1109 * (run + 1));
            const indices = shuffleIndices(n, random);
            let centres = indices.slice(0,k).map(i => ({...points[i]}));
            let labels = new Array(n).fill(-1);
            for (let iter = 0; iter < 65; iter++) {
                let changes = 0;
                for (let i = 0; i < n; i++) {
                    let dmin = Infinity, which = 0;
                    for (let j = 0; j < k; j++) {
                        const d = dist2(points[i], centres[j]);
                        if (d < dmin) {dmin = d; which = j;}
                    }
                    if (labels[i] !== which) changes++;
                    labels[i] = which;
                }
                const sums = Array.from({length:k}, () => ({x:0,y:0,n:0}));
                points.forEach((p,i) => {
                    const s = sums[labels[i]];s.x+=p.x;s.y+=p.y;s.n++;
                });
                centres = centres.map((c,j) => sums[j].n ?
                    {x:sums[j].x/sums[j].n, y:sums[j].y/sums[j].n} :
                    {...points[indices[(j + iter + run) % n]]});
                if (!changes && iter > 0) break;
            }
            const inertia = points.reduce((sum,p,i) =>
                sum + dist2(p,centres[labels[i]]),0);
            if (!best || inertia < best.inertia) {
                best = {centres,labels:labels.slice(),inertia};
            }
        }
        return best;
    }
    function silhouette(points, labels) {
        const unique = [...new Set(labels)].filter(v => v >= 0);
        if (unique.length < 2 || unique.length >= points.length) return null;
        const groups = new Map(unique.map(id => [id, []]));
        labels.forEach((id,i) => {if(groups.has(id))groups.get(id).push(i);});
        let sum = 0;
        for (let i = 0; i < points.length; i++) {
            const own = groups.get(labels[i]);
            if (!own || own.length === 1) continue;
            let a = 0;
            for (const j of own) if(i!==j) a+=dist(points[i], points[j]);
            a /= own.length-1;
            let b = Infinity;
            for(const [id,members] of groups) {
                if (id===labels[i] || !members.length) continue;
                let other=0;
                for(const j of members) other+=dist(points[i],points[j]);
                b=Math.min(b,other/members.length);
            }
            sum+=(b-a)/Math.max(a,b);
        }
        return sum/points.length;
    }
    // Agglomératif : fusion avec une matrice de distances tenue à jour.
    function hierarchical(points, k, linkage = "ward") {
        const n = points.length, limit=2*n, mat=new Float64Array(limit*limit);
        const at = (i,j) => mat[i*limit+j];
        function put(i,j,d){mat[i*limit+j]=d;mat[j*limit+i]=d;}
        const sizes=new Float64Array(limit);
        const means=new Array(limit), members=new Array(limit);
        for(let i=0;i<n;i++){
            sizes[i]=1;means[i]={...points[i]};members[i]=[i];
            for(let j=0;j<i;j++){
                const d=dist(points[i],points[j]);
                put(i,j,linkage==="ward" ? d*d/2 : d);
            }
        }
        let active=Array.from({length:n},(_,i)=>i),next=n;
        while(active.length>k){
            let ai=-1,bi=-1,best=Infinity;
            for(let u=0;u<active.length;u++){
                for(let v=0;v<u;v++){
                    const a=active[u],b=active[v],d=at(a,b);
                    if(d<best){best=d;ai=a;bi=b;}
                }
            }
            const nc=next++,sa=sizes[ai],sb=sizes[bi];
            sizes[nc]=sa+sb;
            means[nc]={x:(sa*means[ai].x+sb*means[bi].x)/(sa+sb),
                y:(sa*means[ai].y+sb*means[bi].y)/(sa+sb)};
            members[nc]=members[ai].concat(members[bi]);
            for(const other of active){
                if(other===ai||other===bi)continue;
                let d;
                if(linkage==="ward"){
                    const m=means[nc],t=means[other];
                    d=(sizes[nc]*sizes[other]/(sizes[nc]+sizes[other]))*dist2(m,t);
                }else if(linkage==="single") d=Math.min(at(ai,other),at(bi,other));
                else if(linkage==="complete") d=Math.max(at(ai,other),at(bi,other));
                else d=(sa*at(ai,other)+sb*at(bi,other))/(sa+sb);
                put(nc,other,d);
            }
            active=active.filter(id=>id!==ai&&id!==bi);
            active.push(nc);
        }
        const labels=new Array(n).fill(-1);
        active.forEach((id,c)=>members[id].forEach(i=>labels[i]=c));
        return {labels,found:active.length};
    }
    function dbscan(points, eps, minpts) {
        const n=points.length;
        const neighbors=points.map(p=>[]);
        for(let i=0;i<n;i++) for(let j=i;j<n;j++){
            if(dist2(points[i],points[j])<=eps*eps){
                neighbors[i].push(j);
                if(j!==i)neighbors[j].push(i);
            }
        }
        const labels=new Array(n).fill(-2),seen=new Array(n).fill(false);
        let cluster=0;
        for(let i=0;i<n;i++){
            if(seen[i])continue;
            seen[i]=true;
            if(neighbors[i].length<minpts){labels[i]=-1;continue;}
            labels[i]=cluster;
            const queue=neighbors[i].slice();let head=0;
            while(head<queue.length){
                const j=queue[head++];
                if(!seen[j]){
                    seen[j]=true;
                    if(neighbors[j].length>=minpts) queue.push(...neighbors[j]);
                }
                if(labels[j]<0)labels[j]=cluster;
            }
            cluster++;
        }
        return {labels, found:cluster, noise:labels.filter(v=>v===-1).length};
    }
    function scatter(el, points, labels = [], opts = {}) {
        const w=720,h=410,m={l:48,r:18,t:17,b:37};
        const sx=d3.scaleLinear().domain(opts.xDomain||[0,100]).range([m.l,w-m.r]);
        const sy=d3.scaleLinear().domain(opts.yDomain||[0,100]).range([h-m.b,m.t]);
        const svg=d3.select(el).selectAll("svg").data([0]).join("svg")
            .attr("viewBox",`0 0 ${w} ${h}`)
            .attr("role","img")
            .attr("aria-label",opts.aria||"Nuage de points interactif");
        svg.selectAll("*").remove();
        const grid=svg.append("g");
        grid.append("g").attr("transform",`translate(0,${sy.range()[0]})`)
            .call(d3.axisBottom(sx).ticks(5).tickSize(-(sy.range()[0]-sy.range()[1])).tickFormat(""));
        grid.append("g").attr("transform",`translate(${sx.range()[0]},0)`)
            .call(d3.axisLeft(sy).ticks(5).tickSize(-(sx.range()[1]-sx.range()[0])).tickFormat(""));
        grid.selectAll("line").attr("stroke","#edf2f6");
        grid.selectAll("path").remove();
        svg.append("g").attr("transform",`translate(0,${sy.range()[0]})`)
            .call(d3.axisBottom(sx).ticks(5)).call(g=>g.selectAll("path,line").attr("stroke","#cdd8e2"))
            .call(g=>g.selectAll("text").attr("fill","#7f90a3"));
        svg.append("g").attr("transform",`translate(${sx.range()[0]},0)`)
            .call(d3.axisLeft(sy).ticks(5)).call(g=>g.selectAll("path,line").attr("stroke","#cdd8e2"))
            .call(g=>g.selectAll("text").attr("fill","#7f90a3"));
        if(opts.xLabel)svg.append("text").attr("x",w/2).attr("y",h-3)
            .attr("text-anchor","middle").attr("fill","#7a8d9f").attr("font-size",11).text(opts.xLabel);
        if(opts.yLabel)svg.append("text").attr("transform","rotate(-90)")
            .attr("x",-h/2).attr("y",13).attr("text-anchor","middle")
            .attr("fill","#7a8d9f").attr("font-size",11).text(opts.yLabel);
        const rect=svg.append("rect").attr("x",m.l).attr("y",m.t)
            .attr("width",w-m.l-m.r).attr("height",h-m.t-m.b)
            .attr("fill","transparent").attr("pointer-events","all");
        const dots=svg.append("g").attr("pointer-events","none")
            .selectAll("circle").data(points).join("circle")
            .attr("cx",p=>sx(p.x)).attr("cy",p=>sy(p.y))
            .attr("r",3.6)
            .attr("fill",(_,i)=> labels[i]===-1? "#aebbc7":
                labels[i] == null ? "#93a6b6" : palette[labels[i]%palette.length])
            .attr("fill-opacity",.82);
        return {svg,sx,sy,rect,dots};
    }
    return {palette,rng,gaussian,clamp,dist,dist2,dataset,shuffleIndices,
        fitKmeans,silhouette,hierarchical,dbscan,scatter};
}());
