"""Build a high-accuracy GeoJSON sidecar for a TAMU MATPOWER case by
fuzzy-matching station names against a KSE KMZ atlas (e.g. KSE_2019.kmz).

Inputs:
  --epc   PowerWorld .EPC from the TAMU pack (provides bus -> substation
          name mapping). Required.main
  --kmz   KMZ archive containing Placemarks with <Point> coordinates and
          Polish substation names. Required.
  --out   Output GeoJSON sidecar path. Required.

Strategy:
  1. Parse KMZ -> {normalized_name: (lon, lat, raw_name)} catalogue.
  2. Parse EPC bus and substation tables (re-using convert_tamu_geo).
  3. For every bus, look up its substation name in the KMZ catalogue;
     if a confident match is found, use the KMZ coordinates, otherwise
     fall back to the EPC substation centre.
  4. Write GeoJSON FeatureCollection (one Point per matched bus).
"""

from __future__ import annotations

import argparse
import difflib
import json
import re
import unicodedata
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET

from kse_grid.convert_tamu_geo import _iter_sections, _parse_buses, _parse_substations


KML_NS = {"kml": "http://www.opengis.net/kml/2.2"}

NOISE_TOKENS = {
    "stacja", "rpz", "gpz", "sub", "near", "elektrownia", "ec", "ez", "ee",
    "proj", "north", "south", "east", "west", "left", "right", "top", "bottom",
    "of", "&", "and", "the",
}


def _strip_diacritics(s: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFKD", s) if not unicodedata.combining(c))


_NUM_PREFIX = re.compile(r"^\s*\d+\s+[A-Z]{2,4}\s+")  # e.g. "1 BEK ", "12 OST "
_TAIL_CODE = re.compile(r"\s+[A-Z]{2,4}$")  # e.g. "Belchatow RO", "Kozienice KO"
_TOKEN_RE = re.compile(r"[a-z0-9]+")


def normalize_name(name: str) -> str:
    raw = name.strip()
    raw = _NUM_PREFIX.sub("", raw)
    raw = _TAIL_CODE.sub("", raw)
    raw = _strip_diacritics(raw).lower()
    tokens = [t for t in _TOKEN_RE.findall(raw) if t not in NOISE_TOKENS and not t.isdigit()]
    return " ".join(tokens)


def parse_kmz(kmz_path: Path) -> dict[str, tuple[float, float, str]]:
    with zipfile.ZipFile(kmz_path) as zf:
        kml_name = next(n for n in zf.namelist() if n.lower().endswith(".kml"))
        with zf.open(kml_name) as fh:
            tree = ET.parse(fh)
    root = tree.getroot()
    catalogue: dict[str, tuple[float, float, str]] = {}
    for placemark in root.iter(f"{{{KML_NS['kml']}}}Placemark"):
        name_el = placemark.find("kml:name", KML_NS)
        point = placemark.find("kml:Point", KML_NS)
        if name_el is None or point is None or not name_el.text:
            continue
        coord_el = point.find("kml:coordinates", KML_NS)
        if coord_el is None or not coord_el.text:
            continue
        try:
            lon_s, lat_s, *_ = coord_el.text.strip().split(",")
            lon, lat = float(lon_s), float(lat_s)
        except (ValueError, IndexError):
            continue
        raw_name = name_el.text.strip()
        if raw_name.lower().startswith("proj"):  # proposed/planned, less reliable
            continue
        key = normalize_name(raw_name)
        if not key:
            continue
        # keep first occurrence
        catalogue.setdefault(key, (lon, lat, raw_name))
    return catalogue


def best_match(query: str, catalogue: dict[str, tuple[float, float, str]], cutoff: float = 0.86):
    if not query:
        return None
    if query in catalogue:
        return catalogue[query], query, 1.0
    keys = list(catalogue.keys())
    matches = difflib.get_close_matches(query, keys, n=1, cutoff=cutoff)
    if matches:
        m = matches[0]
        ratio = difflib.SequenceMatcher(None, query, m).ratio()
        return catalogue[m], m, ratio
    # token-overlap fallback for short queries
    q_tokens = set(query.split())
    if len(q_tokens) >= 1:
        best_key, best_overlap = None, 0.0
        for k in keys:
            k_tokens = set(k.split())
            if not k_tokens:
                continue
            overlap = len(q_tokens & k_tokens) / max(len(q_tokens | k_tokens), 1)
            if overlap > best_overlap:
                best_overlap, best_key = overlap, k
        if best_key and best_overlap >= 0.5:
            return catalogue[best_key], best_key, best_overlap
    return None


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--epc", type=Path, required=True)
    parser.add_argument("--kmz", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--cutoff", type=float, default=0.86,
                        help="difflib cutoff for fuzzy name matching (default 0.86)")
    args = parser.parse_args()

    catalogue = parse_kmz(args.kmz)
    print(f"📚 KMZ catalogue: {len(catalogue)} unique substations")

    text = args.epc.read_text(encoding="latin-1", errors="replace")
    subs: dict[int, dict] = {}
    buses: list[dict] = []
    for name, rows in _iter_sections(text):
        if name == "substation":
            subs = _parse_substations(rows)
        elif name == "bus":
            buses = _parse_buses(rows)
    print(f"📐 EPC: {len(subs)} substations w/ EPC geo, {len(buses)} buses")

    features = []
    matched_kmz = 0
    matched_epc_only = 0
    unmatched = 0
    for bus in buses:
        sub = subs.get(bus["subst"])
        station = bus.get("station") or (sub or {}).get("name")
        kmz_hit = best_match(normalize_name(station or ""), catalogue, cutoff=args.cutoff)

        if kmz_hit is not None:
            (lon, lat, raw), key, score = kmz_hit
            source = "kmz"
            matched_kmz += 1
        elif sub is not None:
            lon, lat, raw, score = sub["lon"], sub["lat"], sub["name"], 1.0
            source = "epc"
            matched_epc_only += 1
        else:
            unmatched += 1
            continue

        features.append({
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [lon, lat]},
            "properties": {
                "bus": bus["bus"],
                "subst_id": bus["subst"],
                "station": station,
                "matched_name": raw,
                "match_score": round(float(score), 3),
                "source": source,
            },
        })

    fc = {
        "type": "FeatureCollection",
        "name": args.epc.stem,
        "crs": {"type": "name", "properties": {"name": "EPSG:4326"}},
        "features": features,
    }
    args.out.write_text(json.dumps(fc), encoding="utf-8")
    print(
        f"✅ Wrote {args.out}\n"
        f"   buses with KMZ-quality coords: {matched_kmz}\n"
        f"   buses with EPC fallback coords: {matched_epc_only}\n"
        f"   buses without any geo: {unmatched}\n"
        f"   total features: {len(features)}"
    )


if __name__ == "__main__":
    main()
