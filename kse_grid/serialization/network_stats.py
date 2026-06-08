"""Computing network statistics and power balances."""

from __future__ import annotations

from typing import Any

import pandapower as pp

from kse_grid.thresholds import LOAD_BAD_PCT, LOAD_WARN_PCT, VOLTAGE_OK_MAX, VOLTAGE_OK_MIN
from kse_grid.type_coercion import to_int as _to_int


def compute_stats(net: pp.pandapowerNet) -> dict[str, Any]:
    max_loading = _max_loading(net)
    n_viol = _count_voltage_violations(net)
    n_overload = _count_overloads(net)
    return {
        "nBus": int(len(net.bus)),
        "nLine": int(len(net.line)),
        "nTrafo": int(len(net.trafo)),
        "nGen": int(len(net.gen)),
        "maxLoading": f"{max_loading:.1f}%",
        "loadClass": _status(max_loading, LOAD_WARN_PCT, LOAD_BAD_PCT),
        "nViol": n_viol,
        "violClass": _status(float(n_viol), 1.0, 5.0),
        "nOverload": n_overload,
        "ovlClass": _status(float(n_overload), 1.0, 5.0),
    }


def compute_totals(net: pp.pandapowerNet) -> dict[str, Any]:
    p_gen = _sum_generation(net)
    p_slack = _sum_slack(net)
    p_load = _sum_load(net)
    p_loss = _sum_losses(net)

    q_gen = _sum_q_generation(net)
    q_slack = _sum_q_slack(net)
    q_load = _sum_q_load(net)
    q_loss = _sum_q_losses(net)

    slack_id = _find_slack_bus_id(net)
    gen_units = _count_gen_units(net)

    total_gen = p_gen + p_slack
    loss_pct = (p_loss / total_gen * 100.0) if total_gen > 0 else None

    return {
        "loadMw": p_load,
        "generationMw": total_gen,
        "slackMw": p_slack,
        "lossesMw": p_loss,
        "lossPct": loss_pct,
        "qLoadMvar": q_load,
        "qGenerationMvar": q_gen + q_slack,
        "qSlackMvar": q_slack,
        "qLossesMvar": q_loss,
        "slackBusId": slack_id,
        "genUnits": gen_units,
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
    return int(((vm < VOLTAGE_OK_MIN) | (vm > VOLTAGE_OK_MAX)).sum())


def _count_overloads(net: pp.pandapowerNet) -> int:
    total = 0
    if not net.res_line.empty:
        total += int((net.res_line["loading_percent"].fillna(0.0) > LOAD_BAD_PCT).sum())
    if not net.res_trafo.empty:
        total += int((net.res_trafo["loading_percent"].fillna(0.0) > LOAD_BAD_PCT).sum())
    return total


def _status(value: float, warn: float, bad: float) -> str:
    if value >= bad:
        return "bad"
    if value >= warn:
        return "warn"
    return "good"


def _sum_generation(net: pp.pandapowerNet) -> float:
    total = 0.0
    if hasattr(net, "res_gen") and not net.res_gen.empty and "p_mw" in net.res_gen.columns:
        total += float(net.res_gen["p_mw"].fillna(0.0).sum())
    if hasattr(net, "res_sgen") and not net.res_sgen.empty and "p_mw" in net.res_sgen.columns:
        total += float(net.res_sgen["p_mw"].fillna(0.0).sum())
    return total


def _sum_slack(net: pp.pandapowerNet) -> float:
    total = 0.0
    if hasattr(net, "res_ext_grid") and not net.res_ext_grid.empty and "p_mw" in net.res_ext_grid.columns:
        total += float(net.res_ext_grid["p_mw"].fillna(0.0).sum())
    if hasattr(net, "res_gen") and not net.res_gen.empty and "p_mw" in net.res_gen.columns:
        slack_mask = net.gen["slack"].fillna(False).astype(bool) if "slack" in net.gen.columns else None
        if slack_mask is not None and slack_mask.any():
            total += float(net.res_gen.loc[slack_mask, "p_mw"].fillna(0.0).sum())
    return total


def _sum_load(net: pp.pandapowerNet) -> float:
    if hasattr(net, "res_load") and not net.res_load.empty:
        return float(net.res_load["p_mw"].fillna(0.0).sum())
    return 0.0


def _sum_losses(net: pp.pandapowerNet) -> float:
    total = 0.0
    if hasattr(net, "res_line") and not net.res_line.empty and "pl_mw" in net.res_line.columns:
        total += float(net.res_line["pl_mw"].fillna(0.0).sum())
    if hasattr(net, "res_trafo") and not net.res_trafo.empty and "pl_mw" in net.res_trafo.columns:
        total += float(net.res_trafo["pl_mw"].fillna(0.0).sum())
    if hasattr(net, "res_trafo3w") and not net.res_trafo3w.empty and "pl_mw" in net.res_trafo3w.columns:
        total += float(net.res_trafo3w["pl_mw"].fillna(0.0).sum())
    return total


def _find_slack_bus_id(net: pp.pandapowerNet) -> int | None:
    if not net.ext_grid.empty:
        active = net.ext_grid["in_service"].fillna(False).astype(bool) if "in_service" in net.ext_grid.columns else None
        if active is not None and active.any():
            return _to_int(net.ext_grid.loc[active].iloc[0]["bus"])
        if len(net.ext_grid):
            return _to_int(net.ext_grid.iloc[0]["bus"])
    if not net.gen.empty and "slack" in net.gen.columns:
        slack_gen = net.gen.loc[net.gen["slack"].fillna(False).astype(bool)]
        if not slack_gen.empty:
            return _to_int(slack_gen.iloc[0]["bus"])
    return None


def _sum_q_load(net: pp.pandapowerNet) -> float:
    if hasattr(net, "res_load") and not net.res_load.empty and "q_mvar" in net.res_load.columns:
        return float(net.res_load["q_mvar"].fillna(0.0).sum())
    return 0.0


def _sum_q_generation(net: pp.pandapowerNet) -> float:
    total = 0.0
    if hasattr(net, "res_gen") and not net.res_gen.empty and "q_mvar" in net.res_gen.columns:
        total += float(net.res_gen["q_mvar"].fillna(0.0).sum())
    if hasattr(net, "res_sgen") and not net.res_sgen.empty and "q_mvar" in net.res_sgen.columns:
        total += float(net.res_sgen["q_mvar"].fillna(0.0).sum())
    return total


def _sum_q_slack(net: pp.pandapowerNet) -> float:
    total = 0.0
    if hasattr(net, "res_ext_grid") and not net.res_ext_grid.empty and "q_mvar" in net.res_ext_grid.columns:
        total += float(net.res_ext_grid["q_mvar"].fillna(0.0).sum())
    if hasattr(net, "res_gen") and not net.res_gen.empty and "q_mvar" in net.res_gen.columns:
        slack_mask = net.gen["slack"].fillna(False).astype(bool) if "slack" in net.gen.columns else None
        if slack_mask is not None and slack_mask.any():
            total += float(net.res_gen.loc[slack_mask, "q_mvar"].fillna(0.0).sum())
    return total


def _sum_q_losses(net: pp.pandapowerNet) -> float:
    total = 0.0
    if hasattr(net, "res_line") and not net.res_line.empty and "ql_mvar" in net.res_line.columns:
        total += float(net.res_line["ql_mvar"].fillna(0.0).sum())
    if hasattr(net, "res_trafo") and not net.res_trafo.empty and "ql_mvar" in net.res_trafo.columns:
        total += float(net.res_trafo["ql_mvar"].fillna(0.0).sum())
    if hasattr(net, "res_trafo3w") and not net.res_trafo3w.empty and "ql_mvar" in net.res_trafo3w.columns:
        total += float(net.res_trafo3w["ql_mvar"].fillna(0.0).sum())
    return total


def _count_gen_units(net: pp.pandapowerNet) -> int:
    total = 0
    if not net.ext_grid.empty:
        total += int(net.ext_grid["in_service"].fillna(True).astype(bool).sum()) if "in_service" in net.ext_grid.columns else int(len(net.ext_grid))
    if not net.gen.empty:
        total += int(net.gen["in_service"].fillna(True).astype(bool).sum()) if "in_service" in net.gen.columns else int(len(net.gen))
    if hasattr(net, "sgen") and not net.sgen.empty:
        total += int(net.sgen["in_service"].fillna(True).astype(bool).sum()) if "in_service" in net.sgen.columns else int(len(net.sgen))
    return total
