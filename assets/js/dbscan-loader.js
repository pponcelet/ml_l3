"use strict";
// Chargement de la page DBSCAN, indépendant des autres animations.
(async function () {
    const status = document.getElementById("db-message");
    const cdns = [
        "../assets/vendor/d3.v7.min.js",
        "https://cdn.jsdelivr.net/npm/d3@7.9.0/dist/d3.min.js",
        "https://unpkg.com/d3@7.9.0/dist/d3.min.js"
    ];
    function load(src) {
        return new Promise((resolve, reject) => {
            const element = document.createElement("script");
            let done = false;
            const timeout = setTimeout(() => {
                if (done) return;
                done = true;
                element.remove();
                reject(new Error("Délai de chargement dépassé : " + src));
            }, 10000);
            element.onload = () => {
                if (done) return;
                done = true;
                clearTimeout(timeout);
                resolve();
            };
            element.onerror = () => {
                if (done) return;
                done = true;
                clearTimeout(timeout);
                element.remove();
                reject(new Error("Fichier inaccessible : " + src));
            };
            element.src = src;
            document.body.appendChild(element);
        });
    }
    try {
        if (!window.d3) {
            for (const src of cdns) {
                try {
                    await load(src);
                    if (window.d3) break;
                } catch (error) {
                    console.warn(error.message);
                }
            }
        }
        if (!window.d3) {
            throw new Error("D3.js est inaccessible : vérifiez la connexion Internet.");
        }
        for (const script of ["common.js", "dbscan.js"]) {
            await load("../assets/js/" + script);
        }
    } catch (error) {
        console.error(error);
        status.textContent = "La simulation ne peut pas démarrer : " + error.message;
        status.style.color = "#a33b31";
    }
}());
