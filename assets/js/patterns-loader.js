"use strict";
// Charge les composants de fouille de motifs avec un CDN de secours.
(async function () {
    const status = document.getElementById("pm-error");
    const load = src => new Promise((resolve, reject) => {
        const script = document.createElement("script");
        const timeout = setTimeout(() => {
            script.remove();
            reject(new Error("Délai dépassé pour " + src));
        }, 10000);
        script.onload = () => { clearTimeout(timeout); resolve(); };
        script.onerror = () => {
            clearTimeout(timeout);
            script.remove();
            reject(new Error("Ressource inaccessible : " + src));
        };
        script.src = src;
        document.body.appendChild(script);
    });
    try {
        if (!window.d3) {
            for (const src of [
                "../assets/vendor/d3.v7.min.js",
        "https://cdn.jsdelivr.net/npm/d3@7.9.0/dist/d3.min.js",
                "https://unpkg.com/d3@7.9.0/dist/d3.min.js"
            ]) {
                try { await load(src); if (window.d3) break; }
                catch (error) { console.warn(error.message); }
            }
        }
        if (!window.d3) {
            throw new Error("D3.js ne s'est pas chargé. Vérifiez les ressources du site.");
        }
        const script = document.body.dataset.patternScript;
        const whitelist = new Set([
            "association.js", "apriori.js", "sequences.js", "gsp.js"
        ]);
        if (!whitelist.has(script)) throw new Error("Page de simulation non reconnue.");
        await load("../assets/js/patterns-common.js");
        await load("../assets/js/" + script);
    } catch (error) {
        console.error(error);
        if (status) {
            status.textContent = "Impossible de lancer l'animation : " + error.message;
            status.style.color = "#9a4938";
        }
    }
}());
