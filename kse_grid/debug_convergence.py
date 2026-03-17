"""
Diagnostyka braku zbieżności load flow w modelu KSE.
Uruchom ten skrypt zamiast main.py żeby znaleźć przyczynę.
"""

import pandapower as pp
import pandas as pd
import kse_grid


def check_power_balance(net: pp.pandapowerNet):
    print("\n=== 1. BILANS MOCY (przed load flow) ===")
    p_gen  = net.gen["p_mw"].sum()
    p_load = net.load["p_mw"].sum()
    q_load = net.load["q_mvar"].sum()
    q_shunt = net.shunt["q_mvar"].sum()  # ujemne = pojemnościowe = dostarcza Q
    print(f"  Generacja PV:      {p_gen:>8.1f} MW")
    print(f"  Obciążenia P:      {p_load:>8.1f} MW")
    print(f"  Różnica P:         {p_gen - p_load:>8.1f} MW  (slack musi pokryć)")
    print(f"  Obciążenia Q:      {q_load:>8.1f} MVAr")
    print(f"  Kompensacja Q:     {q_shunt:>8.1f} MVAr")
    print(f"  Netto Q:           {q_load + q_shunt:>8.1f} MVAr")


def check_connectivity(net: pp.pandapowerNet):
    print("\n=== 2. SPÓJNOŚĆ SIECI ===")
    buses_not_connected = []
    for idx in net.bus.index:
        # sprawdź czy szyna ma co najmniej jedno połączenie
        in_line_from = (net.line["from_bus"] == idx).any()
        in_line_to   = (net.line["to_bus"] == idx).any()
        in_trafo_hv  = (net.trafo["hv_bus"] == idx).any()
        in_trafo_lv  = (net.trafo["lv_bus"] == idx).any()
        if not (in_line_from or in_line_to or in_trafo_hv or in_trafo_lv):
            buses_not_connected.append(net.bus.loc[idx, "name"])

    if buses_not_connected:
        print(f"  ❌ Szyny bez połączeń: {buses_not_connected}")
    else:
        print(f"  ✅ Wszystkie szyny mają połączenia")

    # sprawdź szyny bez generatora, slacka i obciążenia (floating)
    gen_buses   = set(net.gen["bus"].tolist()) | set(net.ext_grid["bus"].tolist())
    load_buses  = set(net.load["bus"].tolist()) | set(net.shunt["bus"].tolist())
    all_buses   = set(net.bus.index.tolist())
    floating    = all_buses - gen_buses - load_buses
    if floating:
        names = [net.bus.loc[i, "name"] for i in floating]
        print(f"  ⚠️  Szyny bez gen/load/shunt (floating PQ=0): {names}")


def check_voltage_levels(net: pp.pandapowerNet):
    print("\n=== 3. SPRAWDZENIE NAPIĘĆ ZNAMIONOWYCH ===")
    # Linie – czy napięcie szyny zgadza się z typem linii?
    issues = []
    for idx, line in net.line.iterrows():
        vn_from = net.bus.loc[line.from_bus, "vn_kv"]
        vn_to   = net.bus.loc[line.to_bus,   "vn_kv"]
        if vn_from != vn_to:
            issues.append(f"  ❌ Linia '{line['name']}': {vn_from}kV → {vn_to}kV (różne napięcia!)")
    if issues:
        for i in issues:
            print(i)
    else:
        print("  ✅ Wszystkie linie łączą szyny tego samego napięcia")

    # Trafos – czy hv_bus > lv_bus?
    trafo_issues = []
    for idx, tr in net.trafo.iterrows():
        vn_hv = net.bus.loc[tr.hv_bus, "vn_kv"]
        vn_lv = net.bus.loc[tr.lv_bus, "vn_kv"]
        if vn_hv < vn_lv:
            trafo_issues.append(f"  ❌ Trafo '{tr['name']}': hv={vn_hv}kV < lv={vn_lv}kV (odwrócone!)")
    if trafo_issues:
        for i in trafo_issues:
            print(i)
    else:
        print("  ✅ Wszystkie trafos mają poprawną orientację hv/lv")


def try_dc_powerflow(net: pp.pandapowerNet):
    print("\n=== 4. DC POWER FLOW (test spójności topologicznej) ===")
    try:
        pp.rundcpp(net)
        bus_res = net.res_bus[["vm_pu", "va_degree"]].copy()
        bus_res["name"] = net.bus["name"]
        bad = bus_res[bus_res["va_degree"].abs() > 30]
        if not bad.empty:
            print("  ⚠️  Szyny z dużym kątem (>30°) – potencjalnie słabo połączone:")
            print(bad.to_string())
        else:
            print("  ✅ DC power flow zbiegł – topologia spójna")
            print(f"     Zakres kątów: {bus_res['va_degree'].min():.2f}° ... {bus_res['va_degree'].max():.2f}°")
    except Exception as e:
        print(f"  ❌ DC power flow też nie zbiegł: {e}")


