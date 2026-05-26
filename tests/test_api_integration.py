"""Integration test: full create → power flow → serialize cycle via HTTP API."""
from __future__ import annotations

import pandapower as pp
import pytest
from fastapi.testclient import TestClient

from kse_grid.web_server import create_app


@pytest.fixture
def client():
    net = pp.create_empty_network(f_hz=50)
    return TestClient(create_app(net))

def test_full_creation_sequence(client):
    """Create bus → ext_grid → load → line → recalculate; verify hasResults and key fields."""
    b0 = client.post("/api/elements/bus", json={"fields": {"vn_kv": 110.0, "name": "A"}}).json()["newElementId"]
    b1 = client.post("/api/elements/bus", json={"fields": {"vn_kv": 110.0, "name": "B"}}).json()["newElementId"]
    client.post("/api/elements/ext_grid", json={"fields": {"bus": b0, "vm_pu": 1.0}})
    client.post("/api/elements/load", json={"fields": {"bus": b1, "p_mw": 5.0, "q_mvar": 1.0}})
    client.post("/api/elements/line", json={"fields": {
        "from_bus": b0, "to_bus": b1, "length_km": 10.0,
        "r_ohm_per_km": 0.1, "x_ohm_per_km": 0.3,
        "c_nf_per_km": 10.0, "max_i_ka": 1.0,
    }})
    resp = client.post("/api/powerflow/recalculate")
    assert resp.status_code == 200
    data = resp.json()
    assert data["hasResults"] is True
    assert len(data["busResults"]) == 2
    assert all(r["vmPu"] is not None for r in data["busResults"])

def test_no_slack_bus_gives_actionable_message(client):
    """Network with buses but no ext_grid should give a readable hint, not a 500."""
    b0 = client.post("/api/elements/bus", json={"fields": {"vn_kv": 110.0, "name": "A"}}).json()["newElementId"]
    b1 = client.post("/api/elements/bus", json={"fields": {"vn_kv": 110.0, "name": "B"}}).json()["newElementId"]
    client.post("/api/elements/load", json={"fields": {"bus": b1, "p_mw": 5.0, "q_mvar": 1.0}})
    client.post("/api/elements/line", json={"fields": {
        "from_bus": b0, "to_bus": b1, "length_km": 10.0,
        "r_ohm_per_km": 0.1, "x_ohm_per_km": 0.3,
        "c_nf_per_km": 10.0, "max_i_ka": 1.0,
    }})
    resp = client.post("/api/powerflow/recalculate")
    assert resp.status_code == 200
    data = resp.json()
    assert data["topology"]["lastRunSucceeded"] is False
    assert data["topology"]["lastRunMessage"] is not None
    assert "ext_grid" in data["topology"]["lastRunMessage"].lower() or "źródła" in data["topology"]["lastRunMessage"].lower()

def test_deletion_cascade_via_api(client):
    """Deleting a bus cascades to connected elements."""
    b0 = client.post("/api/elements/bus", json={"fields": {"vn_kv": 110.0, "name": "A"}}).json()["newElementId"]
    b1 = client.post("/api/elements/bus", json={"fields": {"vn_kv": 110.0, "name": "B"}}).json()["newElementId"]
    client.post("/api/elements/ext_grid", json={"fields": {"bus": b0}})
    client.post("/api/elements/load", json={"fields": {"bus": b1, "p_mw": 5.0, "q_mvar": 1.0}})
    client.post("/api/elements/line", json={"fields": {
        "from_bus": b0, "to_bus": b1, "length_km": 10.0,
        "r_ohm_per_km": 0.1, "x_ohm_per_km": 0.3,
        "c_nf_per_km": 10.0, "max_i_ka": 1.0,
    }})
    resp = client.delete(f"/api/elements/bus/{b1}")
    assert resp.status_code == 200
    net_data = client.get("/api/network").json()
    bus_ids = [b["id"] for b in net_data["buses"]]
    assert b1 not in bus_ids
    assert net_data["loads"] == []
    assert net_data["lines"] == []
