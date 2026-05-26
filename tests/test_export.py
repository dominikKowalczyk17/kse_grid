"""Tests for JSON and MATPOWER export endpoints."""
from __future__ import annotations

import pandapower as pp
import pytest
from fastapi.testclient import TestClient

from kse_grid.web_server import create_app


@pytest.fixture
def converged_client():
    net = pp.create_empty_network(f_hz=50)
    b0 = pp.create_bus(net, vn_kv=110.0, name="A")
    b1 = pp.create_bus(net, vn_kv=110.0, name="B")
    pp.create_ext_grid(net, bus=b0, vm_pu=1.0)
    pp.create_line_from_parameters(net, from_bus=b0, to_bus=b1, length_km=10.0,
        r_ohm_per_km=0.1, x_ohm_per_km=0.3, c_nf_per_km=10.0, max_i_ka=1.0)
    pp.create_load(net, bus=b1, p_mw=5.0, q_mvar=1.0)
    pp.runpp(net)
    return TestClient(create_app(net))


def test_json_export_is_valid_pandapower(converged_client):
    resp = converged_client.get("/api/network/export/json")
    assert resp.status_code == 200
    # Must be parseable as pandapower JSON
    net2 = pp.from_json_string(resp.text)
    assert len(net2.bus) == 2


def test_json_export_content_disposition(converged_client):
    resp = converged_client.get("/api/network/export/json")
    assert "attachment" in resp.headers.get("content-disposition", "")
    assert ".json" in resp.headers.get("content-disposition", "")


def test_matpower_export_has_required_tables(converged_client):
    resp = converged_client.get("/api/network/export/matpower")
    assert resp.status_code == 200
    body = resp.text
    assert "mpc.bus" in body
    assert "mpc.branch" in body
    assert "mpc.baseMVA" in body
