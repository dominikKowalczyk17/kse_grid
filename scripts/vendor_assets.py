#!/usr/bin/env python3
"""Download CDN assets into kse_grid/web/vendor/ for offline / PyInstaller use.

Run once before building the binary:
    uv run python scripts/vendor_assets.py
"""
from __future__ import annotations
import urllib.request
import sys
from pathlib import Path

VENDOR = Path(__file__).parent.parent / "kse_grid" / "web" / "vendor"

ASSETS: list[tuple[str, str]] = [
    ("plotly-2.35.2.min.js",          "https://cdn.plot.ly/plotly-2.35.2.min.js"),
    ("vue.esm-browser.prod.js",        "https://unpkg.com/vue@3.5.13/dist/vue.esm-browser.prod.js"),
    ("pixi.min.mjs",                   "https://cdn.jsdelivr.net/npm/pixi.js@8.6.6/dist/pixi.min.mjs"),
    ("rbush.mjs",                      "https://cdn.jsdelivr.net/npm/rbush@4.0.1/+esm"),
]

# Google Fonts CSS (Inter + JetBrains Mono) — fetched with a browser User-Agent
# so Google returns the WOFF2 URLs. We then download the WOFF2 files too.
FONTS_CSS_URL = (
    "https://fonts.googleapis.com/css2?"
    "family=Inter:wght@400;500;600;700"
    "&family=JetBrains+Mono:wght@400;500"
    "&display=swap"
)


def download(url: str, dest: Path) -> None:
    if dest.exists():
        print(f"  skip  {dest.name}")
        return
    print(f"  fetch {dest.name} ← {url}")
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        dest.write_bytes(resp.read())


def vendor_fonts() -> tuple[str, list[tuple[str, str]]]:
    """Download Google Fonts CSS, rewrite WOFF2 URLs to local paths, return CSS text."""
    req = urllib.request.Request(
        FONTS_CSS_URL,
        headers={"User-Agent": (
            "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
            "(KHTML, like Gecko) Chrome/120.0 Safari/537.36"
        )},
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        css: str = resp.read().decode()

    import re
    woff2_urls = re.findall(r'url\((https://[^)]+\.woff2[^)]*)\)', css)
    font_files: list[tuple[str, str]] = []
    for url in woff2_urls:
        # derive a safe filename from the URL
        name = url.split("/")[-1].split("?")[0]
        # make unique if duplicated
        dest = VENDOR / "fonts" / name
        font_files.append((str(dest.relative_to(VENDOR.parent.parent)), url))
        (VENDOR / "fonts").mkdir(exist_ok=True)
        download(url, dest)
        css = css.replace(url, f"/vendor/fonts/{name}", 1)

    return css, font_files


def main() -> None:
    VENDOR.mkdir(exist_ok=True)
    (VENDOR / "fonts").mkdir(exist_ok=True)

    for filename, url in ASSETS:
        download(url, VENDOR / filename)

    print("  fetch fonts.css ← Google Fonts")
    css, _ = vendor_fonts()
    (VENDOR / "fonts.css").write_text(css, encoding="utf-8")

    print("Done. All assets in", VENDOR)


if __name__ == "__main__":
    main()
