"""Pandapower JSON loading and network format detection."""

from __future__ import annotations

import pandapower as pp

from kse_grid.loading.matpower_importer import seed_operational_switches
from kse_grid.loading.network_normalizer import normalize_network

_MATPOWER_MARKERS = (b"mpc.bus", b"mpc.branch", b"function mpc")
_PANDAPOWER_MARKERS = (b'"_module"', b'"pandapower"', b'"res_bus"')


def detect_format(contents: bytes, filename: str) -> str:
    """Return 'matpower' or 'pandapower_json'; raise ValueError on unknown."""
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""

    if ext == "m":
        return "matpower"

    if ext == "json":
        if any(m in contents for m in _PANDAPOWER_MARKERS):
            return "pandapower_json"

    # Content sniff regardless of extension
    if any(m in contents for m in _MATPOWER_MARKERS):
        return "matpower"
    if any(m in contents for m in _PANDAPOWER_MARKERS):
        return "pandapower_json"

    raise ValueError(
        f"Unrecognised network format for '{filename}'. "
        "Expected a MATPOWER .m file or a pandapower JSON file."
    )


def load_pandapower_json(contents: bytes) -> pp.pandapowerNet:
    """Load pandapower JSON bytes into a normalised network."""
    net = pp.from_json_string(contents.decode("utf-8"))
    normalize_network(net)
    seed_operational_switches(net)
    return net
