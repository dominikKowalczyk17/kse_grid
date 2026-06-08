from pathlib import Path
from typing import Optional

import pandapower as pp

from kse_grid.loading.matpower import load_matpower_case
from kse_grid.powerflow.runner import PowerFlowRunner


class KSEGrid:
    """
    Facade combining MATPOWER file loading with network visualisation.

    Examples
    --------
    # Load a .m file and open an interactive dashboard in the browser:
        import kse_grid
        kse_grid.KSEGrid.from_matpower_case("case.m").run_powerflow().serve()

    # Access the raw pandapower network:
        grid = kse_grid.KSEGrid.from_matpower_case("case.m").run_powerflow()
        net = grid.net
    """

    def __init__(self):
        self.net: Optional[pp.pandapowerNet] = None
        self._runner: Optional[PowerFlowRunner] = None
        self._converged: bool = False

    # ------------------------------------------------------------------
    @classmethod
    def from_matpower_case(cls, case_file: str | Path, f_hz: int = 50) -> "KSEGrid":
        """Create a KSEGrid from a MATPOWER (.m) file."""
        grid = cls()
        grid.net = load_matpower_case(case_file, f_hz=f_hz)
        print(f"Loaded: {grid.net.name}")
        print(f"   Buses: {len(grid.net.bus)}, lines: {len(grid.net.line)}, trafos: {len(grid.net.trafo)}")
        return grid

    # ------------------------------------------------------------------
    @classmethod
    def new_empty(cls, f_hz: int = 50) -> "KSEGrid":
        """Create a KSEGrid with an empty network ready for manual building."""
        from kse_grid.loading.network_normalizer import normalize_network
        grid = cls()
        grid.net = pp.create_empty_network(name="New Grid", f_hz=f_hz)
        normalize_network(grid.net)
        print("New empty network: ready to edit.")
        return grid

    # ------------------------------------------------------------------
    def run_powerflow(self,
                      algorithm: str = "nr",
                      max_iteration: int = 100,
                      tolerance_mva: float = 1e-3) -> "KSEGrid":
        """Run load flow calculations (optional; enriches visualisation)."""
        if self.net is None:
            raise RuntimeError("Call from_matpower_case() first")
        self._runner = PowerFlowRunner(self.net)
        self._converged = self._runner.run(algorithm, max_iteration, tolerance_mva)
        return self

    # ------------------------------------------------------------------
    def report(self) -> "KSEGrid":
        """Print load flow results. No effect if load flow did not converge."""
        if not self._converged:
            print("No results – load flow did not converge.")
            return self
        if self._runner is None:
            raise RuntimeError("No load flow runner")
        self._runner.summary()
        violations = self._runner.voltage_violations()
        if not violations.empty:
            print(f"⚠️  Voltage violations (outside ±5% Un): {len(violations)}")
            preview = violations.head(20)
            print(preview.to_string())
            if len(violations) > len(preview):
                print(f"... and {len(violations) - len(preview)} more buses.")
        return self

    def serve(self,
              host: str = "127.0.0.1",
              port: int = 8050,
              auto_open: bool = True) -> None:
        """Start the FastAPI + Vue server with an interactive network graph."""
        if self.net is None:
            raise RuntimeError("Call from_matpower_case() first")
        from kse_grid.web_server import serve
        print(f"🌐 Dashboard available at: http://{host}:{port}/")
        print("   Stop the server with Ctrl+C.")
        serve(self.net, host=host, port=port, auto_open=auto_open)
