"""Fasada łącząca silnik load flow z raportowaniem wyników."""

from __future__ import annotations

import pandapower as pp

from kse_grid.powerflow_engine import run_powerflow
from kse_grid.powerflow_report import print_load_flow_summary, voltage_violations


class PowerFlowRunner:
    """Uruchamia obliczenia load flow i raportuje wyniki."""

    def __init__(self, net: pp.pandapowerNet):
        self.net = net

    def run(
        self,
        algorithm: str = "nr",
        max_iteration: int = 100,
        tolerance_mva: float = 1e-6,
    ) -> bool:
        """Uruchamia load flow. Zwraca True jeśli zbieżny, False jeśli nie."""
        result = run_powerflow(self.net, algorithm=algorithm, max_iteration=max_iteration, tolerance_mva=tolerance_mva)
        if not result.converged:
            print(f"❌ Load flow nie zbiegł po {max_iteration} iteracjach!")
        return result.converged

    def summary(self) -> None:
        """Drukuje sformatowane podsumowanie wyników load flow."""
        print_load_flow_summary(self.net)

    def voltage_violations(self):
        """Zwraca DataFrame z szynami poza pasmem ±5% Un."""
        return voltage_violations(self.net)
