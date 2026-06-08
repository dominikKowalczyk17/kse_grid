"""Loading MATPOWER cases into pandapower."""

from __future__ import annotations

from pathlib import Path

import pandapower as pp

from kse_grid.loading.geojson_loader import load_geo_sidecar
from kse_grid.loading.matpower_importer import import_matpower_case, seed_operational_switches
from kse_grid.loading.network_normalizer import normalize_network


def load_matpower_case(case_file: str | Path, f_hz: int = 50) -> pp.pandapowerNet:
    """Load a MATPOWER case (.m) into pandapower."""
    case_path = Path(case_file).expanduser().resolve()
    net = import_matpower_case(case_path, f_hz=f_hz)
    net.name = case_path.stem
    setattr(net, "_case_path", str(case_path))
    normalize_network(net)
    load_geo_sidecar(net, case_path)
    seed_operational_switches(net)
    return net


__all__ = ["load_matpower_case", "load_geo_sidecar", "seed_operational_switches"]
