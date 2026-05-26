"""TDD tests for Grid Builder API (issue #8/#9).

Backend surface: is_empty flag + createElement/deleteElement endpoints.
"""

from __future__ import annotations

import pandapower as pp
import pytest
from fastapi.testclient import TestClient

import kse_grid
from kse_grid.web_server import create_app


@pytest.fixture
def empty_client():
    return TestClient(create_app(kse_grid.KSEGrid.new_empty().net))


@pytest.fixture
def populated_client():
    net = pp.create_empty_network(f_hz=50)
    b0 = pp.create_bus(net, vn_kv=110, name="B0")
    pp.create_ext_grid(net, bus=b0)
    return TestClient(create_app(net))


def test_is_empty_true_for_empty_network(empty_client):
    data = empty_client.get("/api/network").json()
    assert data["isEmpty"] is True


def test_is_empty_false_with_buses(populated_client):
    data = populated_client.get("/api/network").json()
    assert data["isEmpty"] is False


def test_create_bus_updates_is_empty(empty_client):
    empty_client.post(
        "/api/elements/bus",
        json={"fields": {"vn_kv": 110, "name": "B0"}},
    )
    data = empty_client.get("/api/network").json()
    assert data["isEmpty"] is False


def test_delete_only_bus_restores_is_empty(empty_client):
    resp = empty_client.post(
        "/api/elements/bus",
        json={"fields": {"vn_kv": 110, "name": "B0"}},
    )
    bus_id = resp.json()["newElementId"]
    empty_client.delete(f"/api/elements/bus/{bus_id}")
    data = empty_client.get("/api/network").json()
    assert data["isEmpty"] is True


def test_fetch_create_schema_returns_both_formats(empty_client):
    resp = empty_client.get("/api/elements/create-schema")
    assert resp.status_code == 200
    data = resp.json()
    assert "pandapower" in data
    assert "matpower" in data
    assert "bus" in data["pandapower"]
    assert "bus" in data["matpower"]


def test_new_network_endpoint_returns_empty(populated_client):
    resp = populated_client.post("/api/network/new")
    assert resp.status_code == 200
    data = resp.json()
    assert data["buses"] == []
    assert data["isEmpty"] is True
