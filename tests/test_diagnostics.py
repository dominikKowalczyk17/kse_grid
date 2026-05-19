"""Integration-style tests for kse_grid.serialization.diagnostics.

Uses a tiny hand-built pandapower network so behavior stays deterministic
without depending on MATPOWER files.
"""

from __future__ import annotations

import pandapower as pp
import pytest

from kse_grid.serialization.diagnostics import compute_diagnostics


@pytest.fixture
def empty_net():
    """A network with no buses and no load flow run."""
    return pp.create_empty_network()


@pytest.fixture
def converged_net():
    """A minimal 2-bus network with a clean load flow result."""
    net = pp.create_empty_network()
    bus_a = pp.create_bus(net, vn_kv=110.0, name="A")
    bus_b = pp.create_bus(net, vn_kv=110.0, name="B")
    pp.create_ext_grid(net, bus=bus_a, vm_pu=1.0, name="slack")
    pp.create_line_from_parameters(
        net,
        from_bus=bus_a, to_bus=bus_b,
        length_km=10.0,
        r_ohm_per_km=0.1, x_ohm_per_km=0.3, c_nf_per_km=10.0,
        max_i_ka=1.0,
        name="L1",
    )
    pp.create_load(net, bus=bus_b, p_mw=5.0, q_mvar=1.0, name="load")
    pp.runpp(net)
    return net


class TestVoltageDiagnostics:
    def test_empty_network_yields_empty_voltage_block(self, empty_net):
        result = compute_diagnostics(empty_net)
        assert result["voltage"]["minPu"] is None
        assert result["voltage"]["maxPu"] is None
        assert result["voltage"]["lowCount"] == 0
        assert result["voltage"]["highCount"] == 0

    def test_converged_network_reports_min_and_max(self, converged_net):
        result = compute_diagnostics(converged_net)
        voltage = result["voltage"]
        assert voltage["minPu"] is not None
        assert voltage["maxPu"] is not None
        # slack is fixed at 1.0, loaded bus must drop slightly under load
        assert voltage["minPu"] <= voltage["maxPu"]
        assert voltage["maxBusId"] is not None and voltage["minBusId"] is not None

    def test_violation_counts_zero_when_within_band(self, converged_net):
        # 5 MW load on a 110 kV line is small — voltages should stay in OK band.
        result = compute_diagnostics(converged_net)
        assert result["voltage"]["lowCount"] == 0
        assert result["voltage"]["highCount"] == 0


class TestLoadingDiagnostics:
    def test_empty_network_no_loading(self, empty_net):
        result = compute_diagnostics(empty_net)
        loading = result["loading"]
        assert loading["maxPct"] == 0.0
        assert loading["maxKind"] is None
        assert loading["overloadedCount"] == 0
        assert loading["heavyCount"] == 0
        assert loading["loadBusCount"] == 0

    def test_converged_network_picks_max(self, converged_net):
        result = compute_diagnostics(converged_net)
        loading = result["loading"]
        # only one line exists, so it must be the max
        assert loading["maxKind"] == "line"
        assert loading["maxId"] == 0
        assert loading["maxPct"] > 0.0

    def test_load_bus_count_tracks_active_loads(self, converged_net):
        result = compute_diagnostics(converged_net)
        # one load attached to bus_b
        assert result["loading"]["loadBusCount"] == 1
