"""Tests for island-aware powerflow.

Uses hand-built pandapower networks to keep tests deterministic without
depending on MATPOWER files.
"""

from __future__ import annotations

import pandapower as pp
import pytest

from kse_grid.powerflow.island_powerflow import run_island_powerflow, _active_slack_bus_ids
from kse_grid.serialization.topology_analysis import compute_topology
from kse_grid.topology.switching import _clear_results


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

def _simple_2bus(load_mw: float = 5.0) -> pp.pandapowerNet:
    """Single connected island with ext_grid slack."""
    net = pp.create_empty_network()
    a = pp.create_bus(net, vn_kv=110.0, name="A")
    b = pp.create_bus(net, vn_kv=110.0, name="B")
    pp.create_ext_grid(net, bus=a, vm_pu=1.0)
    pp.create_line_from_parameters(
        net, from_bus=a, to_bus=b, length_km=10.0,
        r_ohm_per_km=0.1, x_ohm_per_km=0.3, c_nf_per_km=10.0, max_i_ka=1.0,
    )
    pp.create_load(net, bus=b, p_mw=load_mw, q_mvar=1.0)
    return net


def _split_network() -> pp.pandapowerNet:
    """Two islands: island A has ext_grid, island B is unsupplied (no slack)."""
    net = pp.create_empty_network()
    # Island A: buses 0-1
    a0 = pp.create_bus(net, vn_kv=110.0, name="A0")
    a1 = pp.create_bus(net, vn_kv=110.0, name="A1")
    pp.create_ext_grid(net, bus=a0, vm_pu=1.0)
    pp.create_line_from_parameters(
        net, from_bus=a0, to_bus=a1, length_km=5.0,
        r_ohm_per_km=0.1, x_ohm_per_km=0.3, c_nf_per_km=10.0, max_i_ka=1.0,
    )
    pp.create_load(net, bus=a1, p_mw=3.0, q_mvar=0.5)

    # Island B: buses 2-3, no source
    b0 = pp.create_bus(net, vn_kv=110.0, name="B0")
    b1 = pp.create_bus(net, vn_kv=110.0, name="B1")
    pp.create_line_from_parameters(
        net, from_bus=b0, to_bus=b1, length_km=5.0,
        r_ohm_per_km=0.1, x_ohm_per_km=0.3, c_nf_per_km=10.0, max_i_ka=1.0,
    )
    pp.create_load(net, bus=b1, p_mw=2.0, q_mvar=0.3)
    return net


# ---------------------------------------------------------------------------
# Single-island (normal case)
# ---------------------------------------------------------------------------

class TestSingleIsland:
    def test_converged_result(self):
        net = _simple_2bus()
        _clear_results(net)
        results = run_island_powerflow(net)
        assert len(results) == 1
        r = results[0]
        assert r.status == "converged"
        assert r.converged is True
        assert r.message is None

    def test_res_bus_populated(self):
        net = _simple_2bus()
        _clear_results(net)
        run_island_powerflow(net)
        assert not net.res_bus.empty
        assert len(net.res_bus) == 2

    def test_res_line_populated(self):
        net = _simple_2bus()
        _clear_results(net)
        run_island_powerflow(net)
        assert not net.res_line.empty

    def test_island_has_correct_bus_count(self):
        net = _simple_2bus()
        _clear_results(net)
        results = run_island_powerflow(net)
        assert results[0].bus_count == 2

    def test_island_has_slack(self):
        net = _simple_2bus()
        _clear_results(net)
        results = run_island_powerflow(net)
        assert results[0].has_slack is True


# ---------------------------------------------------------------------------
# Split network: one energized island + one unsupplied island
# ---------------------------------------------------------------------------

class TestSplitNetwork:
    def test_two_islands_detected(self):
        net = _split_network()
        _clear_results(net)
        results = run_island_powerflow(net)
        assert len(results) == 2

    def test_energized_island_converges(self):
        net = _split_network()
        _clear_results(net)
        results = run_island_powerflow(net)
        converged = [r for r in results if r.status == "converged"]
        assert len(converged) == 1

    def test_unsupplied_island_classified(self):
        net = _split_network()
        _clear_results(net)
        results = run_island_powerflow(net)
        unsupplied = [r for r in results if r.status == "unsupplied"]
        assert len(unsupplied) == 1
        assert unsupplied[0].has_slack is False
        assert unsupplied[0].converged is False

    def test_res_bus_contains_only_energized_buses(self):
        net = _split_network()
        _clear_results(net)
        results = run_island_powerflow(net)
        converged_island = next(r for r in results if r.status == "converged")
        assert set(net.res_bus.index).issubset(set(converged_island.bus_ids))

    def test_no_global_exception_for_partial_blackout(self):
        """Island PF must not raise even when part of the network is unsupplied."""
        net = _split_network()
        _clear_results(net)
        try:
            run_island_powerflow(net)
        except Exception as exc:
            pytest.fail(f"run_island_powerflow raised unexpectedly: {exc}")


# ---------------------------------------------------------------------------
# topology_analysis integration
# ---------------------------------------------------------------------------

class TestTopologyAnalysisWithPFResults:
    def test_pf_status_in_island_objects(self):
        net = _split_network()
        _clear_results(net)
        island_results = run_island_powerflow(net)
        net._island_pf_results = island_results
        topology = compute_topology(net)
        statuses = {i["pfStatus"] for i in topology["islands"]}
        assert "converged" in statuses
        assert "unsupplied" in statuses

    def test_energized_island_count_uses_pf_status(self):
        net = _split_network()
        _clear_results(net)
        net._island_pf_results = run_island_powerflow(net)
        topology = compute_topology(net)
        assert topology["energizedIslandCount"] == 1
        assert topology["unsuppliedIslandCount"] == 1

    def test_no_pf_results_falls_back_to_topology(self):
        net = _split_network()
        topology = compute_topology(net)
        # pfStatus should be None when no PF has run
        assert all(i["pfStatus"] is None for i in topology["islands"])

    def test_pf_message_propagated(self):
        net = _split_network()
        _clear_results(net)
        net._island_pf_results = run_island_powerflow(net)
        topology = compute_topology(net)
        unsupplied_island = next(i for i in topology["islands"] if i["pfStatus"] == "unsupplied")
        assert unsupplied_island["pfMessage"] is not None
