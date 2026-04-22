"""Serializacja sieci pandapower do prostego JSON-a dla frontendu."""

from __future__ import annotations

import json
import math
from typing import Any

import networkx as nx
import pandapower as pp


_VOLTAGE_OK_MIN = 0.95
_VOLTAGE_OK_MAX = 1.05
_OVERLOAD_PCT = 100.0
_LOAD_WARN_PCT = 80.0
_LOAD_BAD_PCT = 100.0
_CORE_VOLTAGE_KV = 220.0


def serialize_network(net: pp.pandapowerNet) -> dict[str, Any]:
    """Zwraca słownik z całą siecią + wynikami load flow gotowy do JSON-a."""
    positions = _compute_positions(net)
    has_bus_results = not net.res_bus.empty
    has_line_results = not net.res_line.empty
    has_trafo_results = not net.res_trafo.empty

    voltage_levels = sorted({float(v) for v in net.bus.vn_kv.dropna().tolist() if v > 0}, reverse=True)
    default_voltage_filter = [v for v in voltage_levels if v >= _CORE_VOLTAGE_KV] or list(voltage_levels)

    return {
        "name": getattr(net, "name", None) or "Sieć elektroenergetyczna",
        "hasResults": has_bus_results,
        "voltageLevels": voltage_levels,
        "defaultVoltageFilter": default_voltage_filter,
        "stats": _compute_stats(net),
        "buses": _serialize_buses(net, positions, has_bus_results),
        "lines": _serialize_lines(net, has_line_results),
        "trafos": _serialize_trafos(net, has_trafo_results),
        "bounds": _compute_bounds(positions),
    }


# ---------------------------------------------------------------------------
# Pozycje szyn
# ---------------------------------------------------------------------------

def _compute_positions(net: pp.pandapowerNet) -> dict[int, tuple[float, float]]:
    geo: dict[int, tuple[float, float]] = {}
    for bus_idx, row in net.bus.iterrows():
        raw = row.get("geo")
        if not raw:
            continue
        data = json.loads(raw) if isinstance(raw, str) else raw
        lat, lon = data["coordinates"]
        geo[bus_idx] = (float(lon), float(lat))

    if len(geo) == len(net.bus):
        return geo

    graph = nx.Graph()
    graph.add_nodes_from(net.bus.index.tolist())
    graph.add_edges_from(zip(net.line.from_bus.tolist(), net.line.to_bus.tolist()))
    graph.add_edges_from(zip(net.trafo.hv_bus.tolist(), net.trafo.lv_bus.tolist()))
    layout = nx.spring_layout(graph, seed=42, iterations=30)
    return {bus_idx: (float(x), float(y)) for bus_idx, (x, y) in layout.items()}


def _compute_bounds(positions: dict[int, tuple[float, float]]) -> dict[str, list[float]]:
    xs = [x for x, _ in positions.values()]
    ys = [y for _, y in positions.values()]
    x_min, x_max = min(xs), max(xs)
    y_min, y_max = min(ys), max(ys)
    pad_x = max((x_max - x_min) * 0.08, 0.2)
    pad_y = max((y_max - y_min) * 0.08, 0.2)
    return {"x": [x_min - pad_x, x_max + pad_x], "y": [y_min - pad_y, y_max + pad_y]}


# ---------------------------------------------------------------------------
# Serializacja elementów
# ---------------------------------------------------------------------------

def _serialize_buses(
    net: pp.pandapowerNet,
    positions: dict[int, tuple[float, float]],
    has_results: bool,
) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for bus_idx, row in net.bus.iterrows():
        x, y = positions[bus_idx]
        load_mw = float(net.load.loc[net.load.bus == bus_idx, "p_mw"].sum()) if not net.load.empty else 0.0
        gen_mw = float(net.gen.loc[net.gen.bus == bus_idx, "p_mw"].sum()) if not net.gen.empty else 0.0

        item: dict[str, Any] = {
            "id": int(bus_idx),
            "name": str(row["name"]),
            "vn_kv": float(row["vn_kv"]),
            "x": x,
            "y": y,
            "loadMw": load_mw,
            "genMw": gen_mw,
        }
        if has_results:
            item["vmPu"] = _safe_float(net.res_bus.at[bus_idx, "vm_pu"])
            item["vaDeg"] = _safe_float(net.res_bus.at[bus_idx, "va_degree"])
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
