"""Formatter for MATPOWER (.m) files — aligns columns in `mpc.X = [ … ];` blocks.

Purpose: readability of diffs and manual inspection. Does not modify values — only
whitespace. Trailing row comments (e.g. `% bus name`) are preserved.

CLI:
    python -m kse_grid.loading.matpower_formatter FILE.m [FILE2.m ...]
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

_BLOCK_RE = re.compile(r"(mpc\.\w+\s*=\s*\[)(.*?)(\];)", re.DOTALL)
_INDENT = "    "
_COL_SEP = "  "


def format_text(text: str) -> str:
    """Return the .m file text with aligned data blocks."""

    def repl(match: re.Match) -> str:
        return _format_block(match.group(1), match.group(2), match.group(3))

    return _BLOCK_RE.sub(repl, text)


def format_file(path: Path) -> bool:
    """Format the file in-place. Returns True if the content changed."""
    original = path.read_text(encoding="utf-8")
    formatted = format_text(original)
    if formatted == original:
        return False
    path.write_text(formatted, encoding="utf-8")
    return True


def _format_block(prefix: str, body: str, suffix: str) -> str:
    parsed: list[tuple[str, list[str] | None, str]] = []
    # (terminator_or_comment_only, fields_or_None, trailing_comment)
    for line in body.split("\n"):
        stripped = line.strip()
        if not stripped:
            parsed.append(("", None, ""))
            continue
        comment = ""
        code = stripped
        if "%" in stripped:
            idx = stripped.index("%")
            code = stripped[:idx].rstrip()
            comment = stripped[idx:]
        if not code:
            parsed.append((comment, None, ""))
            continue
        terminator = ""
        if code.endswith((";", ",")):
            terminator = code[-1]
            code = code[:-1].rstrip()
        parsed.append((terminator, code.split(), comment))

    widths: list[int] = []
    for _term, fields, _cmt in parsed:
        if fields is None:
            continue
        for i, f in enumerate(fields):
            if i >= len(widths):
                widths.append(len(f))
            else:
                widths[i] = max(widths[i], len(f))

    out_lines: list[str] = [""]  # newline right after `[`
    seen_data = False
    for term, fields, comment in parsed:
        if fields is None:
            if comment:
                out_lines.append(_INDENT + comment)
                seen_data = True
            elif seen_data:
                out_lines.append("")
            continue
        cells = [f.rjust(widths[i]) for i, f in enumerate(fields)]
        line = _INDENT + _COL_SEP.join(cells) + term
        if comment:
            line += "  " + comment
        out_lines.append(line)
        seen_data = True

    # strip trailing blank lines inside the block
    while len(out_lines) > 1 and out_lines[-1].strip() == "":
        out_lines.pop()
    return prefix + "\n".join(out_lines) + "\n" + suffix


def _main(argv: list[str]) -> int:
    if not argv:
        print("usage: python -m kse_grid.loading.matpower_formatter FILE.m [...]", file=sys.stderr)
        return 2
    changed = 0
    for arg in argv:
        path = Path(arg)
        if not path.is_file():
            print(f"skipped (file not found): {path}", file=sys.stderr)
            continue
        if format_file(path):
            print(f"formatted: {path}")
            changed += 1
        else:
            print(f"unchanged: {path}")
    return 0 if changed >= 0 else 1


if __name__ == "__main__":
    sys.exit(_main(sys.argv[1:]))
