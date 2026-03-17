import pandapower as pp
import pandas as pd


class PowerFlowRunner:
    """Uruchamia obliczenia load flow i raportuje wyniki."""

    def __init__(self, net: pp.pandapowerNet):
        self.net = net

    # ------------------------------------------------------------------
    def run(self,
            algorithm: str = "iwamoto_nr",
            max_iteration: int = 100,
            tolerance_mva: float = 1.0) -> bool:
        """
        Uruchamia load flow z inicjalizacją DC.
        Zwraca True jeśli zbieżny, False jeśli nie.
        """
        try:
            pp.runpp(
                self.net,
                algorithm=algorithm,
                calculate_voltage_angles=True,
                max_iteration=max_iteration,
                init="dc",
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
        print("  Model KSE – Polska sieć przesyłowa 400/220 kV")
        print(sep)

        # --- Bilans mocy ---
        p_gen  = net.res_gen["p_mw"].sum()
        p_ext  = net.res_ext_grid["p_mw"].sum()
        p_load = net.res_load["p_mw"].sum()
        p_loss = net.res_line["pl_mw"].sum() + net.res_trafo["pl_mw"].sum()
        print(f"\n📊 BILANS MOCY:")
        print(f"   Generacja (PV):  {p_gen:>8.1f} MW")
        print(f"   Import/Slack:    {p_ext:>8.1f} MW")
        print(f"   Obciążenie:      {p_load:>8.1f} MW")
        print(f"   Straty:          {p_loss:>8.1f} MW")

        # --- Napięcia – szyny 400 kV ---
        buses_400 = net.bus[net.bus.vn_kv == 400].index
        res_400 = net.res_bus.loc[buses_400, ["vm_pu", "va_degree"]].copy()
        res_400["nazwa"] = net.bus.loc[buses_400, "name"]
        print(f"\n⚡ NAPIĘCIA – SZYNY 400 kV:")
        print(f"   {'Stacja':<35} {'U [p.u.]':>8}  {'δ [°]':>8}")
        print(f"   {'-'*35} {'-'*8}  {'-'*8}")
        for _, row in res_400.sort_values("vm_pu").iterrows():
            flag = " ⚠️" if row.vm_pu < 0.95 or row.vm_pu > 1.05 else ""
            print(f"   {row.nazwa:<35} {row.vm_pu:>8.4f}  {row.va_degree:>8.2f}{flag}")

        # --- Obciążenie linii 400 kV (top 10) ---
        line_res = net.res_line[["p_from_mw", "loading_percent"]].copy()
        line_res["nazwa"] = net.line["name"]
        lines_400 = line_res[line_res["nazwa"].str.contains("400kV")]
        print(f"\n🔌 LINIE 400 kV – TOP 10 obciążonych:")
        print(f"   {'Linia':<45} {'P [MW]':>8}  {'Obciąż. [%]':>11}")
        print(f"   {'-'*45} {'-'*8}  {'-'*11}")
        for _, row in lines_400.sort_values("loading_percent", ascending=False).head(10).iterrows():
            flag = " 🔴" if row.loading_percent > 80 else (" 🟡" if row.loading_percent > 60 else "")
            print(f"   {row.nazwa:<45} {row.p_from_mw:>8.1f}  {row.loading_percent:>10.1f}%{flag}")

        # --- Autotransformatory ---
        trafo_res = net.res_trafo[["p_hv_mw", "loading_percent"]].copy()
        trafo_res["nazwa"] = net.trafo["name"]
        print(f"\n🔄 AUTOTRANSFORMATORY 400/220 kV:")
        print(f"   {'AT':<40} {'P_HV [MW]':>10}  {'Obciąż. [%]':>11}")
        print(f"   {'-'*40} {'-'*10}  {'-'*11}")
        for _, row in trafo_res.sort_values("loading_percent", ascending=False).iterrows():
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