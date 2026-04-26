"""Serializacja sieci pandapower do prostego JSON-a dla frontendu."""

from __future__ import annotations

import json
import math
from numbers import Integral, Real
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
        "totals": _compute_totals(net),
        "diagnostics": _compute_diagnostics(net),
        "buses": _serialize_buses(net, positions, geo_positions, has_bus_results),
        "lines": _serialize_lines(net, has_line_results, geo_positions),
        "trafos": _serialize_trafos(net, has_trafo_results),
        "bounds": graph_bounds,
        "graphBounds": graph_bounds,
        "geoView": geo_view,
    }


def _to_int(value: object) -> int:
    if isinstance(value, Integral):
        return int(value)
    if isinstance(value, str):
        return int(value)
    raise TypeError(f"Expected integer-like value, got {type(value).__name__}")


def _to_float(value: object) -> float:
    result = _safe_float(value)
    if result is None:
        raise TypeError(f"Expected float-like value, got {value!r}")
    return result


# ---------------------------------------------------------------------------
# Pozycje szyn (layout grafu — bez geodanych)
# ---------------------------------------------------------------------------

def _compute_positions(net: pp.pandapowerNet) -> dict[int, tuple[float, float]]:
    """
    Liczy pozycje szyn algorytmem spring layout (Fruchterman-Reingold) na grafie
    topologii sieci. Geodane (`net.bus.geo`) są celowo ignorowane — siatka jest
    renderowana jako abstrakcyjny graf, nie jako mapa.

    Krawędzie transformatorów dostają znacznie większą wagę niż linie — fizycznie
    łączą szyny tej samej stacji (różne poziomy napięć), więc na grafie powinny być
    rysowane bardzo blisko, a nie rozciągnięte przez połowę sieci.
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

    _LINE_WEIGHT = 1.0
    _TRAFO_WEIGHT = 50.0
    for u, v, data in graph.edges(data=True):
        data["weight"] = _LINE_WEIGHT
    for _, trow in net.trafo.iterrows():
        hv = _to_int(trow.hv_bus)
        lv = _to_int(trow.lv_bus)
        if graph.has_edge(hv, lv):
            graph[hv][lv]["weight"] = _TRAFO_WEIGHT
    if hasattr(net, "trafo3w") and not net.trafo3w.empty:
        for _, trow in net.trafo3w.iterrows():
            for a, b in (
                (_to_int(trow.hv_bus), _to_int(trow.mv_bus)),
                (_to_int(trow.hv_bus), _to_int(trow.lv_bus)),
                (_to_int(trow.mv_bus), _to_int(trow.lv_bus)),
            ):
                if graph.has_edge(a, b):
                    graph[a][b]["weight"] = _TRAFO_WEIGHT

    components = list(nx.connected_components(graph))
    positions: dict[int, tuple[float, float]] = {}

    for i, comp in enumerate(components):
        subgraph = graph.subgraph(comp)
        if len(comp) == 1:
            sub_layout = {next(iter(comp)): (0.0, 0.0)}
        else:
            sub_layout = nx.spring_layout(subgraph, seed=42, iterations=80, weight="weight")

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
            positions[_to_int(bus_idx)] = (x, y)

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
        positions[_to_int(bus_idx)] = (lon, lat)

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
        bus_id = _to_int(bus_idx)
        x, y = positions[bus_id]
        if not net.load.empty:
            mask = net.load.bus == bus_id
            load_mw = float(net.load.loc[mask, "p_mw"].sum())
            load_mvar = float(net.load.loc[mask, "q_mvar"].sum()) if "q_mvar" in net.load.columns else 0.0
        else:
            load_mw = 0.0
            load_mvar = 0.0
        gen_mw = float(net.gen.loc[net.gen.bus == bus_id, "p_mw"].sum()) if not net.gen.empty else 0.0

        if bus_id in slack_buses:
            bus_type = "Slack"
        elif bus_id in gen_buses:
            bus_type = "PV"
        else:
            bus_type = "PQ"

        item: dict[str, Any] = {
            "id": bus_id,
            "name": str(row["name"]),
            "type": bus_type,
            "vn_kv": _to_float(row["vn_kv"]),
            "x": x,
            "y": y,
            "loadMw": load_mw,
            "loadMvar": load_mvar,
            "genMw": gen_mw,
        }
        if bus_id in geo_positions:
            lon, lat = geo_positions[bus_id]
            item["lon"] = lon
            item["lat"] = lat
        if has_results:
            item["vmPu"] = _safe_float(net.res_bus.at[bus_id, "vm_pu"])
            item["vaDeg"] = _safe_float(net.res_bus.at[bus_id, "va_degree"])
            if bus_id in gen_buses and not net.res_gen.empty:
                gen_mask = net.gen.bus == bus_id
                gen_indices = net.gen.index[gen_mask]
                q_values = net.res_gen.loc[gen_indices, "q_mvar"].dropna()
                if not q_values.empty:
                    item["genMvar"] = float(q_values.sum())
        out.append(item)
    return out


def _haversine_km(a: tuple[float, float], b: tuple[float, float]) -> float:
    lon1, lat1 = a
    lon2, lat2 = b
    r = 6371.0088
    p1 = math.radians(lat1)
    p2 = math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    h = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(min(1.0, math.sqrt(h)))


def _serialize_lines(
    net: pp.pandapowerNet,
    has_results: bool,
    geo_positions: dict[int, tuple[float, float]],
) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for line_idx, row in net.line.iterrows():
        line_id = _to_int(line_idx)
        from_bus = _to_int(row.from_bus)
        to_bus = _to_int(row.to_bus)
        voltage = _to_float(net.bus.at[from_bus, "vn_kv"])
        model_length = _to_float(row["length_km"])
        geo_length = None
        a = geo_positions.get(from_bus)
        b = geo_positions.get(to_bus)
        if a and b:
            geo_length = round(_haversine_km(a, b), 3)
        item: dict[str, Any] = {
            "id": line_id,
            "name": str(row["name"]),
            "fromBus": from_bus,
            "toBus": to_bus,
            "voltage": voltage,
            "lengthKm": geo_length if geo_length is not None else model_length,
            "modelLengthKm": model_length,
            "geoLengthKm": geo_length,
            "lengthSource": "geo" if geo_length is not None else "model",
        }
        if has_results:
            item["loading"] = _safe_float(net.res_line.at[line_id, "loading_percent"])
            item["pFromMw"] = _safe_float(net.res_line.at[line_id, "p_from_mw"])
        else:
            item["loading"] = 0.0
        out.append(item)
    return out


def _serialize_trafos(net: pp.pandapowerNet, has_results: bool) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for trafo_idx, row in net.trafo.iterrows():
        trafo_id = _to_int(trafo_idx)
        item: dict[str, Any] = {
            "id": trafo_id,
            "name": str(row["name"]),
            "hvBus": _to_int(row.hv_bus),
            "lvBus": _to_int(row.lv_bus),
            "vnHvKv": _to_float(row["vn_hv_kv"]),
            "vnLvKv": _to_float(row["vn_lv_kv"]),
            "snMva": _to_float(row["sn_mva"]),
        }
        if has_results:
            item["loading"] = _safe_float(net.res_trafo.at[trafo_id, "loading_percent"])
            item["pHvMw"] = _safe_float(net.res_trafo.at[trafo_id, "p_hv_mw"])
        else:
            item["loading"] = 0.0
        out.append(item)
    return out


def _safe_float(value: Any) -> float | None:
    if isinstance(value, bool):
        f = float(value)
    elif isinstance(value, Real):
        f = float(value)
    elif isinstance(value, str):
        try:
            f = float(value)
        except ValueError:
            return None
    else:
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


def _compute_totals(net: pp.pandapowerNet) -> dict[str, Any]:
    p_gen = 0.0
    if hasattr(net, "res_gen") and not net.res_gen.empty and "p_mw" in net.res_gen.columns:
        p_gen += float(net.res_gen["p_mw"].fillna(0.0).sum())
    if hasattr(net, "res_sgen") and not net.res_sgen.empty and "p_mw" in net.res_sgen.columns:
        p_gen += float(net.res_sgen["p_mw"].fillna(0.0).sum())

    p_slack = 0.0
    if hasattr(net, "res_ext_grid") and not net.res_ext_grid.empty and "p_mw" in net.res_ext_grid.columns:
        p_slack += float(net.res_ext_grid["p_mw"].fillna(0.0).sum())
    if hasattr(net, "res_gen") and not net.res_gen.empty and "p_mw" in net.res_gen.columns:
        slack_mask = net.gen["slack"].fillna(False).astype(bool) if "slack" in net.gen.columns else None
        if slack_mask is not None and slack_mask.any():
            p_slack += float(net.res_gen.loc[slack_mask, "p_mw"].fillna(0.0).sum())

    p_load = float(net.res_load["p_mw"].fillna(0.0).sum()) if hasattr(net, "res_load") and not net.res_load.empty else 0.0
    p_loss = 0.0
    if hasattr(net, "res_line") and not net.res_line.empty and "pl_mw" in net.res_line.columns:
        p_loss += float(net.res_line["pl_mw"].fillna(0.0).sum())
    if hasattr(net, "res_trafo") and not net.res_trafo.empty and "pl_mw" in net.res_trafo.columns:
        p_loss += float(net.res_trafo["pl_mw"].fillna(0.0).sum())
    if hasattr(net, "res_trafo3w") and not net.res_trafo3w.empty and "pl_mw" in net.res_trafo3w.columns:
        p_loss += float(net.res_trafo3w["pl_mw"].fillna(0.0).sum())

    slack_id: int | None = None
    if not net.ext_grid.empty:
        active = net.ext_grid["in_service"].fillna(False).astype(bool) if "in_service" in net.ext_grid.columns else None
        if active is not None and active.any():
            slack_id = _to_int(net.ext_grid.loc[active].iloc[0]["bus"])
        elif len(net.ext_grid):
            slack_id = _to_int(net.ext_grid.iloc[0]["bus"])
    if slack_id is None and not net.gen.empty and "slack" in net.gen.columns:
        slack_gen = net.gen.loc[net.gen["slack"].fillna(False).astype(bool)]
        if not slack_gen.empty:
            slack_id = _to_int(slack_gen.iloc[0]["bus"])

    gen_units = 0
    if not net.ext_grid.empty:
        gen_units += int(net.ext_grid["in_service"].fillna(True).astype(bool).sum()) if "in_service" in net.ext_grid.columns else int(len(net.ext_grid))
    if not net.gen.empty:
        gen_units += int(net.gen["in_service"].fillna(True).astype(bool).sum()) if "in_service" in net.gen.columns else int(len(net.gen))
    if hasattr(net, "sgen") and not net.sgen.empty:
        gen_units += int(net.sgen["in_service"].fillna(True).astype(bool).sum()) if "in_service" in net.sgen.columns else int(len(net.sgen))

    total_gen = p_gen + p_slack
    loss_pct = (p_loss / total_gen * 100.0) if total_gen > 0 else None

    return {
        "loadMw": p_load,
        "generationMw": total_gen,
        "slackMw": p_slack,
        "lossesMw": p_loss,
        "lossPct": loss_pct,
        "slackBusId": slack_id,
        "genUnits": gen_units,
    }


def _compute_diagnostics(net: pp.pandapowerNet) -> dict[str, Any]:
    voltage = _compute_voltage_diagnostics(net)
    loading = _compute_loading_diagnostics(net)
    return {
        "voltage": voltage,
        "loading": loading,
    }


def _compute_voltage_diagnostics(net: pp.pandapowerNet) -> dict[str, Any]:
    if net.res_bus.empty:
        return {
            "minPu": None,
            "maxPu": None,
            "minBusId": None,
            "maxBusId": None,
            "minBusName": None,
            "maxBusName": None,
            "minBusKv": None,
            "maxBusKv": None,
            "lowCount": 0,
            "highCount": 0,
        }

    vm = net.res_bus["vm_pu"].dropna()
    if vm.empty:
        return {
            "minPu": None,
            "maxPu": None,
            "minBusId": None,
            "maxBusId": None,
            "minBusName": None,
            "maxBusName": None,
            "minBusKv": None,
            "maxBusKv": None,
            "lowCount": 0,
            "highCount": 0,
        }

    min_idx = _to_int(vm.idxmin())
    max_idx = _to_int(vm.idxmax())
    return {
        "minPu": float(vm.loc[min_idx]),
        "maxPu": float(vm.loc[max_idx]),
        "minBusId": min_idx,
        "maxBusId": max_idx,
        "minBusName": str(net.bus.at[min_idx, "name"]),
        "maxBusName": str(net.bus.at[max_idx, "name"]),
        "minBusKv": _to_float(net.bus.at[min_idx, "vn_kv"]),
        "maxBusKv": _to_float(net.bus.at[max_idx, "vn_kv"]),
        "lowCount": int((vm < _VOLTAGE_OK_MIN).sum()),
        "highCount": int((vm > _VOLTAGE_OK_MAX).sum()),
    }


def _compute_loading_diagnostics(net: pp.pandapowerNet) -> dict[str, Any]:
    max_pct = 0.0
    max_kind = None
    max_id = None
    max_name = None

    overloaded = 0
    heavy = 0

    if not net.res_line.empty:
        line_loading = net.res_line["loading_percent"].fillna(0.0)
        overloaded += int((line_loading >= _OVERLOAD_PCT).sum())
        heavy += int(((line_loading >= _LOAD_WARN_PCT) & (line_loading < _OVERLOAD_PCT)).sum())
        if not line_loading.empty:
            idx = _to_int(line_loading.idxmax())
            value = float(line_loading.loc[idx])
            if value >= max_pct:
                max_pct = value
                max_kind = "line"
                max_id = idx
                max_name = str(net.line.at[idx, "name"])

    if not net.res_trafo.empty:
        trafo_loading = net.res_trafo["loading_percent"].fillna(0.0)
        overloaded += int((trafo_loading >= _OVERLOAD_PCT).sum())
        heavy += int(((trafo_loading >= _LOAD_WARN_PCT) & (trafo_loading < _OVERLOAD_PCT)).sum())
        if not trafo_loading.empty:
            idx = _to_int(trafo_loading.idxmax())
            value = float(trafo_loading.loc[idx])
            if value >= max_pct:
                max_pct = value
                max_kind = "trafo"
                max_id = idx
                max_name = str(net.trafo.at[idx, "name"])

    load_bus_count = int((net.load.groupby("bus")["p_mw"].sum().fillna(0.0) > 0.0).sum()) if not net.load.empty else 0

    return {
        "maxPct": max_pct,
        "maxKind": max_kind,
        "maxId": max_id,
        "maxName": max_name,
        "overloadedCount": overloaded,
        "heavyCount": heavy,
        "loadBusCount": load_bus_count,
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
