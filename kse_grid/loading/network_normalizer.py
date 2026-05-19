"""Normalizacja zaimportowanej sieci pandapower — nazwy elementów, bus referencyjny."""

from __future__ import annotations

import re

import pandapower as pp

from kse_grid.type_coercion import to_float as _to_float, to_int as _to_int

_DEFAULT_LINE_NAME_RE = re.compile(r"^(?:Line|Linia)\s+\d+:\s")
_DEFAULT_TRAFO_NAME_RE = re.compile(r"^Trafo\s+\d+:\s")


def normalize_network(net: pp.pandapowerNet) -> None:
    """Uzupełnia puste nazwy elementów i zapewnia poprawny bus referencyjny."""
    _fill_bus_names(net)
    _fill_line_names(net)
    _fill_trafo_names(net)
    _ensure_reference_bus(net)


def refresh_composite_names(net: pp.pandapowerNet) -> None:
    """Odświeża złożone nazwy linii i trafów po zmianie nazw szyn.

    Wywołać po zaaplikowaniu sidecaru GeoJSON, który może nadpisać nazwy szyn
    na czytelne nazwy stacji.
    """
    for line_idx, row in net.line.iterrows():
        current = str(net.line.at[line_idx, "name"] or "").strip()
        if current and not _DEFAULT_LINE_NAME_RE.match(current):
            continue
        from_name = net.bus.at[_to_int(row.from_bus), "name"]
        to_name = net.bus.at[_to_int(row.to_bus), "name"]
        net.line.at[line_idx, "name"] = f"Line {_to_int(line_idx) + 1}: {from_name} -> {to_name}"

    for trafo_idx, row in net.trafo.iterrows():
        current = str(net.trafo.at[trafo_idx, "name"] or "").strip()
        if current and not _DEFAULT_TRAFO_NAME_RE.match(current):
            continue
        hv_name = net.bus.at[_to_int(row.hv_bus), "name"]
        lv_name = net.bus.at[_to_int(row.lv_bus), "name"]
        net.trafo.at[trafo_idx, "name"] = f"Trafo {_to_int(trafo_idx) + 1}: {hv_name} -> {lv_name}"


def _fill_bus_names(net: pp.pandapowerNet) -> None:
    empty = net.bus["name"].fillna("").astype(str).str.strip().eq("")
    for bus_idx in net.bus.index[empty]:
        net.bus.at[bus_idx, "name"] = f"Bus {_to_int(bus_idx) + 1}"


def _fill_line_names(net: pp.pandapowerNet) -> None:
    empty = net.line["name"].fillna("").astype(str).str.strip().eq("")
    for line_idx in net.line.index[empty]:
        row = net.line.loc[line_idx]
        from_name = net.bus.at[_to_int(row.from_bus), "name"]
        to_name = net.bus.at[_to_int(row.to_bus), "name"]
        net.line.at[line_idx, "name"] = f"Line {_to_int(line_idx) + 1}: {from_name} -> {to_name}"


def _fill_trafo_names(net: pp.pandapowerNet) -> None:
    empty = net.trafo["name"].fillna("").astype(str).str.strip().eq("")
    for trafo_idx in net.trafo.index[empty]:
        row = net.trafo.loc[trafo_idx]
        hv_name = net.bus.at[_to_int(row.hv_bus), "name"]
        lv_name = net.bus.at[_to_int(row.lv_bus), "name"]
        net.trafo.at[trafo_idx, "name"] = f"Trafo {_to_int(trafo_idx) + 1}: {hv_name} -> {lv_name}"


def _ensure_reference_bus(net: pp.pandapowerNet) -> None:
    if _has_active_slack(net):
        return
    if _activate_ext_grid(net):
        return
    _promote_gen_to_slack(net)


def _has_active_slack(net: pp.pandapowerNet) -> bool:
    if not net.ext_grid.empty:
        if bool(net.ext_grid["in_service"].fillna(False).astype(bool).any()):
            return True
    if not net.gen.empty and "slack" in net.gen.columns:
        active_slack = net.gen["in_service"].fillna(False).astype(bool) & net.gen["slack"].fillna(False).astype(bool)
        if bool(active_slack.any()):
            return True
    return False


def _activate_ext_grid(net: pp.pandapowerNet) -> bool:
    if net.ext_grid.empty:
        return False
    bus_in_service = net.bus["in_service"].fillna(False).astype(bool)
    candidates = [
        idx for idx, row in net.ext_grid.iterrows()
        if int(row.bus) in bus_in_service.index and bool(bus_in_service.at[int(row.bus)])
    ]
    if candidates:
        net.ext_grid.at[candidates[0], "in_service"] = True
        return True
    return False


def _promote_gen_to_slack(net: pp.pandapowerNet) -> None:
    if net.gen.empty:
        return
    bus_in_service = net.bus["in_service"].fillna(False).astype(bool)
    candidates = [
        idx for idx, row in net.gen.iterrows()
        if int(row.bus) in bus_in_service.index and bool(bus_in_service.at[int(row.bus)])
    ]
    if not candidates:
        return
    gen_idx = candidates[0]
    net.gen.at[gen_idx, "in_service"] = True
    net.gen.at[gen_idx, "slack"] = True
    if "slack_weight" in net.gen.columns:
        slack_weight = net.gen.at[gen_idx, "slack_weight"]
        if slack_weight is None or slack_weight != slack_weight:
            net.gen.at[gen_idx, "slack_weight"] = 1.0