def try_reduced_load(net: pp.pandapowerNet):
    print("\n=== 5. TEST Z OBCIĄŻENIEM 10% (izolacja problemu Q) ===")
    import copy
    net_test = copy.deepcopy(net)
    net_test.load["p_mw"]   *= 0.1
    net_test.load["q_mvar"] *= 0.1
    try:
        pp.runpp(net_test, algorithm="nr", init="flat", max_iteration=50, tolerance_mva=1.0)
        print("  ✅ Zbiegł przy 10% obciążenia – problem to skala Q lub brak generacji reaktywnej")
    except pp.auxiliary.LoadflowNotConverged:
        print("  ❌ Nie zbiegł nawet przy 10% – problem topologiczny lub złe parametry")


def gen_q_limits(net: pp.pandapowerNet):
    print("\n=== 6. GENERATORY – limity Q ===")
    print("  (generatory PV regulują napięcie, muszą mieć limity Q lub będą nieograniczone)")
    for idx, g in net.gen.iterrows():
        q_min = g.get("min_q_mvar", "brak")
        q_max = g.get("max_q_mvar", "brak")
        print(f"  {g['name']:<30} Q=[{q_min}, {q_max}]")


def try_load_scaling(net):
    import copy
    print("\n=== 7. LOAD SCALING ===")
    net_test = copy.deepcopy(net)
    p_base = net_test.load["p_mw"].copy()
    q_base = net_test.load["q_mvar"].copy()
    last_converged = 0.0
    for scale in [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0]:
        net_test.load["p_mw"]   = p_base * scale
        net_test.load["q_mvar"] = q_base * scale
        try:
            init = "flat" if scale == 0.1 else "results"
            pp.runpp(net_test, algorithm="nr", init=init,
                     max_iteration=50, tolerance_mva=1.0)
            last_converged = scale
            vmin = net_test.res_bus["vm_pu"].min()
            vmax = net_test.res_bus["vm_pu"].max()
            print(f"  {scale*100:5.0f}% ✅  U=[{vmin:.3f}, {vmax:.3f}] pu")
        except pp.auxiliary.LoadflowNotConverged:
            print(f"  {scale*100:5.0f}% ❌  (ostatni zbieżny: {last_converged*100:.0f}%)")
            break


def try_no_q_limits(net):
    import copy
    print("\n=== 8. BEZ Q LIMITS (enforce_q_lims=False) ===")
    net_test = copy.deepcopy(net)
    try:
        pp.runpp(net_test, algorithm="nr", init="dc",
                 max_iteration=100, tolerance_mva=1.0,
                 enforce_q_lims=False)
        vmin = net_test.res_bus["vm_pu"].min()
        vmax = net_test.res_bus["vm_pu"].max()
        print(f"  ✅ Zbiegł bez Q limits! U=[{vmin:.3f}, {vmax:.3f}] pu")
        print(f"  → Problem leży w PV→PQ switching gdy generatory saturują Q")
        # Pokaż które generatory przekroczyły Q
        q_res = net_test.res_gen[["q_mvar"]].copy()
        q_res["name"]      = net_test.gen["name"]
        q_res["max_q_mvar"] = net_test.gen["max_q_mvar"]
        q_res["min_q_mvar"] = net_test.gen["min_q_mvar"]
        q_res["saturated"]  = (q_res["q_mvar"] > q_res["max_q_mvar"]) | \
                               (q_res["q_mvar"] < q_res["min_q_mvar"])
        print("\n  Generatory Q:")
        print(q_res.to_string())
    except pp.auxiliary.LoadflowNotConverged:
        print(f"  ❌ Nie zbiegł nawet bez Q limits → problem nie jest w PV→PQ switching")
        print(f"  → Sprawdź impedancje trafo lub topologię")

if __name__ == "__main__":
    print("Buduję sieć...")
    grid = kse_grid.KSEGrid().build()
    net  = grid.net

    check_power_balance(net)
    check_connectivity(net)
    check_voltage_levels(net)
    gen_q_limits(net)
    try_dc_powerflow(net)
    try_reduced_load(net)
    try_load_scaling(net)
    try_no_q_limits(net)