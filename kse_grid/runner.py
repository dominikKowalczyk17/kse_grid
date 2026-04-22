import pandapower as pp
import pandas as pd


class PowerFlowRunner:
    """Uruchamia obliczenia load flow i raportuje wyniki."""

    def __init__(self, net: pp.pandapowerNet):
        self.net = net

    # ------------------------------------------------------------------
    def run(self,
            algorithm: str = "nr",
            max_iteration: int = 100,
            tolerance_mva: float = 1.0) -> bool:
        """
        Uruchamia load flow z inicjalizacją AC (flat start: U=1 p.u., kąt=0°).
        Zwraca True jeśli zbieżny, False jeśli nie.
        """
        try:
            pp.runpp(
                self.net,
                algorithm=algorithm,
                calculate_voltage_angles=True,
                max_iteration=max_iteration,
                init="flat",
                tolerance_mva=tolerance_mva,
            )
            return True
        except pp.auxiliary.LoadflowNotConverged:
            print(f"❌ Load flow nie zbiegł po {max_iteration} iteracjach!")
            return False

    # ------------------------------------------------------------------
    def summary(self):
        """Drukuje sformatowane podsumowanie wyników load flow."""
        net = self.net
        sep = "=" * 65

        print(sep)
        print(f"  Model sieci – {getattr(net, 'name', 'pandapower')}")
        print(sep)

        # --- Bilans mocy ---
        p_gen = net.res_gen["p_mw"].sum() if len(net.res_gen) else 0.0
        p_ext = net.res_ext_grid["p_mw"].sum() if len(net.res_ext_grid) else 0.0
        p_load = net.res_load["p_mw"].sum() if len(net.res_load) else 0.0
        p_loss = (
            (net.res_line["pl_mw"].sum() if len(net.res_line) else 0.0) +
            (net.res_trafo["pl_mw"].sum() if len(net.res_trafo) else 0.0)
        )
        print(f"\n📊 BILANS MOCY:")
        print(f"   Generacja (PV):  {p_gen:>8.1f} MW")
        print(f"   Import/Slack:    {p_ext:>8.1f} MW")
        print(f"   Obciążenie:      {p_load:>8.1f} MW")
        print(f"   Straty:          {p_loss:>8.1f} MW")

        # --- Napięcia – największe odchylenia ---
        bus_res = net.res_bus[["vm_pu", "va_degree"]].copy()
        bus_res["nazwa"] = net.bus["name"]
        bus_res["vn_kv"] = net.bus["vn_kv"]
        bus_res["odchylenie"] = (bus_res["vm_pu"] - 1.0).abs()
        print(f"\n⚡ NAPIĘCIA – największe odchylenia:")
        print(f"   {'Stacja':<35} {'kV':>6}  {'Um [p.u.]':>9}  {'δ [°]':>8}")
        print(f"   {'-'*35} {'-'*8}  {'-'*8}")
        for _, row in bus_res.sort_values("odchylenie", ascending=False).head(10).iterrows():
            flag = " ⚠️" if row.vm_pu < 0.95 or row.vm_pu > 1.05 else ""
            print(f"   {row.nazwa:<35} {row.vn_kv:>6.0f}  {row.vm_pu:>8.4f}  {row.va_degree:>8.2f}{flag}")

        # --- Obciążenie linii (top 10) ---
        line_res = net.res_line[["p_from_mw", "loading_percent"]].copy()
        line_res["nazwa"] = net.line["name"]
        line_res["vn_kv"] = net.bus.loc[net.line["from_bus"], "vn_kv"].to_numpy()
        print(f"\n🔌 LINIE – TOP 10 obciążonych:")
        print(f"   {'Linia':<45} {'kV':>6}  {'P [MW]':>8}  {'Obciąż. [%]':>11}")
        print(f"   {'-'*45} {'-'*8}  {'-'*11}")
        for _, row in line_res.sort_values("loading_percent", ascending=False).head(10).iterrows():
            flag = " 🔴" if row.loading_percent > 80 else (" 🟡" if row.loading_percent > 60 else "")
            print(f"   {row.nazwa:<45} {row.vn_kv:>6.0f}  {row.p_from_mw:>8.1f}  {row.loading_percent:>10.1f}%{flag}")

        # --- Transformatory ---
        trafo_res = net.res_trafo[["p_hv_mw", "loading_percent"]].copy()
        trafo_res["nazwa"] = net.trafo["name"]
        print(f"\n🔄 TRANSFORMATORY:")
        print(f"   {'Trafo':<40} {'P_HV [MW]':>10}  {'Obciąż. [%]':>11}")
        print(f"   {'-'*40} {'-'*10}  {'-'*11}")
        for _, row in trafo_res.sort_values("loading_percent", ascending=False).head(10).iterrows():
            flag = " 🔴" if row.loading_percent > 80 else ""
            print(f"   {row.nazwa:<40} {row.p_hv_mw:>10.1f}  {row.loading_percent:>10.1f}%{flag}")

        # --- Podsumowanie przeciążeń ---
        overloaded_lines  = net.res_line[net.res_line["loading_percent"] > 80]
        overloaded_trafos = net.res_trafo[net.res_trafo["loading_percent"] > 80]
        print(f"\n📋 PODSUMOWANIE:")
        if len(overloaded_lines) == 0 and len(overloaded_trafos) == 0:
            print("   ✅ Brak przeciążeń (loading < 80%)")
        else:
            if len(overloaded_lines) > 0:
                print(f"   ⚠️  Przeciążone linie:  {len(overloaded_lines)}")
            if len(overloaded_trafos) > 0:
                print(f"   ⚠️  Przeciążone trafos: {len(overloaded_trafos)}")
        print()

    # ------------------------------------------------------------------
    def voltage_violations(self) -> pd.DataFrame:
        """Zwraca DataFrame z szynami poza pasmem ±5% Un."""
        res = self.net.res_bus[["vm_pu"]].copy()
        res["name"]  = self.net.bus["name"]
        res["vn_kv"] = self.net.bus["vn_kv"]
        return res[(res.vm_pu < 0.95) | (res.vm_pu > 1.05)]
