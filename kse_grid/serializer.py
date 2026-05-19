"""Serializacja sieci pandapower do prostego JSON-a dla frontendu."""

from __future__ import annotations

from typing import Any

import pandapower as pp

from kse_grid.diagnostics import compute_diagnostics as _compute_diagnostics
from kse_grid.element_serializers import (
    serialize_buses as _serialize_buses,
    serialize_gens as _serialize_gens,
    serialize_lines as _serialize_lines,
    serialize_switches as _serialize_switches,
    serialize_trafos as _serialize_trafos,
)
from kse_grid.geo_positions import compute_geo_view as _compute_geo_view, extract_geo_positions as _extract_geo_positions
from kse_grid.graph_layout import compute_bounds as _compute_bounds, compute_graph_positions
from kse_grid.network_stats import compute_stats as _compute_stats, compute_totals as _compute_totals
from kse_grid.thresholds import CORE_VOLTAGE_KV as _CORE_VOLTAGE_KV
from kse_grid.topology_analysis import compute_topology as _compute_topology
from kse_grid.type_coercion import safe_float as _safe_float, to_int as _to_int


def serialize_network(
    net: pp.pandapowerNet,
    *,
    graph_positions: dict[int, tuple[float, float]] | None = None,
) -> dict[str, Any]:
    """Zwraca słownik z całą siecią + wynikami load flow gotowy do JSON-a."""
    positions = graph_positions or compute_graph_positions(net)
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
        "defaultViewMode": "graph",
        "geoAvailable": geo_view is not None,
        "stats": _compute_stats(net),
        "totals": _compute_totals(net),
        "diagnostics": _compute_diagnostics(net),
        "buses": _serialize_buses(net, positions, geo_positions, has_bus_results),
        "lines": _serialize_lines(net, has_line_results, geo_positions),
        "trafos": _serialize_trafos(net, has_trafo_results),
        "switches": _serialize_switches(net),
        "gens": _serialize_gens(net),
        "topology": _compute_topology(net),
        "bounds": graph_bounds,
        "graphBounds": graph_bounds,
        "geoView": geo_view,
    }


def serialize_topology_update(
    net: pp.pandapowerNet,
    *,
    changed_element: tuple[str, int] | None = None,
) -> dict[str, Any]:
    """
    Zwraca slim payload z polami, które zmieniają się po zmianie stanu switcha
    i ponownym load flow. Celowo nie zawiera pozycji szyn, geometrii linii ani
    innych pól layoutu — frontend mutuje istniejący obiekt sieci w miejscu, żeby
    zachować edycje użytkownika (drag busa, łamanie linii).
    """
    has_bus_results = not net.res_bus.empty
    has_line_results = not net.res_line.empty
    has_trafo_results = not net.res_trafo.empty
    gen_buses = set(net.gen.bus.tolist()) if not net.gen.empty else set()

    bus_results = _collect_bus_results(net, has_bus_results, gen_buses)
    line_results = _collect_line_results(net, has_line_results)
    trafo_results = _collect_trafo_results(net, has_trafo_results)
    switch_states = [
        {"id": _to_int(idx), "closed": bool(row.get("closed", False))}
        for idx, row in net.switch.iterrows()
    ]

    return {
        "hasResults": has_bus_results,
        "stats": _compute_stats(net),
        "totals": _compute_totals(net),
        "diagnostics": _compute_diagnostics(net),
        "topology": _compute_topology(net),
        "switches": switch_states,
        "busResults": bus_results,
        "lineResults": line_results,
        "trafoResults": trafo_results,
        "changedElement": _serialize_changed_element(net, changed_element),
    }


def _collect_bus_results(
    net: pp.pandapowerNet,
    has_results: bool,
    gen_buses: set[int],
) -> list[dict[str, Any]]:
    out = []
    for bus_idx in net.bus.index:
        bus_id = _to_int(bus_idx)
        item: dict[str, Any] = {"id": bus_id}
        if has_results:
            item["vmPu"] = _safe_float(net.res_bus.at[bus_id, "vm_pu"])
            item["vaDeg"] = _safe_float(net.res_bus.at[bus_id, "va_degree"])
        else:
            item["vmPu"] = None
            item["vaDeg"] = None
        if bus_id in gen_buses:
            gen_mvar: float | None = None
            if has_results and not net.res_gen.empty:
                gen_indices = net.gen.index[net.gen.bus == bus_id]
                q_values = net.res_gen.loc[gen_indices, "q_mvar"].dropna()
                if not q_values.empty:
                    gen_mvar = float(q_values.sum())
            item["genMvar"] = gen_mvar
        out.append(item)
    return out


