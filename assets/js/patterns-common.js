"use strict";
// Jeux de données et algorithmes pédagogiques de fouille de motifs.
// Aucun appel réseau : les mêmes données restent disponibles hors ligne.
window.Patterns = (function () {
    const items = ["Pain", "Beurre", "Lait", "Œufs", "Confiture"];
    const baskets = [
        ["Pain", "Beurre", "Lait"],
        ["Pain", "Beurre"],
        ["Pain", "Beurre", "Confiture"],
        ["Pain", "Lait"],
        ["Pain", "Beurre", "Œufs"],
        ["Lait", "Œufs"],
        ["Pain", "Beurre"],
        ["Pain", "Beurre", "Confiture"],
        ["Lait", "Œufs"],
        ["Pain", "Beurre", "Confiture"],
        ["Pain", "Beurre"],
        ["Lait", "Œufs"]
    ];
    const alphabet = ["A", "B", "C", "D"];
    // Une lettre correspond ici à un événement (non à un itemset).
    const sequences = [
        ["A", "B", "C", "D"],
        ["A", "C", "B", "D"],
        ["B", "A", "C", "D"],
        ["A", "B", "D"],
        ["A", "C", "D"],
        ["B", "C", "A", "D"],
        ["A", "B", "C"],
        ["C", "A", "B", "D"]
    ];
    function key(a) { return a.join("|"); }
    function compareKeys(a, b) {
        return a.length - b.length || key(a).localeCompare(key(b), "fr");
    }
    function subsets(a, size) {
        const results = [];
        function visit(start, current) {
            if (current.length === size) {
                results.push(current.slice());
                return;
            }
            for (let i = start; i <= a.length - (size - current.length); i++) {
                current.push(a[i]);
                visit(i + 1, current);
                current.pop();
            }
        }
        visit(0, []);
        return results;
    }
    function supportItemset(pattern) {
        return baskets.reduce((n, tx) =>
            n + Number(pattern.every(item => tx.includes(item))), 0);
    }
    function ruleMetrics(left, right) {
        if (!left.length || !right.length ||
            left.some(item => right.includes(item))) return null;
        const union = [...new Set([...left, ...right])];
        const both = supportItemset(union);
        const leftN = supportItemset(left);
        const rightN = supportItemset(right);
        const n = baskets.length;
        return {
            both, leftN, rightN,
            support: both / n,
            confidence: leftN ? both / leftN : 0,
            lift: leftN && rightN ? both * n / (leftN * rightN) : 0
        };
    }
    // Apriori : génération par jointure et élagage de toutes les parties
    // (k - 1)-fréquentes, puis comptage des candidats retenus.
    function apriori(minCount) {
        let frequent = [];
        const levels = [];
        const allFrequent = [];
        let k = 1;
        while (k <= items.length) {
            let candidates;
            let pruned = 0;
            if (k === 1) {
                candidates = items.map(item => [item]);
            } else {
                const seen = new Set();
                const previous = new Set(frequent.map(row => key(row.items)));
                candidates = [];
                for (let i = 0; i < frequent.length; i++) {
                    for (let j = i + 1; j < frequent.length; j++) {
                        const joined = [...new Set([
                            ...frequent[i].items, ...frequent[j].items
                        ])].sort((a, b) => items.indexOf(a) - items.indexOf(b));
                        if (joined.length !== k || seen.has(key(joined))) continue;
                        seen.add(key(joined));
                        const valid = subsets(joined, k - 1)
                            .every(part => previous.has(key(part)));
                        if (valid) candidates.push(joined);
                        else pruned++;
                    }
                }
            }
            if (!candidates.length) break;
            const rows = candidates.map(candidate => ({
                items: candidate,
                count: supportItemset(candidate),
                frequent: supportItemset(candidate) >= minCount
            })).sort((a, b) => b.count - a.count ||
                key(a.items).localeCompare(key(b.items), "fr"));
            levels.push({ phase: "candidates", k, rows, pruned });
            frequent = rows.filter(row => row.frequent);
            levels.push({ phase: "frequent", k, rows: frequent.slice(), pruned });
            allFrequent.push(...frequent);
            if (!frequent.length) break;
            k++;
        }
        return {levels, allFrequent};
    }
    function rules(frequentSets) {
        const output = [];
        for (const row of frequentSets) {
            if (row.items.length < 2) continue;
            for (let n = 1; n < row.items.length; n++) {
                for (const left of subsets(row.items, n)) {
                    const right = row.items.filter(item => !left.includes(item));
                    const m = ruleMetrics(left, right);
                    output.push({left, right, ...m});
                }
            }
        }
        return output.sort((a, b) =>
            b.confidence - a.confidence || b.lift - a.lift ||
            key(a.left).localeCompare(key(b.left), "fr"));
    }
    // Recherche gloutonne des indices d'une sous-séquence : autorise les
    // événements intermédiaires, préserve strictement l'ordre.
    function matchIndices(pattern, sequence) {
        if (!pattern.length) return [];
        const indices = [];
        let j = 0;
        for (let i = 0; i < sequence.length && j < pattern.length; i++) {
            if (sequence[i] === pattern[j]) {
                indices.push(i);
                j++;
            }
        }
        return j === pattern.length ? indices : null;
    }
    function supportSequence(pattern) {
        return sequences.reduce((n, seq) =>
            n + Number(matchIndices(pattern, seq) !== null), 0);
    }
    // Démonstration GSP simplifiée : un événement par position, aucun
    // intervalle temporel, longueur au plus 3 et élagage par sous-séquences.
    function gsp(minCount, maxLength = 3) {
        const levels = [];
        let previous = [];
        for (let k = 1; k <= maxLength; k++) {
            const seen = new Set();
            let candidates = [];
            let pruned = 0;
            if (k === 1) {
                candidates = alphabet.map(symbol => [symbol]);
            } else {
                const prevKeys = new Set(previous.map(row => key(row.items)));
                for (const a of previous) {
                    for (const b of previous) {
                        if (key(a.items.slice(1)) !== key(b.items.slice(0, -1))) {
                            continue;
                        }
                        const joined = [...a.items, b.items.at(-1)];
                        const id = key(joined);
                        if (seen.has(id)) continue;
                        seen.add(id);
                        const valid = Array.from({length: k}, (_, i) =>
                            joined.filter((_, j) => i !== j))
                            .every(sub => prevKeys.has(key(sub)));
                        if (valid) candidates.push(joined);
                        else pruned++;
                    }
                }
            }
            if (!candidates.length) break;
            const rows = candidates.map(candidate => ({
                items: candidate,
                count: supportSequence(candidate),
                frequent: supportSequence(candidate) >= minCount
            })).sort((a, b) => b.count - a.count ||
                key(a.items).localeCompare(key(b.items), "fr"));
            levels.push({phase: "candidates", k, rows, pruned});
            previous = rows.filter(row => row.frequent);
            levels.push({phase: "frequent", k, rows: previous.slice(), pruned});
            if (!previous.length) break;
        }
        return levels;
    }
    function percent(fraction, decimals = 0) {
        return (100 * fraction).toLocaleString("fr-FR", {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals
        }) + " %";
    }
    return {
        items, baskets, alphabet, sequences, supportItemset,
        ruleMetrics, apriori, rules, matchIndices, supportSequence,
        gsp, percent
    };
}());
