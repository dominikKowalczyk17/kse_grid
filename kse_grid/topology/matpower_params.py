"""MATPOWER per-unit → pandapower physical-unit conversion.

All conversion logic lives here; web_server.py only calls these
functions and passes the results to SwitchingSession.create_element.
"""

from __future__ import annotations

import math
from typing import Any

_BASE_MVA = 100.0  # MATPOWER system base (MVA)
_MAX_I_KA_DEFAULT = 9999.0  # unlimited thermal rating sentinel


# ---------------------------------------------------------------------------
# Bus conversion
# ---------------------------------------------------------------------------

def convert_bus(
    fields: dict[str, Any],
    base_mva: float = _BASE_MVA,
) -> list[tuple[str, dict[str, Any]]]:
    """Convert MATPOWER bus params to ordered list of (kind, fields) ops.

    The first entry is always ("bus", ...). Subsequent entries have
    bus=None as a placeholder; callers must substitute the actual bus id.
    """
    base_kv = float(fields["baseKV"])
    bus_type = int(fields.get("type", 1))
    name = str(fields.get("name", ""))

    ops: list[tuple[str, dict[str, Any]]] = []

    ops.append(("bus", {
        "vn_kv": base_kv,
        "name": name,
        "in_service": True,
    }))

    if bus_type == 3:
        ops.append(("ext_grid", {
            "bus": None,
            "vm_pu": float(fields.get("Vm", 1.0)),
            "va_degree": float(fields.get("Va", 0.0)),
            "name": f"{name}_slack" if name else "",
        }))

    pd = float(fields.get("Pd", 0.0))
    qd = float(fields.get("Qd", 0.0))
    if pd != 0.0 or qd != 0.0:
        ops.append(("load", {
            "bus": None,
            "p_mw": pd,
            "q_mvar": qd,
            "name": f"{name}_load" if name else "",
        }))

    gs = float(fields.get("Gs", 0.0))
    bs = float(fields.get("Bs", 0.0))
    if gs != 0.0 or bs != 0.0:
        # MATPOWER Gs/Bs are in MW/Mvar at 1 p.u.; pandapower shunt uses
        # physical values at rated voltage.
        ops.append(("shunt", {
            "bus": None,
            "p_mw": gs,
            "q_mvar": -bs,
            "vn_kv": base_kv,
            "name": f"{name}_shunt" if name else "",
        }))

    return ops


# ---------------------------------------------------------------------------
# Branch conversion
# ---------------------------------------------------------------------------

def convert_branch(
    fields: dict[str, Any],
    base_kv: float,
    base_mva: float = _BASE_MVA,
) -> tuple[str, dict[str, Any]]:
    """Convert MATPOWER branch to (kind, pandapower_fields).

    ratio==0 or ratio==1 → line; any other ratio → trafo.
    base_kv comes from the from_bus / hv_bus voltage level (kV).
    """
    ratio = float(fields.get("ratio", 0.0))
    is_line = math.isclose(ratio, 0.0) or math.isclose(ratio, 1.0)

    name = str(fields.get("name", ""))
    r_pu = float(fields["r_pu"])
    x_pu = float(fields["x_pu"])
    b_pu = float(fields.get("b_pu", 0.0))
    rate_a = float(fields.get("rateA", 0.0))

    z_base = base_kv ** 2 / base_mva  # Ω

    if is_line:
        r_ohm = r_pu * z_base
        x_ohm = x_pu * z_base
        c_nf = _susceptance_to_nf(b_pu, base_kv, base_mva)
        max_i_ka = (rate_a / (math.sqrt(3) * base_kv)
                    if rate_a > 0 else _MAX_I_KA_DEFAULT)
        return ("line", {
            "from_bus": fields["from_bus"],
            "to_bus": fields["to_bus"],
            "length_km": 1.0,
            "r_ohm_per_km": r_ohm,
            "x_ohm_per_km": x_ohm,
            "c_nf_per_km": c_nf,
            "max_i_ka": max_i_ka,
            "name": name,
        })

    # Transformer
    sn_mva = float(fields.get("sn_mva", base_mva))
    # vk from r+jx in per-unit on trafo base
    vk_percent = math.sqrt(r_pu ** 2 + x_pu ** 2) * 100.0
    vkr_percent = r_pu * 100.0
    # HV/LV voltages from buses; the ratio encodes the tap
    vn_hv_kv = float(fields.get("vn_hv_kv", base_kv * ratio))
    vn_lv_kv = float(fields.get("vn_lv_kv", base_kv))
    return ("trafo", {
        "hv_bus": fields["hv_bus"],
        "lv_bus": fields["lv_bus"],
        "sn_mva": sn_mva,
        "vn_hv_kv": vn_hv_kv,
        "vn_lv_kv": vn_lv_kv,
        "vk_percent": vk_percent,
        "vkr_percent": vkr_percent,
        "pfe_kw": float(fields.get("pfe_kw", 0.0)),
        "i0_percent": float(fields.get("i0_percent", 0.0)),
        "name": name,
    })


