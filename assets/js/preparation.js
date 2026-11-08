"use strict";
(function () {
    const byId = (id) => document.getElementById(id);
    const names = ["A", "B", "C", "D", "E", "F"];
    const variables = {
        transport: {
            title: "Transport", values: ["Vélo", "Train", "Voiture", "Vélo", "Train", "Voiture"],
            categories: ["Voiture", "Vélo", "Train"],
            ordinalWarning: "Ces codes 0, 1 et 2 introduisent un ordre qui n'existe pas entre les moyens de transport."
        },
        niveau: {
            title: "Priorité", values: ["Faible", "Élevée", "Moyenne", "Élevée", "Faible", "Moyenne"],
            categories: ["Faible", "Moyenne", "Élevée"],
            ordinalWarning: "L'ordre faible < moyen < élevé est respecté, mais la différence entre deux niveaux n'est pas nécessairement constante."
        }
    };
    function row(cells) {
        const tr = document.createElement("tr");
        cells.forEach((cell, j) => {
            const td = document.createElement(j === 0 ? "th" : "td");
            td.textContent = cell;
            tr.appendChild(td);
        });
        return tr;
    }
    if (byId("fond-prepare-lab")) {
        const draw = () => {
            const variableName = byId("fond-cat-variable").value;
            const encoding = byId("fond-encoding").value;
            const data = variables[variableName];
            byId("fond-before-name").textContent = data.title;
            byId("fond-before-body").replaceChildren(...names.map((name, i) => row([name, data.values[i]])));
            const headers = ["Observation"];
            if (encoding === "onehot") headers.push(...data.categories.map((c) => `${data.title} : ${c}`));
            else headers.push(`${data.title} (code)`);
            const head = document.createElement("tr");
            headers.forEach((h) => {
                const th = document.createElement("th");
                th.textContent = h;
                head.appendChild(th);
            });
            byId("fond-after-head").replaceChildren(head);
            byId("fond-after-body").replaceChildren(...names.map((name, i) => {
                const index = data.categories.indexOf(data.values[i]);
                const value = encoding === "onehot"
                    ? data.categories.map((_, j) => String(Number(j === index)))
                    : [String(index)];
                return row([name, ...value]);
            }));
            byId("fond-encoding-note").textContent = encoding === "onehot"
                ? `Chaque modalité devient une colonne binaire. La variable « ${data.title} » est représentée par ${data.categories.length} colonnes.`
                : `Codage retenu : ${data.categories.map((c, i) => `${c} = ${i}`).join(" ; ")}. ${data.ordinalWarning}`;
        };
        byId("fond-cat-variable").addEventListener("change", draw);
        byId("fond-encoding").addEventListener("change", draw);
        draw();
    }
    if (byId("fond-impute-lab")) {
        const ages = [22, 35, null, 29, 40, 28];
        const known = ages.filter((v) => v !== null);
        const mean = known.reduce((sum, x) => sum + x, 0) / known.length;
        const sorted = [...known].sort((a, b) => a - b);
        const median = sorted[Math.floor(sorted.length / 2)];
        byId("fond-impute-before").replaceChildren(...names.map((name, i) =>
            row([name, ages[i] === null ? "—" : String(ages[i])])));
        const draw = () => {
            const method = byId("fond-impute-method").value;
            const imputed = method === "mean" ? mean : median;
            byId("fond-impute-after").replaceChildren(...names.map((name, i) =>
                row([name, ages[i] === null ? imputed.toFixed(1).replace(".", ",") : String(ages[i])])));
            const explanation = method === "mean"
                ? `Moyenne des cinq âges connus : (22 + 35 + 29 + 40 + 28) / 5 = 30,8. La valeur manquante est remplacée par 30,8.`
                : `Valeurs triées : 22, 28, 29, 35, 40. La médiane est 29 : la valeur manquante est remplacée par 29.`;
            byId("fond-impute-result").textContent = explanation;
        };
        byId("fond-impute-method").addEventListener("change", draw);
        draw();
    }
}());
