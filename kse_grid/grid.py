from typing import Optional

import pandapower as pp

from kse_grid.topology import KSETopology
from kse_grid.builder import GridBuilder
from kse_grid.runner import PowerFlowRunner


class KSEGrid:
    """
    Fasada łącząca budowę sieci z obliczeniami load flow.

    Przykłady użycia
    ----------------
    # Standardowe uruchomienie (fluent interface):
        import kse_grid
        kse_grid.KSEGrid().build().run_powerflow().report()

    # Dostęp do surowej sieci pandapower:
        grid = kse_grid.KSEGrid().build().run_powerflow()
        net = grid.net

    # Custom topologia (np. nowa linia):
        import kse_grid
        topo = kse_grid.KSETopology()
        topo.LINES_400KV.append(
            kse_grid.LineConfig("Żarnowiec 400kV", "Dunowo 400kV", 80,
                                kse_grid.KSETopology.LT400, "LNN Offshore Bałtyk 400kV")
        )
        kse_grid.KSEGrid(topo).build().run_powerflow().report()
    """

    def __init__(self, topology: Optional[KSETopology] = None):
        self.topology = topology or KSETopology()
        self.net: Optional[pp.pandapowerNet] = None
        self._runner: Optional[PowerFlowRunner] = None
        self._converged: bool = False

    # ------------------------------------------------------------------
    def build(self) -> "KSEGrid":
        """Buduje sieć pandapower z danych topologicznych."""
        builder = GridBuilder(self.topology)
        self.net = builder.build()
        self._print_build_summary()
        return self

    # ------------------------------------------------------------------
    def run_powerflow(self,
                      algorithm: str = "iwamoto_nr",
                      max_iteration: int = 100,
                      tolerance_mva: float = 1.0) -> "KSEGrid":
        """Uruchamia obliczenia load flow."""
        if self.net is None:
            raise RuntimeError("Wywołaj najpierw build()")
        self._runner = PowerFlowRunner(self.net)
        self._converged = self._runner.run(algorithm, max_iteration, tolerance_mva)
        return self

    # ------------------------------------------------------------------
    def report(self) -> "KSEGrid":
        """Drukuje wyniki load flow. Brak efektu jeśli nie zbiegł."""
        if not self._converged:
            print("Brak wyników – load flow nie zbiegł.")
            return self
        self._runner.summary()
        violations = self._runner.voltage_violations()
        if not violations.empty:
            print("⚠️  Naruszenia napięcia (poza ±5% Un):")
            print(violations.to_string())
        return self

    # ------------------------------------------------------------------
    def _print_build_summary(self):
        net = self.net
        print(f"{'─'*42}")
        print(f"  KSE Grid – sieć zbudowana:")
        print(f"    Szyny 400 kV:  {len(net.bus[net.bus.vn_kv == 400])}")
        print(f"    Szyny 220 kV:  {len(net.bus[net.bus.vn_kv == 220])}")
        print(f"    Linie 400 kV:  {len(net.line[net.line.name.str.contains('400kV')])}")
        print(f"    Linie 220 kV:  {len(net.line[net.line.name.str.contains('220kV')])}")
        print(f"    Autotransf.:   {len(net.trafo)}")
        print(f"    Generatory:    {len(net.gen)}")
        print(f"    Obciążenia:    {len(net.load)}")
        print(f"    Kompensatory:  {len(net.shunt)}")
        print(f"{'─'*42}")