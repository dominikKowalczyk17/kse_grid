"""Serializacja sieci pandapower do prostego JSON-a dla frontendu."""

from __future__ import annotations

import json
import math
from typing import Any

import networkx as nx
import pandapower as pp
from pandapower.topology import create_nxgraph


_VOLTAGE_OK_MIN = 0.95
_VOLTAGE_OK_MAX = 1.05
_OVERLOAD_PCT = 100.0
_LOAD_WARN_PCT = 80.0
_LOAD_BAD_PCT = 100.0
_CORE_VOLTAGE_KV = 220.0


def serialize_network(net: pp.pandapowerNet) -> dict[str, Any]:
    """Zwraca słownik z całą siecią + wynikami load flow gotowy do JSON-a."""
    positions = _compute_positions(net)
    geo_positions = _extract_geo_positions(net)
    has_bus_results = not net.res_bus.empty
    has_line_results = not net.res_line.empty
    has_trafo_results = not net.res_trafo.empty

    voltage_levels = sorted({float(v) for v in net.bus.vn_kv.dropna().tolist() if v > 0}, reverse=True)
    default_voltage_filter = [v for v in voltage_levels if v >= _CORE_VOLTAGE_KV] or list(voltage_levels)
    graph_bounds = _compute_bounds(positions)
    geo_view = _compute_geo_view(geo_positions) if geo_positions else None

    return {
        "name": getattr(net, "name", None) or "Sieć elektroenergetyczna",
        "hasResults": has_bus_results,
        "voltageLevels": voltage_levels,
        "defaultVoltageFilter": default_voltage_filter,
        "layoutModes": ["graph", "geo"] if geo_view else ["graph"],
        "defaultViewMode": "geo" if geo_view else "graph",
        "geoAvailable": geo_view is not None,
        "stats": _compute_stats(net),
        "buses": _serialize_buses(net, positions, geo_positions, has_bus_results),
        "lines": _serialize_lines(net, has_line_results),
        "trafos": _serialize_trafos(net, has_trafo_results),
        "bounds": graph_bounds,
        "graphBounds": graph_bounds,
        "geoView": geo_view,
    }


# ---------------------------------------------------------------------------
# Pozycje szyn (layout grafu — bez geodanych)
# ---------------------------------------------------------------------------