def _collect_line_results(net: pp.pandapowerNet, has_results: bool) -> list[dict[str, Any]]:
    out = []
    for line_idx in net.line.index:
        line_id = _to_int(line_idx)
        item: dict[str, Any] = {"id": line_id}
        if has_results:
            item["loading"] = _safe_float(net.res_line.at[line_id, "loading_percent"])
            item["pFromMw"] = _safe_float(net.res_line.at[line_id, "p_from_mw"])
            item["qFromMvar"] = _safe_float(net.res_line.at[line_id, "q_from_mvar"])
            item["pToMw"] = _safe_float(net.res_line.at[line_id, "p_to_mw"])
            item["qToMvar"] = _safe_float(net.res_line.at[line_id, "q_to_mvar"])
        else:
            item["loading"] = 0.0
            item["pFromMw"] = None
            item["qFromMvar"] = None
            item["pToMw"] = None
            item["qToMvar"] = None
        out.append(item)
    return out


def _collect_trafo_results(net: pp.pandapowerNet, has_results: bool) -> list[dict[str, Any]]:
    out = []
    for trafo_idx in net.trafo.index:
        trafo_id = _to_int(trafo_idx)
        item: dict[str, Any] = {"id": trafo_id}
        if has_results:
            item["loading"] = _safe_float(net.res_trafo.at[trafo_id, "loading_percent"])
            item["pHvMw"] = _safe_float(net.res_trafo.at[trafo_id, "p_hv_mw"])
            item["qHvMvar"] = _safe_float(net.res_trafo.at[trafo_id, "q_hv_mvar"])
            item["pLvMw"] = _safe_float(net.res_trafo.at[trafo_id, "p_lv_mw"])
            item["qLvMvar"] = _safe_float(net.res_trafo.at[trafo_id, "q_lv_mvar"])
        else:
            item["loading"] = 0.0
            item["pHvMw"] = None
            item["qHvMvar"] = None
            item["pLvMw"] = None
            item["qLvMvar"] = None
        out.append(item)
    return out


def _serialize_changed_element(
    net: pp.pandapowerNet,
    changed_element: tuple[str, int] | None,
) -> dict[str, Any] | None:
    """Re-serializuje pojedynczy element po edycji parametrów."""
    if changed_element is None:
        return None
    kind, element_id = changed_element
    geo_positions = _extract_geo_positions(net)
    has_bus_results = not net.res_bus.empty
    has_line_results = not net.res_line.empty
    has_trafo_results = not net.res_trafo.empty

    if kind == "bus" and element_id in net.bus.index:
        # Pozycje grafowe trzymamy po stronie sesji — element wraca bez x/y,
        # frontend zachowa istniejące pozycje.
        items = _serialize_buses(net, {element_id: (0.0, 0.0)}, geo_positions, has_bus_results)
        for item in items:
            if item["id"] == element_id:
                item.pop("x", None)
                item.pop("y", None)
                return {"kind": "bus", "id": element_id, "payload": item}
    if kind == "line" and element_id in net.line.index:
        for item in _serialize_lines(net, has_line_results, geo_positions):
            if item["id"] == element_id:
                return {"kind": "line", "id": element_id, "payload": item}
    if kind == "trafo" and element_id in net.trafo.index:
        for item in _serialize_trafos(net, has_trafo_results):
            if item["id"] == element_id:
                return {"kind": "trafo", "id": element_id, "payload": item}
    if kind == "switch" and element_id in net.switch.index:
        for item in _serialize_switches(net):
            if item["id"] == element_id:
                return {"kind": "switch", "id": element_id, "payload": item}
    if kind == "gen" and element_id in net.gen.index:
        for item in _serialize_gens(net):
            if item["id"] == element_id:
                return {"kind": "gen", "id": element_id, "payload": item}
    return None
