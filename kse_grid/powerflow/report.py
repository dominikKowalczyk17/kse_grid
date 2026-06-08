"""Terminal presentation of load flow results."""

from __future__ import annotations

import pandapower as pp
import pandas as pd


def print_load_flow_summary(net: pp.pandapowerNet) -> None:
    sep = "=" * 65
    print(sep)
    print(f"  Network model – {getattr(net, 'name', 'pandapower')}")
    print(sep)
    _print_power_balance(net)
    _print_voltage_deviations(net)
    _print_top_loaded_lines(net)
    _print_transformers(net)
    _print_overload_summary(net)


def voltage_violations(net: pp.pandapowerNet) -> pd.DataFrame:
    """Return a DataFrame of buses outside the ±5% Un band."""
    res = net.res_bus[["vm_pu"]].copy()
    res["name"] = net.bus["name"]
    res["vn_kv"] = net.bus["vn_kv"]
    return res[(res.vm_pu < 0.95) | (res.vm_pu > 1.05)]


def _print_power_balance(net: pp.pandapowerNet) -> None:
    p_gen = net.res_gen["p_mw"].sum() if len(net.res_gen) else 0.0
    p_ext = net.res_ext_grid["p_mw"].sum() if len(net.res_ext_grid) else 0.0
    p_load = net.res_load["p_mw"].sum() if len(net.res_load) else 0.0
    p_loss = (
        (net.res_line["pl_mw"].sum() if len(net.res_line) else 0.0) +
        (net.res_trafo["pl_mw"].sum() if len(net.res_trafo) else 0.0)
    )
    print("\n📊 POWER BALANCE:")
    print(f"   Generation (PV): {p_gen:>8.1f} MW")
    print(f"   Import/Slack:    {p_ext:>8.1f} MW")
    print(f"   Load:            {p_load:>8.1f} MW")
    print(f"   Losses:          {p_loss:>8.1f} MW")


def _print_voltage_deviations(net: pp.pandapowerNet) -> None:
    bus_res = net.res_bus[["vm_pu", "va_degree"]].copy()
    bus_res["name"] = net.bus["name"]
    bus_res["vn_kv"] = net.bus["vn_kv"]
    bus_res["deviation"] = (bus_res["vm_pu"] - 1.0).abs()
    print("\n⚡ VOLTAGES – largest deviations:")
    print(f"   {'Substation':<35} {'kV':>6}  {'Um [p.u.]':>9}  {'δ [°]':>8}")
    print(f"   {'-'*35} {'-'*8}  {'-'*8}")
    for _, row in bus_res.sort_values("deviation", ascending=False).head(10).iterrows():
        flag = " ⚠️" if row.vm_pu < 0.95 or row.vm_pu > 1.05 else ""
        print(f"   {row['name']:<35} {row.vn_kv:>6.0f}  {row.vm_pu:>8.4f}  {row.va_degree:>8.2f}{flag}")


def _print_top_loaded_lines(net: pp.pandapowerNet) -> None:
    line_res = net.res_line[["p_from_mw", "loading_percent"]].copy()
    line_res["name"] = net.line["name"]
    line_res["vn_kv"] = net.bus.loc[net.line["from_bus"], "vn_kv"].to_numpy()
    print("\n🔌 LINES – TOP 10 most loaded:")
    print(f"   {'Line':<45} {'kV':>6}  {'P [MW]':>8}  {'Loading [%]':>11}")
    print(f"   {'-'*45} {'-'*8}  {'-'*11}")
    for _, row in line_res.sort_values("loading_percent", ascending=False).head(10).iterrows():
        flag = " 🔴" if row.loading_percent > 80 else (" 🟡" if row.loading_percent > 60 else "")
        print(f"   {row['name']:<45} {row.vn_kv:>6.0f}  {row.p_from_mw:>8.1f}  {row.loading_percent:>10.1f}%{flag}")


def _print_transformers(net: pp.pandapowerNet) -> None:
    trafo_res = net.res_trafo[["p_hv_mw", "loading_percent"]].copy()
    trafo_res["name"] = net.trafo["name"]
    print("\n🔄 TRANSFORMERS:")
    print(f"   {'Trafo':<40} {'P_HV [MW]':>10}  {'Loading [%]':>11}")
    print(f"   {'-'*40} {'-'*10}  {'-'*11}")
    for _, row in trafo_res.sort_values("loading_percent", ascending=False).head(10).iterrows():
        flag = " 🔴" if row.loading_percent > 80 else ""
        print(f"   {row['name']:<40} {row.p_hv_mw:>10.1f}  {row.loading_percent:>10.1f}%{flag}")


def _print_overload_summary(net: pp.pandapowerNet) -> None:
    overloaded_lines = net.res_line[net.res_line["loading_percent"] > 80]
    overloaded_trafos = net.res_trafo[net.res_trafo["loading_percent"] > 80]
    print("\n📋 SUMMARY:")
    if len(overloaded_lines) == 0 and len(overloaded_trafos) == 0:
        print("   ✅ No overloads (loading < 80%)")
    else:
        if len(overloaded_lines) > 0:
            print(f"   ⚠️  Overloaded lines:  {len(overloaded_lines)}")
        if len(overloaded_trafos) > 0:
            print(f"   ⚠️  Overloaded trafos: {len(overloaded_trafos)}")
    print()
