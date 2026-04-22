import socket
from pathlib import Path
from typing import Optional

import pandapower as pp

from kse_grid.matpower import load_matpower_case
from kse_grid.plotting import export_interactive_graph, serve_interactive_graph
from kse_grid.runner import PowerFlowRunner


class KSEGrid:
    """
    Fasada łącząca ładowanie pliku MATPOWER z wizualizacją sieci.

    Przykłady użycia
    ----------------
    # Załaduj plik .m i otwórz interaktywny dashboard Dash w przeglądarce:
        import kse_grid
        kse_grid.KSEGrid.from_matpower_case("case.m").run_powerflow().serve_dash()

    # Eksport interaktywnego grafu HTML (stary tryb):
        grid = kse_grid.KSEGrid.from_matpower_case("case.m").run_powerflow()
        grid.plot_interactive("output.html")

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
        """Drukuje wyniki load flow. Brak efektu jeśli nie zbiegł."""
        if not self._converged:
            print("Brak wyników – load flow nie zbiegł.")
            return self
        self._runner.summary()
        violations = self._runner.voltage_violations()
        if not violations.empty:
            print(f"⚠️  Naruszenia napięcia (poza ±5% Un): {len(violations)}")
            preview = violations.head(20)
            print(preview.to_string())
            if len(violations) > len(preview):
                print(f"... oraz jeszcze {len(violations) - len(preview)} kolejnych węzłów.")
        return self

    # ------------------------------------------------------------------
    def plot_interactive(self,
                         output_file: str | Path = "grid_interactive.html",
                         auto_open: bool = False,
                         background_image: str | Path | None = None,
                         background_bounds: tuple[float, float, float, float] | None = None) -> Path:
        """Eksportuje interaktywny graf sieci do pliku HTML."""
        if self.net is None:
            raise RuntimeError("Wywołaj najpierw from_matpower_case()")
        output_path = export_interactive_graph(
            self.net,
            output_file=output_file,
            auto_open=auto_open,
            background_image=background_image,
            background_bounds=background_bounds,
        )
        print(f"📍 Graf zapisany do: {output_path}")
        return output_path

    # ------------------------------------------------------------------
    def serve_dash(self,
                   host: str = "127.0.0.1",
                   port: int = 8050,
                   auto_open: bool = True,
                   debug: bool = False) -> None:
        """Uruchamia interaktywny dashboard Dash z grafem Plotly i filtrami."""
        if self.net is None:
            raise RuntimeError("Wywołaj najpierw from_matpower_case()")
        from kse_grid.dash_app import serve_dash
        print(f"🌐 Dashboard dostępny pod: http://{host}:{port}/")
        print("   Zatrzymaj serwer skrótem Ctrl+C.")
        serve_dash(self.net, host=host, port=port, auto_open=auto_open, debug=debug)

    # ------------------------------------------------------------------
    def serve_interactive(self,
                          host: str = "127.0.0.1",
                          port: int = 8000,
                          auto_open: bool = True,
                          background_image: str | Path | None = None,
                          background_bounds: tuple[float, float, float, float] | None = None) -> str:
        """Uruchamia lokalny podgląd grafu w przeglądarce."""
        if self.net is None:
            raise RuntimeError("Wywołaj najpierw from_matpower_case()")
        resolved_port = self._resolve_available_port(host, port)
        if resolved_port != port:
            print(f"ℹ️  Port {port} zajęty, używam portu {resolved_port}.")
        url = f"http://{host}:{resolved_port}/"
        print(f"🌐 Podgląd dostępny pod: {url}")
        print("   Zatrzymaj serwer skrótem Ctrl+C.")
        return serve_interactive_graph(
            self.net,
            host=host,
            port=resolved_port,
            auto_open=auto_open,
            background_image=background_image,
            background_bounds=background_bounds,
        )

    # ------------------------------------------------------------------
    @staticmethod
    def _resolve_available_port(host: str, port: int) -> int:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
            try:
                sock.bind((host, port))
                return port
            except OSError:
                sock.bind((host, 0))
                return int(sock.getsockname()[1])
