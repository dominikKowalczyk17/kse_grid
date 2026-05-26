"""Obsługa pozycji geograficznych szyn i widoku mapowego."""

from __future__ import annotations

import json
import math
from typing import Any

import pandapower as pp

from kse_grid.type_coercion import safe_float as _safe_float
from kse_grid.type_coercion import to_int as _to_int


def extract_geo_positions(net: pp.pandapowerNet) -> dict[int, tuple[float, float]]:
    positions: dict[int, tuple[float, float]] = {}
    _read_bus_geodata(net, positions)
    _read_geojson_column(net, positions)
    return positions


def compute_geo_view(positions: dict[int, tuple[float, float]]) -> dict[str, Any]:
    lons = [lon for lon, _ in positions.values()]
    lats = [lat for _, lat in positions.values()]
    west, east = min(lons), max(lons)
    south, north = min(lats), max(lats)
    zoom = _estimate_map_zoom(west, east, south, north)
    return {
        "center": {"lon": (west + east) / 2.0, "lat": (south + north) / 2.0},
        "bounds": {"lon": [west, east], "lat": [south, north]},
        "zoom": zoom,
        "focusZoom": min(zoom + 2.0, 12.5),
    }


def haversine_km(a: tuple[float, float], b: tuple[float, float]) -> float:
    lon1, lat1 = a
    lon2, lat2 = b
    r = 6371.0088
    p1 = math.radians(lat1)
    p2 = math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    h = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(min(1.0, math.sqrt(h)))


def _read_bus_geodata(net: pp.pandapowerNet, positions: dict[int, tuple[float, float]]) -> None:
    if not (hasattr(net, "bus_geodata") and not net.bus_geodata.empty):
        return
    for bus_idx, row in net.bus_geodata.iterrows():
        x = _safe_float(row.get("x"))
        y = _safe_float(row.get("y"))
        if x is not None and y is not None:
            positions[_to_int(bus_idx)] = (x, y)


def _read_geojson_column(net: pp.pandapowerNet, positions: dict[int, tuple[float, float]]) -> None:
    if "geo" not in net.bus.columns:
        return
    for bus_idx, row in net.bus.iterrows():
        raw = row.get("geo")
        if raw in (None, ""):
            continue
        try:
            data = json.loads(raw) if isinstance(raw, str) else raw
        except json.JSONDecodeError:
            continue
        if not isinstance(data, dict) or data.get("type") != "Point":
            continue
        coords = data.get("coordinates")
        if not isinstance(coords, list) or len(coords) < 2:
            continue
        lon = _safe_float(coords[0])
        lat = _safe_float(coords[1])
        if lon is not None and lat is not None:
            positions[_to_int(bus_idx)] = (lon, lat)


def _estimate_map_zoom(west: float, east: float, south: float, north: float) -> float:
    span = max(abs(east - west), abs(north - south))
    if span <= 0.02:
        return 12.0
    if span <= 0.05:
        return 11.0
    if span <= 0.10:
        return 10.0
    if span <= 0.25:
        return 9.0
    if span <= 0.50:
        return 8.0
    if span <= 1.00:
        return 7.0
    if span <= 2.00:
        return 6.0
    if span <= 4.00:
        return 5.0
    if span <= 8.00:
        return 4.5
    if span <= 12.00:
        return 5.0
    return 3.0
