"""
kse_grid – plotter sieciowy dla plików MATPOWER (.m)

Użycie
------
    import kse_grid

    grid = kse_grid.KSEGrid.from_matpower_case("case.m").run_powerflow()
    grid.serve()                      # dashboard FastAPI + Vue w przeglądarce
"""

from kse_grid.grid import KSEGrid
from kse_grid.loading.matpower import load_matpower_case, seed_operational_switches
from kse_grid.powerflow.runner import PowerFlowRunner
from kse_grid.topology.switching import SwitchingSession

__all__ = [
    "KSEGrid",
    "load_matpower_case",
    "seed_operational_switches",
    "PowerFlowRunner",
    "SwitchingSession",
]
