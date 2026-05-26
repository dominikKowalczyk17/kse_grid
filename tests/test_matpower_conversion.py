"""TDD tests for MATPOWER-style input conversion (issue #6).

Written before implementation.
"""

from __future__ import annotations

import math

import pandapower as pp
import pytest
from fastapi.testclient import TestClient

import kse_grid
from kse_grid.web_server import create_app


@pytest.fixture
def client():
    return TestClient(create_app(kse_grid.KSEGrid.new_empty().net))


def test_bus_type1_creates_bus_and_load(client):
    resp = client.post(
        "/api/elements/bus?format=matpower",
        json={"fields": {"baseKV": 110, "type": 1,
                         "Pd": 50, "Qd": 20, "name": "Bus_A"}},
    )
    assert resp.status_code == 201
    net = client.get("/api/network").json()
    assert len(net["buses"]) == 1
    assert net["buses"][0]["vn_kv"] == 110.0
    assert len(net["loads"]) == 1
    assert net["loads"][0]["pMw"] == 50.0
    assert net["loads"][0]["qMvar"] == 20.0


def test_bus_type3_creates_ext_grid(client):
    resp = client.post(
        "/api/elements/bus?format=matpower",
        json={"fields": {"baseKV": 110, "type": 3, "name": "Slack"}},
    )
    assert resp.status_code == 201
    net = client.get("/api/network").json()
    assert len(net["buses"]) == 1
    assert len(net["extGrids"]) == 1
    assert net["loads"] == []


def test_branch_ratio0_creates_line_with_correct_impedance(client):
    b0 = client.post(
        "/api/elements/bus?format=matpower",
        json={"fields": {"baseKV": 110, "type": 3, "name": "B0"}},
    ).json()["created"][0]["newElementId"]
    b1 = client.post(
        "/api/elements/bus?format=matpower",
        json={"fields": {"baseKV": 110, "type": 1, "name": "B1"}},
    ).json()["created"][0]["newElementId"]

    resp = client.post(
        "/api/elements/line?format=matpower",
        json={"fields": {
            "from_bus": b0, "to_bus": b1,
            "r_pu": 0.01, "x_pu": 0.05, "b_pu": 0,
            "ratio": 0, "name": "Line01",
        }},
    )
    assert resp.status_code == 201
    # Z_base = 110²/100 = 121 Ω → r=1.21, x=6.05
    params = client.get("/api/elements/line/0").json()["params"]
    assert math.isclose(params["r_ohm_per_km"], 0.01 * 121, rel_tol=1e-6)
    assert math.isclose(params["x_ohm_per_km"], 0.05 * 121, rel_tol=1e-6)


def test_branch_ratio_nonzero_creates_trafo(client):
    hv = client.post(
        "/api/elements/bus?format=matpower",
        json={"fields": {"baseKV": 220, "type": 3, "name": "HV"}},
    ).json()["created"][0]["newElementId"]
    lv = client.post(
        "/api/elements/bus?format=matpower",
        json={"fields": {"baseKV": 110, "type": 1, "name": "LV"}},
    ).json()["created"][0]["newElementId"]

    resp = client.post(
        "/api/elements/trafo?format=matpower",
        json={"fields": {
            "hv_bus": hv, "lv_bus": lv,
            "r_pu": 0.005, "x_pu": 0.1, "ratio": 2.0,
            "sn_mva": 100, "name": "T1",
        }},
    )
    assert resp.status_code == 201
    net = client.get("/api/network").json()
    assert len(net["trafos"]) == 1


def test_round_trip_3bus_case():
    """3-bus network via matpower API matches direct pandapower build."""
    baseMVA, baseKV = 100.0, 110.0
    Z_base = baseKV ** 2 / baseMVA  # 121 Ω

    # Reference built directly with pandapower
    net_ref = pp.create_empty_network(f_hz=50)
    b0r = pp.create_bus(net_ref, vn_kv=baseKV, name="Bus0")
    b1r = pp.create_bus(net_ref, vn_kv=baseKV, name="Bus1")
    b2r = pp.create_bus(net_ref, vn_kv=baseKV, name="Bus2")
    pp.create_ext_grid(net_ref, bus=b0r, vm_pu=1.0, va_degree=0.0)
    pp.create_load(net_ref, bus=b1r, p_mw=50, q_mvar=20)
    pp.create_load(net_ref, bus=b2r, p_mw=30, q_mvar=10)
    pp.create_line_from_parameters(
        net_ref, b0r, b1r, length_km=1,
        r_ohm_per_km=0.01 * Z_base, x_ohm_per_km=0.05 * Z_base,
        c_nf_per_km=0.0, max_i_ka=9999, name="L01",
    )
    pp.create_line_from_parameters(
        net_ref, b1r, b2r, length_km=1,
        r_ohm_per_km=0.02 * Z_base, x_ohm_per_km=0.08 * Z_base,
        c_nf_per_km=0.0, max_i_ka=9999, name="L12",
    )
    pp.runpp(net_ref, tolerance_mva=1e-3)
    vm_ref = net_ref.res_bus["vm_pu"].tolist()

    # Build same network via matpower API
    grid = kse_grid.KSEGrid.new_empty()
    client = TestClient(create_app(grid.net))

    b0 = client.post("/api/elements/bus?format=matpower",
        json={"fields": {"baseKV": baseKV, "type": 3, "name": "Bus0"}},
    ).json()["created"][0]["newElementId"]
    b1 = client.post("/api/elements/bus?format=matpower",
        json={"fields": {"baseKV": baseKV, "type": 1,
                         "Pd": 50, "Qd": 20, "name": "Bus1"}},
    ).json()["created"][0]["newElementId"]
    b2 = client.post("/api/elements/bus?format=matpower",
        json={"fields": {"baseKV": baseKV, "type": 1,
                         "Pd": 30, "Qd": 10, "name": "Bus2"}},
    ).json()["created"][0]["newElementId"]

    client.post("/api/elements/line?format=matpower",
        json={"fields": {"from_bus": b0, "to_bus": b1,
                         "r_pu": 0.01, "x_pu": 0.05, "b_pu": 0,
                         "ratio": 0, "name": "L01"}})
    client.post("/api/elements/line?format=matpower",
        json={"fields": {"from_bus": b1, "to_bus": b2,
                         "r_pu": 0.02, "x_pu": 0.08, "b_pu": 0,
                         "ratio": 0, "name": "L12"}})

    client.post("/api/powerflow/recalculate")
    buses = sorted(client.get("/api/network").json()["buses"], key=lambda x: x["id"])
    vm_api = [b["vmPu"] for b in buses]

    assert len(vm_api) == len(vm_ref)
    for vm_a, vm_r in zip(vm_api, vm_ref):
        assert abs(vm_a - vm_r) < 1e-4, f"vm_api={vm_a:.6f} vm_ref={vm_r:.6f}"
