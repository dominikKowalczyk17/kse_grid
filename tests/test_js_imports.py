"""Verify the JS module import graph is fully resolvable without network access.

A bare specifier (e.g. 'vue', 'highlight.js') must appear in the importmap.
If it doesn't, the browser will try to fetch it from the server and get a 404.
This is exactly what broke the app when naive-ui.prod.mjs imported 'seemly',
'vooks', etc. that weren't mapped anywhere.
"""
from __future__ import annotations

import json
import re
from pathlib import Path

WEB = Path(__file__).parent.parent / "kse_grid" / "web"
INDEX = WEB / "index.html"

# Matches bare specifiers: import ... from 'foo' or import('foo')
# Bare = does not start with '.', '/', or 'http'
_IMPORT_RE = re.compile(
    r"""(?:import\s+(?:[^'"]*?\s+from\s+)?|export\s+(?:[^'"]*?\s+from\s+)?)['"]([^'"]+)['"]""",
    re.DOTALL,
)


def _bare_imports(text: str) -> set[str]:
    """Return all bare specifier imports found in JS/MJS source text."""
    found = set()
    for m in _IMPORT_RE.finditer(text):
        spec = m.group(1)
        if not spec.startswith((".", "/", "http")):
            found.add(spec)
    return found


def _importmap() -> dict[str, str]:
    content = INDEX.read_text(encoding="utf-8")
    m = re.search(r'<script\s+type="importmap">(.*?)</script>', content, re.DOTALL)
    assert m, "No importmap found in index.html"
    return json.loads(m.group(1))["imports"]


def test_importmap_entries_point_to_existing_files():
    """Every importmap entry must resolve to a vendor file that actually exists."""
    importmap = _importmap()
    missing = [
        f"{name!r} -> {path!r}"
        for name, path in importmap.items()
        if not (WEB / path.lstrip("/")).exists()
    ]
    assert not missing, "Importmap entries pointing to missing files:\n" + "\n".join(missing)


def test_vendor_files_have_no_unresolved_bare_imports():
    """Vendor JS/MJS files must not contain bare specifier imports outside the importmap.

    This is the test that would have caught the naive-ui issue: naive-ui.prod.mjs
    imported 'seemly', 'vooks', 'evtd', etc. — none of which were in the importmap,
    so the browser fetched them from the server and got 404 for each one.
    """
    importmap = _importmap()
    known = set(importmap.keys())
    issues: list[str] = []

    for vendor_file in sorted((WEB / "vendor").glob("*.mjs")):
        text = vendor_file.read_text(encoding="utf-8", errors="replace")
        unknown = _bare_imports(text) - known
        if unknown:
            issues.append(f"  {vendor_file.name}: unresolved imports {sorted(unknown)}")

    assert not issues, (
        "Vendor files import bare specifiers not in the importmap "
        "(browser will 404 on these):\n" + "\n".join(issues)
    )


def test_app_js_files_have_no_unresolved_bare_imports():
    """App JS files must only use bare specifiers that are in the importmap."""
    importmap = _importmap()
    known = set(importmap.keys())
    issues: list[str] = []

    for js_file in sorted(WEB.rglob("*.js")):
        if "vendor" in js_file.parts:
            continue
        text = js_file.read_text(encoding="utf-8", errors="replace")
        unknown = _bare_imports(text) - known
        if unknown:
            issues.append(
                f"  {js_file.relative_to(WEB)}: unresolved imports {sorted(unknown)}"
            )

    assert not issues, (
        "App JS files import bare specifiers not in the importmap "
        "(browser will 404 on these):\n" + "\n".join(issues)
    )


def test_static_assets_referenced_in_index_html_exist():
    """Every CSS/JS src/href in index.html must point to a file that exists."""
    content = INDEX.read_text(encoding="utf-8")
    refs = re.findall(r'(?:src|href)="(/[^"]+)"', content)
    missing = [ref for ref in refs if not (WEB / ref.lstrip("/")).exists()]
    assert not missing, f"index.html references missing files: {missing}"
