"use strict";
// Chargement robuste de D3 et des scripts nécessaires à cette seule page.
(async function () {
    const status = document.getElementById("hc-message");
    const cdns = [
        "../assets/vendor/d3.v7.min.js",
        "https://cdn.jsdelivr.net/npm/d3@7.9.0/dist/d3.min.js",
        "https://unpkg.com/d3@7.9.0/dist/d3.min.js"
    ];
    function load(src) {
        return new Promise((resolve, reject) => {
            const script = document.createElement("script");
            let settled = false;
            const timeout = setTimeout(() => {
                if (settled) return;
                settled = true;
                script.remove();
                reject(new Error("Chargement trop long : " + src));
            }, 10000);
            script.onload = () => {
                if (settled) return;
                settled = true;
                clearTimeout(timeout);
                resolve();
            };
            script.onerror = () => {
                if (settled) return;
                settled = true;
                clearTimeout(timeout);
                script.remove();
                reject(new Error("Impossible de charger : " + src));
            };
            script.src = src;
            document.body.appendChild(script);
        });
    }
    try {
        if (!window.d3) {
            for (const url of cdns) {
                try {
                    await load(url);
                    if (window.d3) break;
                } catch (error) {
                    console.warn(error.message);
                }
            }
        }
        if (!window.d3) {
            throw new Error("D3.js est inaccessible. Vérifiez les ressources du site.");
        }
        for (const file of ["common.js", "hierarchique.js"]) {
            await load("../assets/js/" + file);
        }
    } catch (error) {
        console.error(error);
        status.textContent = "La simulation ne peut pas démarrer : " + error.message;
        status.style.color = "#a33b31";
    }
}());