def _compute_positions(net: pp.pandapowerNet) -> dict[int, tuple[float, float]]:
    """
    Liczy pozycje szyn algorytmem spring layout (Fruchterman-Reingold) na grafie
    topologii sieci. Geodane (`net.bus.geo`) są celowo ignorowane — siatka jest
    renderowana jako abstrakcyjny graf, nie jako mapa.
    """
    graph = create_nxgraph(
        net,
        respect_switches=True,
        include_out_of_service=False,
        multi=False,
    )
    for bus_idx in net.bus.index:
        if bus_idx not in graph:
            graph.add_node(bus_idx)

    components = list(nx.connected_components(graph))
    positions: dict[int, tuple[float, float]] = {}

    for i, comp in enumerate(components):
        subgraph = graph.subgraph(comp)
        if len(comp) == 1:
            sub_layout = {next(iter(comp)): (0.0, 0.0)}
        else:
            sub_layout = nx.spring_layout(subgraph, seed=42, iterations=50)

        offset_x = (i % 4) * 2.5
        offset_y = (i // 4) * 2.5
        for bus_idx, (x, y) in sub_layout.items():
            positions[bus_idx] = (float(x) + offset_x, float(y) + offset_y)

    return positions


def _compute_bounds(positions: dict[int, tuple[float, float]]) -> dict[str, list[float]]:
    xs = [x for x, _ in positions.values()]
    ys = [y for _, y in positions.values()]
    x_min, x_max = min(xs), max(xs)
    y_min, y_max = min(ys), max(ys)
    pad_x = max((x_max - x_min) * 0.08, 0.2)
    pad_y = max((y_max - y_min) * 0.08, 0.2)
    return {"x": [x_min - pad_x, x_max + pad_x], "y": [y_min - pad_y, y_max + pad_y]}


def _extract_geo_positions(net: pp.pandapowerNet) -> dict[int, tuple[float, float]]:
    positions: dict[int, tuple[float, float]] = {}

    if hasattr(net, "bus_geodata") and not net.bus_geodata.empty:
        for bus_idx, row in net.bus_geodata.iterrows():
            x = _safe_float(row.get("x"))
            y = _safe_float(row.get("y"))
            if x is None or y is None:
                continue
            positions[int(bus_idx)] = (x, y)

    if "geo" not in net.bus.columns:
        return positions

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
        if lon is None or lat is None:
            continue
        positions[int(bus_idx)] = (lon, lat)

    return positions


def _compute_geo_view(positions: dict[int, tuple[float, float]]) -> dict[str, Any]:
    lons = [lon for lon, _ in positions.values()]
    lats = [lat for _, lat in positions.values()]
    west, east = min(lons), max(lons)
    south, north = min(lats), max(lats)
    return {
        "center": {"lon": (west + east) / 2.0, "lat": (south + north) / 2.0},
        "bounds": {"lon": [west, east], "lat": [south, north]},
        "zoom": _estimate_map_zoom(west, east, south, north),
        "focusZoom": min(_estimate_map_zoom(west, east, south, north) + 2.0, 12.5),
    }


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


# ---------------------------------------------------------------------------
# Serializacja elementów
# ---------------------------------------------------------------------------

def _serialize_buses(
    net: pp.pandapowerNet,
    positions: dict[int, tuple[float, float]],
    geo_positions: dict[int, tuple[float, float]],
    has_results: bool,
) -> list[dict[str, Any]]:
    slack_buses = set(net.ext_grid.bus.tolist()) if not net.ext_grid.empty else set()
    gen_buses = set(net.gen.bus.tolist()) if not net.gen.empty else set()

    out: list[dict[str, Any]] = []
    for bus_idx, row in net.bus.iterrows():
        x, y = positions[bus_idx]
        if not net.load.empty:
            mask = net.load.bus == bus_idx
            load_mw = float(net.load.loc[mask, "p_mw"].sum())
            load_mvar = float(net.load.loc[mask, "q_mvar"].sum()) if "q_mvar" in net.load.columns else 0.0
        else:
            load_mw = 0.0
            load_mvar = 0.0
        gen_mw = float(net.gen.loc[net.gen.bus == bus_idx, "p_mw"].sum()) if not net.gen.empty else 0.0

        if bus_idx in slack_buses:
            bus_type = "Slack"
        elif bus_idx in gen_buses:
            bus_type = "PV"
        else:
            bus_type = "PQ"

        item: dict[str, Any] = {
            "id": int(bus_idx),
            "name": str(row["name"]),
            "type": bus_type,
            "vn_kv": float(row["vn_kv"]),
            "x": x,
            "y": y,
            "loadMw": load_mw,
            "loadMvar": load_mvar,
            "genMw": gen_mw,
        }
        if bus_idx in geo_positions:
            lon, lat = geo_positions[bus_idx]
            item["lon"] = lon
            item["lat"] = lat
        if has_results:
            item["vmPu"] = _safe_float(net.res_bus.at[bus_idx, "vm_pu"])
            item["vaDeg"] = _safe_float(net.res_bus.at[bus_idx, "va_degree"])
            if bus_idx in gen_buses and not net.res_gen.empty:
                gen_mask = net.gen.bus == bus_idx
                gen_indices = net.gen.index[gen_mask]
                q_values = net.res_gen.loc[gen_indices, "q_mvar"].dropna()
                if not q_values.empty:
                    item["genMvar"] = float(q_values.sum())
        out.append(item)
    return out


def _serialize_lines(net: pp.pandapowerNet, has_results: bool) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for line_idx, row in net.line.iterrows():
        from_bus = int(row.from_bus)
        to_bus = int(row.to_bus)
        voltage = float(net.bus.at[from_bus, "vn_kv"])
        item: dict[str, Any] = {
            "id": int(line_idx),
            "name": str(row["name"]),
            "fromBus": from_bus,
            "toBus": to_bus,
            "voltage": voltage,
            "lengthKm": float(row["length_km"]),
        }
        if has_results:
            item["loading"] = _safe_float(net.res_line.at[line_idx, "loading_percent"])
            item["pFromMw"] = _safe_float(net.res_line.at[line_idx, "p_from_mw"])
        else:
            item["loading"] = 0.0
        out.append(item)
    return out


def _serialize_trafos(net: pp.pandapowerNet, has_results: bool) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for trafo_idx, row in net.trafo.iterrows():
        item: dict[str, Any] = {
            "id": int(trafo_idx),
            "name": str(row["name"]),
            "hvBus": int(row.hv_bus),
            "lvBus": int(row.lv_bus),
            "vnHvKv": float(row["vn_hv_kv"]),
            "vnLvKv": float(row["vn_lv_kv"]),
            "snMva": float(row["sn_mva"]),
        }
        if has_results:
            item["loading"] = _safe_float(net.res_trafo.at[trafo_idx, "loading_percent"])
            item["pHvMw"] = _safe_float(net.res_trafo.at[trafo_idx, "p_hv_mw"])
        else:
            item["loading"] = 0.0
        out.append(item)
    return out


def _safe_float(value: Any) -> float | None:
    try:
        f = float(value)
    except (TypeError, ValueError):
        return None
    if math.isnan(f) or math.isinf(f):
        return None
    return f


# ---------------------------------------------------------------------------
# Statystyki
# ---------------------------------------------------------------------------

def _compute_stats(net: pp.pandapowerNet) -> dict[str, Any]:
    max_loading = _max_loading(net)
    n_viol = _count_voltage_violations(net)
    n_overload = _count_overloads(net)
    return {
        "nBus": int(len(net.bus)),
        "nLine": int(len(net.line)),
        "nTrafo": int(len(net.trafo)),
        "nGen": int(len(net.gen)),
        "maxLoading": f"{max_loading:.1f}%",
        "loadClass": _status(max_loading, _LOAD_WARN_PCT, _LOAD_BAD_PCT),
        "nViol": n_viol,
        "violClass": _status(float(n_viol), 1.0, 5.0),
        "nOverload": n_overload,
        "ovlClass": _status(float(n_overload), 1.0, 5.0),
    }


def _max_loading(net: pp.pandapowerNet) -> float:
    candidates: list[float] = []
    if not net.res_line.empty:
        s = net.res_line["loading_percent"].dropna()
        if not s.empty:
            candidates.append(float(s.max()))
    if not net.res_trafo.empty:
        s = net.res_trafo["loading_percent"].dropna()
        if not s.empty:
            candidates.append(float(s.max()))
    return max(candidates, default=0.0)


def _count_voltage_violations(net: pp.pandapowerNet) -> int:
    if net.res_bus.empty:
        return 0
    vm = net.res_bus["vm_pu"].dropna()
    return int(((vm < _VOLTAGE_OK_MIN) | (vm > _VOLTAGE_OK_MAX)).sum())


def _count_overloads(net: pp.pandapowerNet) -> int:
    total = 0
    if not net.res_line.empty:
        total += int((net.res_line["loading_percent"].fillna(0.0) > _OVERLOAD_PCT).sum())
    if not net.res_trafo.empty:
        total += int((net.res_trafo["loading_percent"].fillna(0.0) > _OVERLOAD_PCT).sum())
    return total


def _status(value: float, warn: float, bad: float) -> str:
    if value >= bad:
        return "bad"
    if value >= warn:
        return "warn"
    return "good"
