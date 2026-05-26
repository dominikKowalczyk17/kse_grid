"""TDD tests for KSEGrid.new_empty() + empty-network guards.

Written before implementation per issue #2 TDD requirement.
"""

from __future__ import annotations

import pandapower as pp
from fastapi.testclient import TestClient

import kse_grid
from kse_grid.topology.switching import SwitchingSession
from kse_grid.web_server import create_app


def test_new_empty_creates_valid_session():
    grid = kse_grid.KSEGrid.new_empty()
    assert grid.net is not None
    assert grid.net.bus.empty
    session = SwitchingSession(grid.net)
    assert session.working_net.bus.empty


def test_api_returns_empty_arrays():
    grid = kse_grid.KSEGrid.new_empty()
    client = TestClient(create_app(grid.net))
    response = client.get("/api/network")
    assert response.status_code == 200
    data = response.json()
    assert data["buses"] == []
    assert data["lines"] == []
    assert data["trafos"] == []
    assert data["loads"] == []
    assert data["gens"] == []


def test_runpp_not_called_on_empty(monkeypatch):
    called = []
    monkeypatch.setattr(pp, "runpp", lambda *a, **kw: called.append(1))
    SwitchingSession(pp.create_empty_network())
    assert called == [], "runpp must not be invoked for an empty network"
