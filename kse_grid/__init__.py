"""
kse_grid – plotter sieciowy dla plików MATPOWER (.m)

Użycie
------
    import kse_grid

    grid = kse_grid.KSEGrid.from_matpower_case("case.m").run_powerflow()
    grid.serve_interactive()          # podgląd w przeglądarce
    grid.plot_interactive("out.html") # eksport do pliku HTML
"""

from kse_grid.matpower import load_matpower_case
from kse_grid.runner import PowerFlowRunner
from kse_grid.grid import KSEGrid

__all__ = [
    "KSEGrid",
    "load_matpower_case",
    "PowerFlowRunner",
]