# ---------------------------------------------------------------------------
# Gen conversion
# ---------------------------------------------------------------------------

def convert_gen(fields: dict[str, Any]) -> tuple[str, dict[str, Any]]:
    """Convert MATPOWER gen row to ('gen', pandapower_fields)."""
    return ("gen", {
        "bus": fields["bus"],
        "p_mw": float(fields["Pg"]),
        "vm_pu": float(fields.get("Vg", 1.0)),
        "max_p_mw": float(fields["Pmax"]) if "Pmax" in fields else None,
        "min_p_mw": float(fields["Pmin"]) if "Pmin" in fields else None,
        "max_q_mvar": float(fields["Qmax"]) if "Qmax" in fields else None,
        "min_q_mvar": float(fields["Qmin"]) if "Qmin" in fields else None,
        "name": str(fields.get("name", "")),
    })


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

BUS_SCHEMA: list[dict[str, Any]] = [
    {"name": "baseKV", "unit": "kV", "required": True,
     "description": "Nominal bus voltage (kV); sets vn_kv."},
    {"name": "type", "unit": None, "required": True,
     "description": "Bus type: 1=PQ load bus, 2=PV gen bus, 3=slack."},
    {"name": "Pd", "unit": "MW", "required": False,
     "description": "Active power demand; creates a load when nonzero."},
    {"name": "Qd", "unit": "Mvar", "required": False,
     "description": "Reactive power demand; creates a load when nonzero."},
    {"name": "Gs", "unit": "MW", "required": False,
     "description": "Shunt conductance at 1 p.u.; creates a shunt."},
    {"name": "Bs", "unit": "Mvar", "required": False,
     "description": "Shunt susceptance at 1 p.u.; creates a shunt."},
    {"name": "Vm", "unit": "p.u.", "required": False,
     "description": "Voltage magnitude setpoint (slack/PV buses)."},
    {"name": "Va", "unit": "deg", "required": False,
     "description": "Voltage angle (slack bus reference, typically 0)."},
    {"name": "name", "unit": None, "required": False,
     "description": "Human-readable label for the bus."},
]

BRANCH_SCHEMA: list[dict[str, Any]] = [
    {"name": "from_bus", "unit": None, "required": True,
     "description": "From-bus id (line) or hv_bus id (trafo)."},
    {"name": "to_bus", "unit": None, "required": True,
     "description": "To-bus id (line) or lv_bus id (trafo)."},
    {"name": "r_pu", "unit": "p.u.", "required": True,
     "description": "Series resistance in per-unit on system base."},
    {"name": "x_pu", "unit": "p.u.", "required": True,
     "description": "Series reactance in per-unit on system base."},
    {"name": "b_pu", "unit": "p.u.", "required": False,
     "description": "Total shunt susceptance in per-unit; 0 = no shunt."},
    {"name": "ratio", "unit": None, "required": True,
     "description": "Tap ratio: 0 or 1 → line, other → transformer."},
    {"name": "rateA", "unit": "MVA", "required": False,
     "description": "Thermal rating A; 0 = unlimited."},
    {"name": "sn_mva", "unit": "MVA", "required": False,
     "description": "Trafo rated power (only used when ratio≠0 and ≠1)."},
    {"name": "name", "unit": None, "required": False,
     "description": "Human-readable label for the branch."},
]

GEN_SCHEMA: list[dict[str, Any]] = [
    {"name": "bus", "unit": None, "required": True,
     "description": "Bus id the generator is connected to."},
    {"name": "Pg", "unit": "MW", "required": True,
     "description": "Active power output (maps to p_mw)."},
    {"name": "Vg", "unit": "p.u.", "required": False,
     "description": "Voltage magnitude setpoint (maps to vm_pu)."},
    {"name": "Pmax", "unit": "MW", "required": False,
     "description": "Maximum active power output."},
    {"name": "Pmin", "unit": "MW", "required": False,
     "description": "Minimum active power output."},
    {"name": "Qmax", "unit": "Mvar", "required": False,
     "description": "Maximum reactive power output."},
    {"name": "Qmin", "unit": "Mvar", "required": False,
     "description": "Minimum reactive power output."},
    {"name": "name", "unit": None, "required": False,
     "description": "Human-readable label for the generator."},
]

MATPOWER_SCHEMA: dict[str, list[dict[str, Any]]] = {
    "bus": BUS_SCHEMA,
    "branch": BRANCH_SCHEMA,
    "gen": GEN_SCHEMA,
}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _susceptance_to_nf(
    b_pu: float,
    base_kv: float,
    base_mva: float,
) -> float:
    """Convert per-unit total susceptance to nF (for length_km=1 line)."""
    if math.isclose(b_pu, 0.0):
        return 0.0
    b_siemens = b_pu * base_mva / (base_kv ** 2)
    c_farads = b_siemens / (2.0 * math.pi * 50.0)
    return c_farads * 1e9
