"use strict";
// Charge D3 et les modules dans l'ordre ; signale les problèmes de réseau.
(async function () {
    const status = document.getElementById("km-message");
    const urls = [
        "../assets/vendor/d3.v7.min.js",
        "https://cdn.jsdelivr.net/npm/d3@7.9.0/dist/d3.min.js",
        "https://unpkg.com/d3@7.9.0/dist/d3.min.js"
    ];
    function load(src) {
        return new Promise((resolve, reject) => {
            const script = document.createElement("script");
            let done = false;
            const timeout = setTimeout(() => {
                if (done) return;
                done = true;
                script.remove();
                reject(new Error("Délai de chargement dépassé : " + src));
            }, 10000);
            script.onload = () => {
                if (done) return;
                done = true;
                clearTimeout(timeout);
                resolve();
            };
            script.onerror = () => {
                if (done) return;
                done = true;
                clearTimeout(timeout);
                script.remove();
                reject(new Error("Impossible de charger : " + src));
            };
            script.src = src;
            document.body.appendChild(script);
        });
    }
    try {
        if (typeof window.d3 === "undefined") {
            for (const url of urls) {
                try {
                    await load(url);
                    if (typeof window.d3 !== "undefined") break;
                } catch (error) {
                    console.warn(error.message);
                }
            }
        }
        if (typeof window.d3 === "undefined") {
            throw new Error("D3.js est inaccessible. Vérifiez votre connexion " +
                "Internet et rechargez la page.");
        }
        for (const file of ["common.js", "kmeans.js",
            "choix-k.js", "pretraitement.js"]) {
            await load("../assets/js/" + file);
        }
    } catch (error) {
        console.error(error);
        status.textContent = "La simulation n'a pas pu démarrer : " +
            error.message;
        status.style.color = "#a33b31";
    }
}());
