"""TDD tests for POST /api/elements/{kind} — branches (line, trafo, gen).

Written before implementation per issue #4 TDD requirement.
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

import kse_grid
from kse_grid.web_server import create_app


@pytest.fixture
def two_bus_client():
    grid = kse_grid.KSEGrid.new_empty()
    app = create_app(grid.net)
    client = TestClient(app)
    b0 = client.post("/api/elements/bus", json={"fields": {"vn_kv": 110, "name": "B0"}}).json()["newElementId"]
    b1 = client.post("/api/elements/bus", json={"fields": {"vn_kv": 110, "name": "B1"}}).json()["newElementId"]
    return client, b0, b1


def test_create_line_creates_switch(two_bus_client):
    client, b0, b1 = two_bus_client
    resp = client.post("/api/elements/line", json={"fields": {
        "from_bus": b0, "to_bus": b1, "length_km": 10,
        "r_ohm_per_km": 0.1, "x_ohm_per_km": 0.4,
        "c_nf_per_km": 10, "max_i_ka": 0.5, "name": "Line_0_1",
    }})
    assert resp.status_code == 201
    net_resp = client.get("/api/network")
    data = net_resp.json()
    assert len(data["lines"]) == 1
    assert any(s["elementType"] == "l" for s in data["switches"])


def test_create_trafo_creates_switch():
    grid = kse_grid.KSEGrid.new_empty()
    app = create_app(grid.net)
    client = TestClient(app)
    hv = client.post("/api/elements/bus", json={"fields": {"vn_kv": 220, "name": "HV"}}).json()["newElementId"]
    lv = client.post("/api/elements/bus", json={"fields": {"vn_kv": 110, "name": "LV"}}).json()["newElementId"]
    resp = client.post("/api/elements/trafo", json={"fields": {
        "hv_bus": hv, "lv_bus": lv, "sn_mva": 100,
        "vn_hv_kv": 220, "vn_lv_kv": 110,
        "vk_percent": 10, "vkr_percent": 0.3,
        "pfe_kw": 30, "i0_percent": 0.1, "name": "Trafo_T1",
    }})
    assert resp.status_code == 201
    net_resp = client.get("/api/network")
    data = net_resp.json()
    assert len(data["trafos"]) == 1
    assert any(s["elementType"] == "t" for s in data["switches"])


def test_new_bus_gets_graph_position():
    grid = kse_grid.KSEGrid.new_empty()
    client = TestClient(create_app(grid.net))
    resp = client.post("/api/elements/bus", json={"fields": {"vn_kv": 110, "name": "Bus_A"}})
    assert resp.status_code == 201
    data = resp.json()
    new_id = data["newElementId"]
    positions = data["topologyUpdate"].get("positions", {})
    assert str(new_id) in positions


def test_gen_on_slack_bus_rejected():
    grid = kse_grid.KSEGrid.new_empty()
    app = create_app(grid.net)
    client = TestClient(app)
    bus_id = client.post("/api/elements/bus", json={"fields": {"vn_kv": 110, "name": "Slack"}}).json()["newElementId"]
    client.post("/api/elements/ext_grid", json={"fields": {"bus": bus_id}})
    resp = client.post("/api/elements/gen", json={"fields": {"bus": bus_id, "p_mw": 50.0}})
    assert resp.status_code == 400


def test_line_self_loop_rejected(two_bus_client):
    client, b0, _ = two_bus_client
    resp = client.post("/api/elements/line", json={"fields": {
        "from_bus": b0, "to_bus": b0, "length_km": 10,
        "r_ohm_per_km": 0.1, "x_ohm_per_km": 0.4,
        "c_nf_per_km": 10, "max_i_ka": 0.5,
    }})
    assert resp.status_code == 400
    assert "from_bus == to_bus" in resp.json()["detail"]


def test_trafo_self_loop_rejected():
    grid = kse_grid.KSEGrid.new_empty()
    client = TestClient(create_app(grid.net))
    bus_id = client.post("/api/elements/bus", json={"fields": {"vn_kv": 110}}).json()["newElementId"]
    resp = client.post("/api/elements/trafo", json={"fields": {
        "hv_bus": bus_id, "lv_bus": bus_id, "sn_mva": 100,
        "vn_hv_kv": 110, "vn_lv_kv": 110,
        "vk_percent": 10, "vkr_percent": 0.3,
        "pfe_kw": 30, "i0_percent": 0.1,
    }})
    assert resp.status_code == 400
    assert "hv_bus == lv_bus" in resp.json()["detail"]


def test_line_nonexistent_bus_rejected():
    grid = kse_grid.KSEGrid.new_empty()
    client = TestClient(create_app(grid.net))
    b0 = client.post("/api/elements/bus", json={"fields": {"vn_kv": 110}}).json()["newElementId"]
    resp = client.post("/api/elements/line", json={"fields": {
        "from_bus": b0, "to_bus": 9999, "length_km": 10,
        "r_ohm_per_km": 0.1, "x_ohm_per_km": 0.4,
        "c_nf_per_km": 10, "max_i_ka": 0.5,
    }})
    assert resp.status_code == 400
