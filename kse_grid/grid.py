from pathlib import Path
from typing import Optional

import pandapower as pp

from kse_grid.matpower import load_matpower_case
from kse_grid.runner import PowerFlowRunner


class KSEGrid:
    """
    Fasada łącząca ładowanie pliku MATPOWER z wizualizacją sieci.

    Przykłady użycia
    ----------------
    # Załaduj plik .m i otwórz interaktywny dashboard w przeglądarce:
        import kse_grid
        kse_grid.KSEGrid.from_matpower_case("case.m").run_powerflow().serve()

    # Dostęp do surowej sieci pandapower:
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
        """Tworzy KSEGrid z pliku MATPOWER (.m)."""
        grid = cls()
        grid.net = load_matpower_case(case_file, f_hz=f_hz)
        print(f"📥 Załadowano: {grid.net.name}")
        print(f"   Szyny: {len(grid.net.bus)}, linie: {len(grid.net.line)}, trafa: {len(grid.net.trafo)}")
        return grid

    # ------------------------------------------------------------------
    def run_powerflow(self,
                      algorithm: str = "iwamoto_nr",
                      max_iteration: int = 100,
                      tolerance_mva: float = 1.5) -> "KSEGrid": ## w PSE 1.5 MWA jest akceptowalne
        """Uruchamia obliczenia load flow (opcjonalnie, wzbogaca wizualizację)."""
        if self.net is None:
            raise RuntimeError("Wywołaj najpierw from_matpower_case()")
        self._runner = PowerFlowRunner(self.net)
        self._converged = self._runner.run(algorithm, max_iteration, tolerance_mva)
        return self

    # ------------------------------------------------------------------
    def report(self) -> "KSEGrid":
        """Drukuje wyniki load flow. Brak efektu, jeśli nie zbiegł."""
        if not self._converged:
            print("Brak wyników – load flow nie zbiegł.")
            return self
        if self._runner is None:
            raise RuntimeError("Brak runnera load flow")
        self._runner.summary()
        violations = self._runner.voltage_violations()
        if not violations.empty:
            print(f"⚠️  Naruszenia napięcia (poza ±5% Un): {len(violations)}")
            preview = violations.head(20)
            print(preview.to_string())
            if len(violations) > len(preview):
                print(f"... oraz jeszcze {len(violations) - len(preview)} kolejnych węzłów.")
        return self

    def serve(self,
              host: str = "127.0.0.1",
              port: int = 8050,
              auto_open: bool = True) -> None:
        """Uruchamia serwer FastAPI + Vue z interaktywnym grafem sieci."""
        if self.net is None:
            raise RuntimeError("Wywołaj najpierw from_matpower_case()")
        from kse_grid.web_server import serve
        print(f"🌐 Dashboard dostępny pod: http://{host}:{port}/")
        print("   Zatrzymaj serwer skrótem Ctrl+C.")
        serve(self.net, host=host, port=port, auto_open=auto_open)
