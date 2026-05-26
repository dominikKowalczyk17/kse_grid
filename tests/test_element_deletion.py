"""TDD tests for DELETE /api/elements/{kind}/{id} — element deletion.

Written before implementation per issue #5 TDD requirement.
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

import kse_grid
from kse_grid.web_server import create_app


@pytest.fixture
def network_client():
    """Empty network with two buses connected by a line, a load on bus 1, and ext_grid on bus 0."""
    grid = kse_grid.KSEGrid.new_empty()
    app = create_app(grid.net)
    client = TestClient(app)
    b0 = client.post("/api/elements/bus", json={"fields": {"vn_kv": 110, "name": "B0"}}).json()["newElementId"]
    b1 = client.post("/api/elements/bus", json={"fields": {"vn_kv": 110, "name": "B1"}}).json()["newElementId"]
    client.post("/api/elements/ext_grid", json={"fields": {"bus": b0}})
    client.post("/api/elements/load", json={"fields": {"bus": b1, "p_mw": 10.0, "name": "L1"}})
    client.post("/api/elements/line", json={"fields": {
        "from_bus": b0, "to_bus": b1, "length_km": 10,
        "r_ohm_per_km": 0.1, "x_ohm_per_km": 0.4,
        "c_nf_per_km": 10, "max_i_ka": 0.5, "name": "Line01",
    }})
    return client, b0, b1


def test_delete_bus_cascades(network_client):
    client, b0, b1 = network_client
    resp = client.delete(f"/api/elements/bus/{b1}")
    assert resp.status_code == 200
    data = client.get("/api/network").json()
    bus_ids = [b["id"] for b in data["buses"]]
    assert b1 not in bus_ids
    assert data["loads"] == []
    assert data["lines"] == []
    assert not any(s["elementType"] == "l" for s in data["switches"])


def test_delete_line_removes_switch(network_client):
    client, b0, b1 = network_client
    lines = client.get("/api/network").json()["lines"]
    line_id = lines[0]["id"]
    resp = client.delete(f"/api/elements/line/{line_id}")
    assert resp.status_code == 200
    data = client.get("/api/network").json()
    assert data["lines"] == []
    assert not any(s["elementType"] == "l" for s in data["switches"])


def test_delete_nonexistent_returns_404():
    grid = kse_grid.KSEGrid.new_empty()
    client = TestClient(create_app(grid.net))
    resp = client.delete("/api/elements/bus/999")
    assert resp.status_code == 404


def test_recalculate_after_delete(network_client):
    client, b0, b1 = network_client
    lines = client.get("/api/network").json()["lines"]
    line_id = lines[0]["id"]
    client.delete(f"/api/elements/line/{line_id}")
    resp = client.post("/api/powerflow/recalculate")
    assert resp.status_code == 200
