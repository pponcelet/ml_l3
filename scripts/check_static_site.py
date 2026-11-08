#!/usr/bin/env python3
"""Lightweight checks for a static HTML site deployed under a GitHub Pages prefix."""
import argparse
import json
import pathlib
import re
import sys
from html.parser import HTMLParser

ROOT = pathlib.Path(__file__).resolve().parents[1]


class Refs(HTMLParser):
    def __init__(self):
        super().__init__()
        self.refs = []

    def handle_starttag(self, tag, attrs):
        for key, value in attrs:
            if key in ("href", "src") and value:
                self.refs.append(value)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--require-prebuilt", action="store_true")
    args = parser.parse_args()
    errors = []
    for doc in ROOT.rglob("*.html"):
        refs = Refs()
        refs.feed(doc.read_text(encoding="utf-8"))
        for ref in refs.refs:
            if ref.startswith(("http://", "https://", "#", "mailto:", "data:")):
                continue
            file_path = (doc.parent / ref.split("#")[0].split("?")[0]).resolve()
            if not file_path.is_relative_to(ROOT.resolve()):
                errors.append("Lien sort du dépôt : " + str(doc) + " : " + ref)
            elif not file_path.exists() and (args.require_prebuilt or "assets/vendor" not in str(file_path)):
                errors.append("Lien manquant : " + str(doc) + " : " + ref)
    if args.require_prebuilt:
        path = ROOT / "assets/js/manifold-data.js"
        data_text = path.read_text(encoding="utf-8")
        data = json.loads(data_text.split("window.MANIFOLD_DATA =",1)[1].strip().rstrip(";"))
        for name, row in data.items():
            if not row.get("umap_reference"):
                errors.append("UMAP non généré : " + name)
            for coords in row["umap"].values():
                if len(coords) != len(row["points"]):
                    errors.append("UMAP nombre de points incohérent : " + name)
    for err in errors:
        print("ERREUR:", err)
    print("Contrôle terminé :", "OK" if not errors else "%d erreur(s)" % len(errors))
    return int(bool(errors))

if __name__ == "__main__":
    sys.exit(main())
