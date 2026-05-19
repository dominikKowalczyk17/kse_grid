"""Ładowanie sidecarów GeoJSON z lokalizacjami geograficznymi szyn."""

from __future__ import annotations

import json
import re
import unicodedata
from pathlib import Path

import pandapower as pp

from kse_grid.network_normalizer import refresh_composite_names
from kse_grid.type_coercion import to_float as _to_float, to_int as _to_int

_DEFAULT_BUS_NAME_RE = re.compile(r"^(?:Bus\s+)?\d+$", re.IGNORECASE)
_STATION_PREFIX_RE = re.compile(r"^\s*\d+\s+")
_STATION_NOISE_RE = re.compile(r"\s*&.*$")
_ASCII_FALLBACK = {"ł": "l", "Ł": "L", "ø": "o", "Ø": "O", "?": ""}


def load_geo_sidecar(net: pp.pandapowerNet, base_path: str | Path) -> bool:
    """Szuka i aplikuje sidecar GeoJSON względem podanej ścieżki bazowej.

    Zwraca True jeśli sidecar został znaleziony i zaaplikowany.
    """
    before = getattr(net, "_geo_source", None)
    _try_load_sidecar(net, Path(base_path))
    after = getattr(net, "_geo_source", None)
    return after is not None and after != before


def _try_load_sidecar(net: pp.pandapowerNet, case_path: Path) -> None:
    for sidecar_path in _candidate_paths(case_path):
        if not sidecar_path.exists():
            continue
        _apply_sidecar(net, sidecar_path)
        setattr(net, "_geo_source", str(sidecar_path))
        break


def _candidate_paths(case_path: Path) -> list[Path]:
    stem = case_path.stem
    return [
        case_path.with_suffix(".geojson"),
        case_path.with_suffix(".json"),
        case_path.with_name(f"{stem}.wgs84.geojson"),
        case_path.with_name(f"{stem}_wgs84.geojson"),
        case_path.with_name(f"{stem}_geo.geojson"),
    ]


def _apply_sidecar(net: pp.pandapowerNet, sidecar_path: Path) -> None:
    payload = json.loads(sidecar_path.read_text(encoding="utf-8"))
    features = payload.get("features", [])
    if payload.get("type") != "FeatureCollection" or not isinstance(features, list):
        raise ValueError(f"{sidecar_path.name} musi być GeoJSON FeatureCollection")

    id_lookup = {int(idx): int(idx) for idx in net.bus.index}
    one_based_lookup = {int(idx) + 1: int(idx) for idx in net.bus.index}
    name_lookup = {
        str(net.bus.at[idx, "name"]).strip().casefold(): int(idx)
        for idx in net.bus.index
        if str(net.bus.at[idx, "name"]).strip()
    }

    matched = 0
    renamed = 0
    for feature in features:
        if not isinstance(feature, dict):
            continue
        geometry = feature.get("geometry") or {}
        if geometry.get("type") != "Point":
            continue
        coordinates = geometry.get("coordinates")
        if not isinstance(coordinates, list) or len(coordinates) < 2:
            continue

        bus_idx = _match_feature_to_bus(feature, id_lookup, one_based_lookup, name_lookup)
        if bus_idx is None:
            continue

        lon = _to_float(coordinates[0])
        lat = _to_float(coordinates[1])
        net.bus.at[bus_idx, "geo"] = json.dumps(
            {"type": "Point", "coordinates": [lon, lat]},
            separators=(",", ":"),
        )

        properties = feature.get("properties") or {}
        station = _clean_station_name(properties.get("station"))
        if station:
            current = str(net.bus.at[bus_idx, "name"]).strip()
            if not current or _DEFAULT_BUS_NAME_RE.match(current):
                vn = _to_float(net.bus.at[bus_idx, "vn_kv"])
                net.bus.at[bus_idx, "name"] = f"{station} {vn:g} kV"
                renamed += 1

        matched += 1

    if matched == 0:
        raise ValueError(f"{sidecar_path.name} nie zawiera żadnych dopasowanych punktów szyn")

    if renamed:
        refresh_composite_names(net)


def _match_feature_to_bus(
    feature: dict,
    id_lookup: dict[int, int],
    one_based_lookup: dict[int, int],
    name_lookup: dict[str, int],
) -> int | None:
    properties = feature.get("properties") or {}
    id_candidates = [
        properties.get("bus"),
        properties.get("bus_id"),
        properties.get("bus_idx"),
        properties.get("pp_index"),
        properties.get("id"),
        feature.get("id"),
    ]
    for raw in id_candidates:
        if raw is None:
            continue
        try:
            bus_id = int(raw)
        except (TypeError, ValueError):
            continue
        if bus_id in one_based_lookup:
            return one_based_lookup[bus_id]
        if bus_id in id_lookup:
            return id_lookup[bus_id]

    name_candidates = [
        properties.get("name"),
        properties.get("bus_name"),
        properties.get("station"),
    ]
    for raw in name_candidates:
        if raw is None:
            continue
        bus_idx = name_lookup.get(str(raw).strip().casefold())
        if bus_idx is not None:
            return bus_idx
    return None


def _clean_station_name(raw: object) -> str:
    if not isinstance(raw, str):
        return ""
    text = _STATION_PREFIX_RE.sub("", raw)
    text = _STATION_NOISE_RE.sub("", text)
    text = _to_ascii(text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def _to_ascii(text: str) -> str:
    for src, dst in _ASCII_FALLBACK.items():
        text = text.replace(src, dst)
    text = unicodedata.normalize("NFKD", text)
    return "".join(ch for ch in text if not unicodedata.combining(ch))
