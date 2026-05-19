"""Konwerter KSE_2019.kmz -> wbudowane GeoJSON-y warstwy referencyjnej.

Wyciąga z atlasu KSE 2019 (OpenInfraMap / OSM):
- stacje (Point) z kategorią po hierarchii folderów,
- linie (LineString) z kategorią po hierarchii folderów.

Kategorie:
- "osp" - sieć przesyłowa (PSE / NN, 220-400 kV),
- "osd" - sieć dystrybucyjna 110 kV (OSD: PGE, Tauron, Enea, Energa, RWE),
- "jw"  - linie blokowe / JW (elektrownie, farmy wiatrowe).

Generuje dwa pliki w `kse_grid/web/`:
- kse_atlas_points.geojson
- kse_atlas_lines.geojson
"""

from __future__ import annotations

import argparse
import json
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path

KML_NS = {"kml": "http://www.opengis.net/kml/2.2"}
_TOP_CATEGORIES = {"OSP": "osp", "OSD": "osd", "JW": "jw"}


def _classify(folder_path: list[str]) -> str | None:
    for top in folder_path:
        cat = _TOP_CATEGORIES.get(top.strip())
        if cat:
            return cat
    return None


def _parse_coords(text: str) -> list[list[float]]:
    coords = []
    for token in text.strip().split():
        parts = token.split(",")
        if len(parts) < 2:
            continue
        try:
            lon = float(parts[0])
            lat = float(parts[1])
        except ValueError:
            continue
        coords.append([lon, lat])
    return coords


def _walk(node, path: list[str], points: list, lines: list) -> None:
    name_el = node.find("kml:name", KML_NS)
    own_name = name_el.text.strip() if name_el is not None and name_el.text else ""

    for child in node.findall("kml:Placemark", KML_NS):
        category = _classify(path)
        if category is None:
            continue
        pm_name_el = child.find("kml:name", KML_NS)
        pm_name = pm_name_el.text.strip() if pm_name_el is not None and pm_name_el.text else ""

        point = child.find("kml:Point", KML_NS)
        if point is not None:
            coords_el = point.find("kml:coordinates", KML_NS)
            if coords_el is not None and coords_el.text:
                coords = _parse_coords(coords_el.text)
                if coords:
                    points.append({
                        "type": "Feature",
                        "geometry": {"type": "Point", "coordinates": coords[0][:2]},
                        "properties": {"name": pm_name, "category": category},
                    })
            continue

        line = child.find("kml:LineString", KML_NS)
        if line is not None:
            coords_el = line.find("kml:coordinates", KML_NS)
            if coords_el is not None and coords_el.text:
                coords = _parse_coords(coords_el.text)
                if len(coords) >= 2:
                    lines.append({
                        "type": "Feature",
                        "geometry": {"type": "LineString", "coordinates": coords},
                        "properties": {"name": pm_name, "category": category},
                    })

    next_path = path + [own_name] if own_name else path
    for sub in node.findall("kml:Folder", KML_NS):
        _walk(sub, next_path, points, lines)
    for sub in node.findall("kml:Document", KML_NS):
        _walk(sub, next_path, points, lines)


def convert(kmz_path: Path, out_dir: Path) -> tuple[int, int]:
    with zipfile.ZipFile(kmz_path) as zf:
        kml_name = next(n for n in zf.namelist() if n.lower().endswith(".kml"))
        text = zf.read(kml_name).decode("utf-8")

    root = ET.fromstring(text)
    points: list = []
    lines: list = []
    _walk(root, [], points, lines)

    out_dir.mkdir(parents=True, exist_ok=True)
    points_path = out_dir / "kse_atlas_points.geojson"
    lines_path = out_dir / "kse_atlas_lines.geojson"

    points_path.write_text(json.dumps({
        "type": "FeatureCollection",
        "name": "KSE 2019 atlas - stations",
        "crs": {"type": "name", "properties": {"name": "EPSG:4326"}},
        "features": points,
    }, ensure_ascii=False), encoding="utf-8")

    lines_path.write_text(json.dumps({
        "type": "FeatureCollection",
        "name": "KSE 2019 atlas - lines",
        "crs": {"type": "name", "properties": {"name": "EPSG:4326"}},
        "features": lines,
    }, ensure_ascii=False), encoding="utf-8")

    return len(points), len(lines)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("kmz", type=Path, help="Ścieżka do KSE_2019.kmz")
    parser.add_argument(
        "--out-dir", type=Path,
        default=Path(__file__).parent / "web",
        help="Katalog docelowy (domyślnie kse_grid/web/)",
    )
    args = parser.parse_args()
    n_points, n_lines = convert(args.kmz, args.out_dir)
    print(f"Wrote {n_points} points and {n_lines} lines to {args.out_dir}")


if __name__ == "__main__":
    main()
