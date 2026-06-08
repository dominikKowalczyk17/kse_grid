"""Voltage and loading diagnostics for the network."""

from __future__ import annotations

from typing import Any

import pandapower as pp

from kse_grid.thresholds import LOAD_BAD_PCT, LOAD_WARN_PCT, VOLTAGE_OK_MAX, VOLTAGE_OK_MIN
from kse_grid.type_coercion import to_float as _to_float
from kse_grid.type_coercion import to_int as _to_int

_EMPTY_VOLTAGE = {
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


def compute_diagnostics(net: pp.pandapowerNet) -> dict[str, Any]:
    return {
        "voltage": _compute_voltage_diagnostics(net),
        "loading": _compute_loading_diagnostics(net),
    }


def _compute_voltage_diagnostics(net: pp.pandapowerNet) -> dict[str, Any]:
    if net.res_bus.empty:
        return _EMPTY_VOLTAGE

    vm = net.res_bus["vm_pu"].dropna()
    if vm.empty:
        return _EMPTY_VOLTAGE

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
        "lowCount": int((vm < VOLTAGE_OK_MIN).sum()),
        "highCount": int((vm > VOLTAGE_OK_MAX).sum()),
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
        overloaded += int((line_loading >= LOAD_BAD_PCT).sum())
        heavy += int(((line_loading >= LOAD_WARN_PCT) & (line_loading < LOAD_BAD_PCT)).sum())
        if not line_loading.empty:
            idx = _to_int(line_loading.idxmax())
            value = float(line_loading.loc[idx])
            if value >= max_pct:
                max_pct, max_kind, max_id, max_name = value, "line", idx, str(net.line.at[idx, "name"])

    if not net.res_trafo.empty:
        trafo_loading = net.res_trafo["loading_percent"].fillna(0.0)
        overloaded += int((trafo_loading >= LOAD_BAD_PCT).sum())
        heavy += int(((trafo_loading >= LOAD_WARN_PCT) & (trafo_loading < LOAD_BAD_PCT)).sum())
        if not trafo_loading.empty:
            idx = _to_int(trafo_loading.idxmax())
            value = float(trafo_loading.loc[idx])
            if value >= max_pct:
                max_pct, max_kind, max_id, max_name = value, "trafo", idx, str(net.trafo.at[idx, "name"])

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
