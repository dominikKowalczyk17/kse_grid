"""Verify vendor assets are present and index.html has no CDN URLs."""
from __future__ import annotations

import re
from pathlib import Path

VENDOR = Path(__file__).parent.parent / "kse_grid" / "web" / "vendor"
INDEX = Path(__file__).parent.parent / "kse_grid" / "web" / "index.html"

CDN_PATTERNS = [
    r"cdn\.plot\.ly",
    r"cdn\.jsdelivr\.net",
    r"unpkg\.com",
    r"fonts\.googleapis\.com",
    r"fonts\.gstatic\.com",
]

REQUIRED_VENDOR_FILES = [
    "plotly-2.35.2.min.js",
    "vue.esm-browser.prod.js",
    "pixi.min.mjs",
    "rbush.mjs",
    "fonts.css",
    "naive-ui.prod.mjs",
    "highlight.min.js",
    "hljs-dark.min.css",
    "hljs-light.min.css",
]


def test_vendor_files_present():
    missing = [f for f in REQUIRED_VENDOR_FILES if not (VENDOR / f).exists()]
    assert not missing, f"Missing vendor files: {missing}"


def test_index_html_has_no_cdn_urls():
    content = INDEX.read_text(encoding="utf-8")
    matches = []
    for pattern in CDN_PATTERNS:
        if re.search(pattern, content):
            matches.append(pattern)
    assert not matches, f"CDN URLs still in index.html: {matches}"


def test_vendor_fonts_css_references_local_paths():
    fonts_css = (VENDOR / "fonts.css").read_text(encoding="utf-8")
    # No external URLs should remain in the vendored CSS
    assert "fonts.googleapis.com" not in fonts_css
    assert "fonts.gstatic.com" not in fonts_css
