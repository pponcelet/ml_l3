#!/usr/bin/env python3
"""Prepare pinned browser assets and UMAP coordinates for static GitHub Pages.

Run once before publishing, or automatically through GitHub Actions.
The published site needs no Python process or backend.
"""
import argparse
import json
import pathlib
import re
import sys
import urllib.request

import numpy as np

ROOT = pathlib.Path(__file__).resolve().parents[1]
DATA_PATH = ROOT / "assets" / "js" / "manifold-data.js"
D3_PATH = ROOT / "assets" / "vendor" / "d3.v7.min.js"
D3_URL = "https://cdn.jsdelivr.net/npm/d3@7.9.0/dist/d3.min.js"


def download_d3():
    D3_PATH.parent.mkdir(parents=True, exist_ok=True)
    if D3_PATH.exists() and D3_PATH.stat().st_size > 200_000:
        print("D3 local déjà présent")
        return
    print("Téléchargement de D3 v7.9.0...")
    req = urllib.request.Request(D3_URL,
        headers={"User-Agent": "ml-course-static-build/1.0"})
    with urllib.request.urlopen(req, timeout=30) as response:
        content = response.read()
    # Fails closed instead of leaving an HTML error file in the site.
    if len(content) < 200_000 or b"function" not in content[:1000]:
        raise RuntimeError("La ressource D3 téléchargée est invalide")
    D3_PATH.write_bytes(content)
    print("D3 installé :", D3_PATH.relative_to(ROOT))


def read_data():
    raw = DATA_PATH.read_text(encoding="utf-8")
    match = re.fullmatch(
        r'\s*"use strict";\s*window\.MANIFOLD_DATA\s*=\s*(\{.*\});\s*',
        raw, flags=re.DOTALL)
    if not match:
        raise RuntimeError("Format inattendu dans manifold-data.js")
    return json.loads(match.group(1))


def normalise_2d(coords):
    a = np.asarray(coords, dtype=float)
    if a.ndim != 2 or a.shape[1] != 2 or not np.isfinite(a).all():
        raise ValueError("Coordonnées UMAP invalides")
    a -= a.mean(axis=0, keepdims=True)
    # Preserve aspect ratio: never scale axes independently.
    scale = max(float(np.max(np.abs(a))), 1e-8)
    a = a / scale * 0.94
    return [[round(float(x), 4), round(float(y), 4)] for x, y in a]


def regenerate_umap():
    import umap

    content = read_data()
    total = 0
    for dataset_name, dataset in content.items():
        points = np.asarray(dataset["points"], dtype=np.float32)
        if points.ndim != 2 or points.shape[1] != 3:
            raise ValueError("Données initiales invalides : " + dataset_name)
        umap_coords = {}
        for neighbors in (8, 16, 30):
            for min_dist in (0.1, 0.5):
                model = umap.UMAP(
                    n_components=2,
                    n_neighbors=neighbors,
                    min_dist=min_dist,
                    metric="euclidean",
                    random_state=42,
                    n_jobs=1,
                )
                embedded = model.fit_transform(points)
                key = "%d-%.1f" % (neighbors, min_dist)
                umap_coords[key] = normalise_2d(embedded)
                total += 1
                print("UMAP", dataset_name, key, "->", len(embedded), "points")
        dataset["umap"] = umap_coords
        dataset["umap_reference"] = True
    output = ("\"use strict\";\nwindow.MANIFOLD_DATA = " +
              json.dumps(content, ensure_ascii=False, separators=(",", ":")) +
              ";\n")
    DATA_PATH.write_text(output, encoding="utf-8")
    print("Données UMAP de référence générées :", total, "plongements")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--d3-only", action="store_true",
        help="ne télécharge que D3 (pour tester la publication)")
    parser.add_argument("--umap-only", action="store_true",
        help="ne recalcule que les plongements UMAP")
    args = parser.parse_args()
    if not args.umap_only:
        download_d3()
    if not args.d3_only:
        regenerate_umap()
    return 0


if __name__ == "__main__":
    sys.exit(main())
