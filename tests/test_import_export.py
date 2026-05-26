"""TDD tests for smart import + export endpoints (issue #7).

Written before implementation.
"""

from __future__ import annotations

import io
import json

import pandapower as pp
import pytest
from fastapi.testclient import TestClient

import kse_grid
from kse_grid.web_server import create_app


def _make_client_with_net() -> tuple[TestClient, pp.pandapowerNet]:
    """2-bus converged network for export tests."""
    net = pp.create_empty_network(name="TestNet", f_hz=50)
    b0 = pp.create_bus(net, vn_kv=110, name="B0")
    b1 = pp.create_bus(net, vn_kv=110, name="B1")
    pp.create_ext_grid(net, bus=b0)
    pp.create_load(net, bus=b1, p_mw=10, q_mvar=3)
    pp.create_line_from_parameters(
        net, b0, b1, length_km=1,
        r_ohm_per_km=1.0, x_ohm_per_km=3.0,
        c_nf_per_km=0.0, max_i_ka=1.0,
    )
    pp.runpp(net, tolerance_mva=1e-3)
    return TestClient(create_app(net)), net


def test_upload_pandapower_json_loads_correctly():
    net = pp.create_empty_network(name="Imported", f_hz=50)
    pp.create_bus(net, vn_kv=110, name="A")
    pp.create_bus(net, vn_kv=110, name="B")
    json_bytes = pp.to_json(net).encode()

    client = TestClient(create_app(pp.create_empty_network()))
    resp = client.post(
        "/api/network/upload",
        files={"file": ("network.json", io.BytesIO(json_bytes), "application/json")},
    )
    assert resp.status_code == 200
    assert len(resp.json()["buses"]) == 2


def test_detect_format_matpower():
    from kse_grid.loading.json_loader import detect_format
    assert detect_format(b"mpc.bus = [1 110 1]", "case.m") == "matpower"


def test_detect_format_pandapower_json():
    from kse_grid.loading.json_loader import detect_format
    payload = json.dumps({"_module": "pandapower", "bus": {}}).encode()
    assert detect_format(payload, "net.json") == "pandapower_json"


def test_detect_format_invalid_returns_400():
    client = TestClient(create_app(pp.create_empty_network()))
    resp = client.post(
        "/api/network/upload",
        files={"file": ("garbage.txt", io.BytesIO(b"not a network file"), "text/plain")},
    )
    assert resp.status_code == 400


def test_export_json_reimport_round_trip():
    client, net = _make_client_with_net()
    export_resp = client.get("/api/network/export/json")
    assert export_resp.status_code == 200
    assert "attachment" in export_resp.headers.get("content-disposition", "")

    # Re-import the exported JSON
    json_bytes = export_resp.content
    client2 = TestClient(create_app(pp.create_empty_network()))
    import_resp = client2.post(
        "/api/network/upload",
        files={"file": ("TestNet.json", io.BytesIO(json_bytes), "application/json")},
    )
    assert import_resp.status_code == 200
    assert len(import_resp.json()["buses"]) == len(net.bus)


def test_export_matpower_contains_bus_table():
    client, _ = _make_client_with_net()
    resp = client.get("/api/network/export/matpower")
    assert resp.status_code == 200
    assert b"mpc.bus" in resp.content


def test_post_network_new_resets_to_empty():
    client, _ = _make_client_with_net()
    resp = client.post("/api/network/new")
    assert resp.status_code == 200
    data = resp.json()
    assert data["buses"] == []
    assert data["lines"] == []
