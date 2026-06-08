"""Facade combining the load flow engine with result reporting."""

from __future__ import annotations

import pandapower as pp

from kse_grid.powerflow.engine import run_powerflow
from kse_grid.powerflow.report import print_load_flow_summary, voltage_violations


class PowerFlowRunner:
    """Runs load flow calculations and reports results."""

    def __init__(self, net: pp.pandapowerNet):
        self.net = net

    def run(
        self,
        algorithm: str = "nr",
        max_iteration: int = 100,
        tolerance_mva: float = 1e-6,
    ) -> bool:
        """Run load flow. Returns True if converged, False otherwise."""
        result = run_powerflow(self.net, algorithm=algorithm, max_iteration=max_iteration, tolerance_mva=tolerance_mva)
        if not result.converged:
            print(f"❌ Load flow did not converge after {max_iteration} iterations!")
        return result.converged

    def summary(self) -> None:
        """Print a formatted summary of load flow results."""
        print_load_flow_summary(self.net)

    def voltage_violations(self):
        """Return a DataFrame of buses outside the ±5% Un band."""
        return voltage_violations(self.net)
