"""Serializacja poszczególnych typów elementów sieci do JSON."""

from __future__ import annotations

from typing import Any

import pandapower as pp

from kse_grid.serialization.geo_positions import haversine_km
from kse_grid.type_coercion import safe_float as _safe_float, to_float as _to_float, to_int as _to_int


def serialize_buses(
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
        x, y = positions.get(bus_id, (None, None))
        load_mw, load_mvar = _bus_load(net, bus_id)
        gen_mw = float(net.gen.loc[net.gen.bus == bus_id, "p_mw"].sum()) if not net.gen.empty else 0.0

        item: dict[str, Any] = {
            "id": bus_id,
            "name": str(row["name"]),
            "type": _bus_type(bus_id, slack_buses, gen_buses),
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
        if has_results and bus_id in net.res_bus.index:
            item["vmPu"] = _safe_float(net.res_bus.at[bus_id, "vm_pu"])
            item["vaDeg"] = _safe_float(net.res_bus.at[bus_id, "va_degree"])
            if bus_id in gen_buses and not net.res_gen.empty:
                gen_indices = net.gen.index[net.gen.bus == bus_id]
                q_values = net.res_gen.loc[gen_indices, "q_mvar"].dropna()
                if not q_values.empty:
                    item["genMvar"] = float(q_values.sum())
        out.append(item)
    return out


def serialize_lines(
    net: pp.pandapowerNet,
    has_results: bool,
    geo_positions: dict[int, tuple[float, float]],
) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for line_idx, row in net.line.iterrows():
        line_id = _to_int(line_idx)
        from_bus = _to_int(row.from_bus)
        to_bus = _to_int(row.to_bus)
        model_length = _to_float(row["length_km"])
        geo_length = _geo_length(geo_positions, from_bus, to_bus)

        item: dict[str, Any] = {
            "id": line_id,
            "name": str(row["name"]),
            "fromBus": from_bus,
            "toBus": to_bus,
            "voltage": _to_float(net.bus.at[from_bus, "vn_kv"]),
            "lengthKm": geo_length if geo_length is not None else model_length,
            "modelLengthKm": model_length,
            "geoLengthKm": geo_length,
            "lengthSource": "geo" if geo_length is not None else "model",
        }
        if has_results and line_id in net.res_line.index:
            item["loading"] = _safe_float(net.res_line.at[line_id, "loading_percent"])
            item["pFromMw"] = _safe_float(net.res_line.at[line_id, "p_from_mw"])
            item["qFromMvar"] = _safe_float(net.res_line.at[line_id, "q_from_mvar"])
            item["pToMw"] = _safe_float(net.res_line.at[line_id, "p_to_mw"])
            item["qToMvar"] = _safe_float(net.res_line.at[line_id, "q_to_mvar"])
        else:
            item["loading"] = 0.0
        out.append(item)
    return out


def serialize_trafos(net: pp.pandapowerNet, has_results: bool) -> list[dict[str, Any]]:
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
        if has_results and trafo_id in net.res_trafo.index:
            item["loading"] = _safe_float(net.res_trafo.at[trafo_id, "loading_percent"])
            item["pHvMw"] = _safe_float(net.res_trafo.at[trafo_id, "p_hv_mw"])
            item["qHvMvar"] = _safe_float(net.res_trafo.at[trafo_id, "q_hv_mvar"])
            item["pLvMw"] = _safe_float(net.res_trafo.at[trafo_id, "p_lv_mw"])
            item["qLvMvar"] = _safe_float(net.res_trafo.at[trafo_id, "q_lv_mvar"])
        else:
            item["loading"] = 0.0
        out.append(item)
    return out


def serialize_switches(net: pp.pandapowerNet) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for switch_idx, row in net.switch.iterrows():
        switch_id = _to_int(switch_idx)
        bus_id = _to_int(row.bus)
        element_id = _to_int(row.element)
        switch_type = str(row.et)
        bus_name = str(net.bus.at[bus_id, "name"])
        voltage = _to_float(net.bus.at[bus_id, "vn_kv"])

        remote_bus_id: int | None = None
        remote_bus_name: str | None = None
        element_name = str(row.get("name") or f"Switch {switch_id}")
        parent_kind = "switch"

        if switch_type == "l" and element_id in net.line.index:
            remote_bus_id, remote_bus_name, element_name, parent_kind = _line_switch_details(
                net, bus_id, element_id
            )
        elif switch_type == "t" and element_id in net.trafo.index:
            remote_bus_id, remote_bus_name, element_name, parent_kind = _trafo_switch_details(
                net, bus_id, element_id
            )
        elif switch_type == "b" and element_id in net.bus.index:
            remote_bus_id = element_id
            remote_bus_name = str(net.bus.at[remote_bus_id, "name"])
            parent_kind = "bus"

        display_name = str(row.get("name") or element_name or f"Odłącznik {switch_id}")

        out.append({
            "id": switch_id,
            "name": display_name,
            "busId": bus_id,
            "busName": bus_name,
            "remoteBusId": remote_bus_id,
            "remoteBusName": remote_bus_name,
            "elementId": element_id,
            "elementName": element_name,
            "elementType": switch_type,
            "parentKind": parent_kind,
            "closed": bool(row.get("closed", False)),
            "voltage": voltage,
            "type": str(row.get("type") or ""),
        })
    return out


def serialize_gens(net: pp.pandapowerNet) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    has_res = hasattr(net, "res_gen") and not net.res_gen.empty
    for gen_idx, row in net.gen.iterrows():
        gen_id = _to_int(gen_idx)
        bus_id = _to_int(row.bus)
        raw_name = str(row.get("name") or "").strip()
        if not raw_name:
            bus_name = str(net.bus.at[bus_id, "name"]) if bus_id in net.bus.index else str(bus_id)
            raw_name = f"Gen @ {bus_name}"
        item: dict[str, Any] = {
            "id": gen_id,
            "busId": bus_id,
            "name": raw_name,
            "pMw": _safe_float(row.get("p_mw")),
            "vmPu": _safe_float(row.get("vm_pu")),
            "maxPMw": _safe_float(row.get("max_p_mw")),
            "minPMw": _safe_float(row.get("min_p_mw")),
            "maxQMvar": _safe_float(row.get("max_q_mvar")),
            "minQMvar": _safe_float(row.get("min_q_mvar")),
            "inService": bool(row.get("in_service", True)),
            "slack": bool(row.get("slack", False)),
        }
        if has_res and gen_id in net.res_gen.index:
            item["resPMw"] = _safe_float(net.res_gen.at[gen_id, "p_mw"])
            item["resQMvar"] = _safe_float(net.res_gen.at[gen_id, "q_mvar"])
        out.append(item)
    return out


def serialize_loads(net: pp.pandapowerNet) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    if not hasattr(net, "load") or net.load.empty:
        return out
    for load_idx, row in net.load.iterrows():
        load_id = _to_int(load_idx)
        out.append({
            "id": load_id,
            "busId": _to_int(row.bus),
            "name": str(row.get("name") or f"Load {load_id}"),
            "pMw": _safe_float(row.get("p_mw")),
            "qMvar": _safe_float(row.get("q_mvar")),
            "inService": bool(row.get("in_service", True)),
        })
    return out


def serialize_sgens(net: pp.pandapowerNet) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    if not hasattr(net, "sgen") or net.sgen.empty:
        return out
    for sgen_idx, row in net.sgen.iterrows():
        sgen_id = _to_int(sgen_idx)
        out.append({
            "id": sgen_id,
            "busId": _to_int(row.bus),
            "name": str(row.get("name") or f"SGen {sgen_id}"),
            "pMw": _safe_float(row.get("p_mw")),
            "qMvar": _safe_float(row.get("q_mvar")),
            "inService": bool(row.get("in_service", True)),
        })
    return out


def serialize_ext_grids(net: pp.pandapowerNet) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    if not hasattr(net, "ext_grid") or net.ext_grid.empty:
        return out
    for eg_idx, row in net.ext_grid.iterrows():
        eg_id = _to_int(eg_idx)
        out.append({
            "id": eg_id,
            "busId": _to_int(row.bus),
            "name": str(row.get("name") or f"Slack {eg_id}"),
            "vmPu": _safe_float(row.get("vm_pu")),
            "vaDeg": _safe_float(row.get("va_degree")),
            "inService": bool(row.get("in_service", True)),
        })
    return out


def serialize_shunts(net: pp.pandapowerNet) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    if not hasattr(net, "shunt") or net.shunt.empty:
        return out
    for sh_idx, row in net.shunt.iterrows():
        sh_id = _to_int(sh_idx)
        out.append({
            "id": sh_id,
            "busId": _to_int(row.bus),
            "name": str(row.get("name") or f"Shunt {sh_id}"),
            "pMw": _safe_float(row.get("p_mw")),
            "qMvar": _safe_float(row.get("q_mvar")),
            "step": _to_int(row.get("step") or 0),
            "inService": bool(row.get("in_service", True)),
        })
    return out


def _bus_load(net: pp.pandapowerNet, bus_id: int) -> tuple[float, float]:
    if net.load.empty:
        return 0.0, 0.0
    mask = net.load.bus == bus_id
    load_mw = float(net.load.loc[mask, "p_mw"].sum())
    load_mvar = float(net.load.loc[mask, "q_mvar"].sum()) if "q_mvar" in net.load.columns else 0.0
    return load_mw, load_mvar


def _bus_type(bus_id: int, slack_buses: set[int], gen_buses: set[int]) -> str:
    if bus_id in slack_buses:
        return "Slack"
    if bus_id in gen_buses:
        return "PV"
    return "PQ"


def _geo_length(
    geo_positions: dict[int, tuple[float, float]],
    from_bus: int,
    to_bus: int,
) -> float | None:
    a = geo_positions.get(from_bus)
    b = geo_positions.get(to_bus)
    if a and b:
        return round(haversine_km(a, b), 3)
    return None


def _line_switch_details(
    net: pp.pandapowerNet, bus_id: int, element_id: int
) -> tuple[int, str, str, str]:
    line = net.line.loc[element_id]
    from_bus = _to_int(line.from_bus)
    to_bus = _to_int(line.to_bus)
    remote_bus_id = to_bus if bus_id == from_bus else from_bus
    return (
        remote_bus_id,
        str(net.bus.at[remote_bus_id, "name"]),
        str(line["name"]),
        "line",
    )


def _trafo_switch_details(
    net: pp.pandapowerNet, bus_id: int, element_id: int
) -> tuple[int, str, str, str]:
    trafo = net.trafo.loc[element_id]
    hv_bus = _to_int(trafo.hv_bus)
    lv_bus = _to_int(trafo.lv_bus)
    remote_bus_id = lv_bus if bus_id == hv_bus else hv_bus
    return (
        remote_bus_id,
        str(net.bus.at[remote_bus_id, "name"]),
        str(trafo["name"]),
        "trafo",
    )
