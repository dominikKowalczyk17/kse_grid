"""Convert a TAMU PowerWorld `.EPC` file into a GeoJSON sidecar with bus
coordinates (WGS84) for the matching MATPOWER `.m` case.

Usage:
    uv run python -m kse_grid.convert_tamu_geo <case.EPC> [--out <case.geojson>]

The EPC file contains a `substation data` section with lat/lon and a
`bus data` section that references a substation id per bus. We resolve each
bus to its substation centre and emit one GeoJSON Point feature per bus.
"""

from __future__ import annotations

import argparse
import json
import re
import shlex
from pathlib import Path
from typing import Iterator


SECTION_RE = re.compile(r"^([a-zA-Z_]+(?:\s+[a-zA-Z_]+)*)\s+data\s+\[\s*\d+\s*\]")


def _iter_sections(text: str) -> Iterator[tuple[str, list[str]]]:
    current: str | None = None
    rows: list[str] = []
    for raw in text.splitlines():
        line = raw.rstrip()
        if not line:
            continue
        m = SECTION_RE.match(line)
        if m:
            if current is not None:
                yield current, rows
            current = m.group(1).strip().lower()
            rows = []
            continue
        if line.strip().lower() in {"end", "injgroup data  [  0]"}:
            if current is not None:
                yield current, rows
                current, rows = None, []
            continue
        if current is not None:
            rows.append(line)
    if current is not None:
        yield current, rows


def _parse_substations(rows: list[str]) -> dict[int, dict]:
    subs: dict[int, dict] = {}
    for row in rows:
        try:
            tokens = shlex.split(row, posix=True)
        except ValueError:
            continue
        if len(tokens) < 5:
            continue
        try:
            sid = int(tokens[0])
            name = tokens[1]
            # tokens[2] is ':'
            lat = float(tokens[3])
            lon = float(tokens[4])
        except (ValueError, IndexError):
            continue
        if lat == 0.0 and lon == 0.0:
            continue
        subs[sid] = {"name": name, "lat": lat, "lon": lon}
    return subs


def _parse_buses(rows: list[str]) -> list[dict]:
    """Each bus row ends with: ... <subst_id> "<station name>" <area> <zone> "" <flag> ""."""
    buses: list[dict] = []
    for row in rows:
        try:
            tokens = shlex.split(row, posix=True)
        except ValueError:
            continue
        if len(tokens) < 8:
            continue
        try:
            bus_id = int(tokens[0])
        except ValueError:
            continue
        # Walk from the end to find subst_id: it precedes the station-name
        # string (a quoted token containing letters or whose token index is
        # at len-6 in the tail "[subst_id] [name] [area] [zone] [\"\"] [flag] [\"\"]").
        subst_id: int | None = None
        station: str | None = None
        # Tail layout (zero-based from end): -1 "", -2 flag, -3 "", -4 zone, -5 area, -6 station, -7 subst_id
        if len(tokens) >= 7:
            try:
                subst_id = int(tokens[-7])
                station = tokens[-6]
            except (ValueError, IndexError):
                subst_id = None
        if subst_id is None:
            continue
        buses.append({"bus": bus_id, "subst": subst_id, "station": station})
    return buses


def convert(epc_path: Path, out_path: Path) -> dict:
    text = epc_path.read_text(encoding="latin-1", errors="replace")
    subs: dict[int, dict] = {}
    buses: list[dict] = []
    for name, rows in _iter_sections(text):
        if name == "substation":
            subs = _parse_substations(rows)
        elif name == "bus":
            buses = _parse_buses(rows)

    if not subs:
        raise RuntimeError("No substations parsed from EPC file")
    if not buses:
        raise RuntimeError("No buses parsed from EPC file")

    features = []
    matched = 0
    for bus in buses:
        sub = subs.get(bus["subst"])
        if sub is None:
            continue
        matched += 1
        features.append(
            {
                "type": "Feature",
                "geometry": {
                    "type": "Point",
                    "coordinates": [sub["lon"], sub["lat"]],
                },
                "properties": {
                    "bus": bus["bus"],
                    "subst_id": bus["subst"],
                    "station": sub["name"],
                },
            }
        )

    fc = {
        "type": "FeatureCollection",
        "name": epc_path.stem,
        "crs": {"type": "name", "properties": {"name": "EPSG:4326"}},
        "features": features,
    }
    out_path.write_text(json.dumps(fc), encoding="utf-8")
    return {"buses": len(buses), "substations": len(subs), "matched": matched, "out": str(out_path)}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("epc", type=Path, help="Path to TAMU .EPC file")
    parser.add_argument("--out", type=Path, default=None, help="Output GeoJSON path (default: <stem>.geojson next to .m)")
    args = parser.parse_args()

    out = args.out or args.epc.with_suffix(".geojson")
    stats = convert(args.epc, out)
    print(
        f"✅ Wrote {stats['out']}\n"
        f"   substations: {stats['substations']}, buses: {stats['buses']}, matched: {stats['matched']}"
    )


if __name__ == "__main__":
    main()
