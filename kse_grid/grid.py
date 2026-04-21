import socket
from pathlib import Path
from typing import Optional

import pandapower as pp

from kse_grid.builder import GridBuilder
from kse_grid.matpower import load_matpower_case
from kse_grid.plotting import export_interactive_graph, serve_interactive_graph
from kse_grid.runner import PowerFlowRunner
from kse_grid.topology import KSETopology


class KSEGrid:
    """
    Fasada łącząca budowę sieci z obliczeniami load flow.

    Przykłady użycia
    ----------------
    # Standardowe uruchomienie (fluent interface):
        import kse_grid
        kse_grid.KSEGrid().build().run_powerflow().report()

    # Eksport interaktywnego grafu HTML:
        import kse_grid
        grid = kse_grid.KSEGrid().build().run_powerflow()
        grid.plot_interactive("kse_grid_interactive.html")

    # Graf na tle rastrowej mapy Polski:
        import kse_grid
        grid = kse_grid.KSEGrid().build().run_powerflow()
        grid.serve_interactive(
            background_image="poland_map.png",
            background_bounds=(14.1, 24.2, 49.0, 54.9),
        )

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
    @classmethod
    def from_matpower_case(cls, case_file: str | Path, f_hz: int = 50) -> "KSEGrid":
        """Tworzy KSEGrid z pliku MATPOWER."""
        grid = cls()
        grid.net = load_matpower_case(case_file, f_hz=f_hz)
        print(f"📥 Załadowano przypadek MATPOWER: {grid.net.name}")
        print(f"   Szyny: {len(grid.net.bus)}, linie: {len(grid.net.line)}, trafa: {len(grid.net.trafo)}")
        return grid

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
            print(f"⚠️  Naruszenia napięcia (poza ±5% Un): {len(violations)}")
            preview = violations.head(20)
            print(preview.to_string())
            if len(violations) > len(preview):
                print(f"... oraz jeszcze {len(violations) - len(preview)} kolejnych węzłów.")
        return self

    # ------------------------------------------------------------------
    def plot_interactive(self,
                         output_file: str | Path = "kse_grid_interactive.html",
                         auto_open: bool = False,
                         background_image: str | Path | None = None,
                         background_bounds: tuple[float, float, float, float] | None = None) -> Path:
        """Eksportuje interaktywny graf sieci do pliku HTML."""
        if self.net is None:
            raise RuntimeError("Wywołaj najpierw build()")
        output_path = export_interactive_graph(
            self.net,
            output_file=output_file,
            auto_open=auto_open,
            background_image=background_image,
            background_bounds=background_bounds,
        )
        print(f"📍 Interaktywny graf zapisany do: {output_path}")
        return output_path

    # ------------------------------------------------------------------
    def serve_interactive(self,
                          host: str = "127.0.0.1",
                          port: int = 8000,
                          auto_open: bool = True,
                          background_image: str | Path | None = None,
                          background_bounds: tuple[float, float, float, float] | None = None) -> str:
        """Uruchamia lokalny podgląd grafu w przeglądarce."""
        if self.net is None:
            raise RuntimeError("Wywołaj najpierw build()")
        resolved_port = self._resolve_available_port(host, port)
        if resolved_port != port:
            print(f"ℹ️  Port {port} jest zajęty, używam wolnego portu {resolved_port}.")
        url = f"http://{host}:{resolved_port}/"
        print(f"🌐 Uruchamiam interaktywny podgląd pod: {url}")
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
