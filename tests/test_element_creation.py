"""TDD tests for POST /api/elements/{kind} — buses and passive elements.

Written before implementation per issue #3 TDD requirement.
"""

from __future__ import annotations

import pandapower as pp
import pytest
from fastapi.testclient import TestClient

import kse_grid
from kse_grid.web_server import create_app


@pytest.fixture
def empty_client():
    grid = kse_grid.KSEGrid.new_empty()
    return TestClient(create_app(grid.net))


@pytest.fixture
def client_with_bus(empty_client):
    resp = empty_client.post("/api/elements/bus", json={"fields": {"vn_kv": 110, "name": "Bus_1"}})
    assert resp.status_code == 201
    bus_id = resp.json()["newElementId"]
    return empty_client, bus_id


def test_create_bus_returns_id(empty_client):
    resp = empty_client.post("/api/elements/bus", json={"fields": {"vn_kv": 110, "name": "HV_Bus_1"}})
    assert resp.status_code == 201
    data = resp.json()
    assert isinstance(data["newElementId"], int)
    assert "topologyUpdate" in data


def test_create_load_attaches_to_bus(client_with_bus):
    client, bus_id = client_with_bus
    resp = client.post(
        "/api/elements/load",
        json={"fields": {"bus": bus_id, "p_mw": 50.0, "name": "Industrial_Load_1"}},
    )
    assert resp.status_code == 201
    net_resp = client.get("/api/network")
    loads = net_resp.json()["loads"]
    assert any(load["busId"] == bus_id for load in loads)


def test_missing_required_field_returns_400(empty_client):
    resp = empty_client.post("/api/elements/bus", json={"fields": {}})
    assert resp.status_code == 400
    assert "vn_kv" in resp.json()["detail"]


def test_create_ext_grid_sets_slack(client_with_bus):
    client, bus_id = client_with_bus
    resp = client.post("/api/elements/ext_grid", json={"fields": {"bus": bus_id}})
    assert resp.status_code == 201
    net_resp = client.get("/api/network")
    assert len(net_resp.json()["extGrids"]) == 1
    assert net_resp.json()["extGrids"][0]["busId"] == bus_id
