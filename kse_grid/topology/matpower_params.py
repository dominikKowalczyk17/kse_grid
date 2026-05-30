"""MATPOWER per-unit → pandapower physical-unit conversion.

All conversion logic lives here; web_server.py only calls these
functions and passes the results to SwitchingSession.create_element.
"""

from __future__ import annotations

import math
from typing import Any

_BASE_MVA = 100.0  # MATPOWER system base (MVA)
_MAX_I_KA_DEFAULT = 9999.0  # unlimited thermal rating sentinel


def _require(fields: dict[str, Any], key: str, label: str = "") -> Any:
    """Return fields[key] or raise ValueError with a user-readable message."""
    if key not in fields:
        msg = f"Brakuje wymaganego pola '{key}'"
        if label:
            msg += f" ({label})"
        raise ValueError(msg + ".")
    return fields[key]


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
    base_kv = float(_require(fields, "baseKV", "napięcie znamionowe w kV"))
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
    *,
    kind: str = "line",
) -> tuple[str, dict[str, Any]]:
    """Convert MATPOWER branch to (kind, pandapower_fields).

    When kind='line', ratio is assumed 0 (linia).
    When kind='trafo', ratio from fields determines the tap; must be ≠ 0/1.
    base_kv comes from the from_bus / hv_bus voltage level (kV).
    """
    is_line = kind == "line"
    ratio = 0.0 if is_line else float(fields.get("ratio", 0.0))

    name = str(fields.get("name", ""))
    r_pu = float(_require(fields, "r_pu", "rezystancja szeregowa w j.w."))
    x_pu = float(_require(fields, "x_pu", "reaktancja szeregowa w j.w."))
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
    vn_hv_kv = float(fields.get("vn_hv_kv", base_kv * (ratio if ratio > 0 else 1.0)))
    vn_lv_kv = float(fields.get("vn_lv_kv", base_kv))
    hv_bus = fields.get("hv_bus") or fields.get("from_bus")
    lv_bus = fields.get("lv_bus") or fields.get("to_bus")
    return ("trafo", {
        "hv_bus": hv_bus,
        "lv_bus": lv_bus,
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
        "bus": _require(fields, "bus", "id szyny"),
        "p_mw": float(_require(fields, "Pg", "moc czynna w MW")),
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
    {"name": "baseKV", "unit": "kV", "required": True, "type": "enum",
     "options": [15.0, 30.0, 110.0, 220.0, 400.0],
     "description": "Napięcie znamionowe szyny [kV]; ustawia vn_kv."},
    {"name": "type", "unit": None, "required": True, "type": "enum", "options": [1, 2, 3],
     "labels": ["1 — PQ (odbiornikowa)", "2 — PV (generatorowa)", "3 — Slack (bilansowa)"],
     "description": "Typ szyny: 1=szyna PQ (odbiornikowa), 2=szyna PV (generatorowa), 3=szyna bilansu (slack)."},
    {"name": "Pd", "unit": "MW", "required": False,
     "description": "Zapotrzebowanie na moc czynną [MW]; tworzy odbiór gdy niezerowe."},
    {"name": "Qd", "unit": "Mvar", "required": False,
     "description": "Zapotrzebowanie na moc bierną [Mvar]; tworzy odbiór gdy niezerowe."},
    {"name": "Gs", "unit": "MW", "required": False,
     "description": "Konduktancja gałęzi równoległej [MW przy 1 p.u.]; tworzy shunt gdy niezerowa."},
    {"name": "Bs", "unit": "Mvar", "required": False,
     "description": "Susceptancja gałęzi równoległej [Mvar przy 1 p.u.]; tworzy shunt gdy niezerowa."},
    {"name": "Vm", "unit": "p.u.", "required": False,
     "description": "Nastawione napięcie [p.u.] dla szyn slack i PV."},
    {"name": "Va", "unit": "deg", "required": False,
     "description": "Kąt napięcia [°] dla szyny bilansu (referencja, zazwyczaj 0)."},
    {"name": "name", "unit": None, "required": False,
     "description": "Etykieta tekstowa szyny."},
]

LINE_SCHEMA: list[dict[str, Any]] = [
    {"name": "from_bus", "unit": None, "required": True,
     "description": "Szyna, od której odchodzi linia."},
    {"name": "to_bus", "unit": None, "required": True,
     "description": "Szyna, do której dochodzi linia."},
    {"name": "r_pu", "unit": "p.u.", "required": True,
     "description": "Rezystancja szeregowa [p.u.] na bazie systemowej (Sbase=100 MVA)."},
    {"name": "x_pu", "unit": "p.u.", "required": True,
     "description": "Reaktancja szeregowa [p.u.] na bazie systemowej."},
    {"name": "b_pu", "unit": "p.u.", "required": False,
     "description": "Susceptancja bocznikowa całkowita [p.u.]; 0 = brak shuntu."},
    {"name": "rateA", "unit": "MVA", "required": False,
     "description": "Dopuszczalne obciążenie ciągłe [MVA]; 0 = bez ograniczeń."},
    {"name": "name", "unit": None, "required": False,
     "description": "Etykieta tekstowa linii."},
]

TRAFO_SCHEMA: list[dict[str, Any]] = [
    {"name": "hv_bus", "unit": None, "required": True,
     "description": "Szyna strony wysokiego napięcia (WN)."},
    {"name": "lv_bus", "unit": None, "required": True,
     "description": "Szyna strony niskiego napięcia (nN)."},
    {"name": "r_pu", "unit": "p.u.", "required": True,
     "description": "Rezystancja szeregowa [p.u.] na bazie systemowej (Sbase=100 MVA)."},
    {"name": "x_pu", "unit": "p.u.", "required": True,
     "description": "Reaktancja szeregowa [p.u.] na bazie systemowej."},
    {"name": "ratio", "unit": None, "required": True,
     "description": "Przekładnia napięciowa (np. 110/30 kV → wpisz 1.1 dla 10% powyżej znamionowej). Musi być różna od 0 i 1."},
    {"name": "sn_mva", "unit": "MVA", "required": False,
     "description": "Moc znamionowa transformatora [MVA]; domyślnie 100 MVA."},
    {"name": "name", "unit": None, "required": False,
     "description": "Etykieta tekstowa transformatora."},
]

BRANCH_SCHEMA = LINE_SCHEMA  # backward compat alias

GEN_SCHEMA: list[dict[str, Any]] = [
    {"name": "bus", "unit": None, "required": True,
     "description": "Id szyny, do której przyłączony jest generator."},
    {"name": "Pg", "unit": "MW", "required": True,
     "description": "Moc czynna generatora [MW]; mapuje się na p_mw."},
    {"name": "Vg", "unit": "p.u.", "required": False,
     "description": "Zadane napięcie generatora [p.u.]; mapuje się na vm_pu."},
    {"name": "Pmax", "unit": "MW", "required": False,
     "description": "Maksymalna moc czynna generatora [MW]."},
    {"name": "Pmin", "unit": "MW", "required": False,
     "description": "Minimalna moc czynna generatora [MW]."},
    {"name": "Qmax", "unit": "Mvar", "required": False,
     "description": "Maksymalna moc bierna generatora [Mvar]."},
    {"name": "Qmin", "unit": "Mvar", "required": False,
     "description": "Minimalna moc bierna generatora [Mvar]."},
    {"name": "name", "unit": None, "required": False,
     "description": "Etykieta tekstowa generatora."},
]

MATPOWER_SCHEMA: dict[str, list[dict[str, Any]]] = {
    "bus": BUS_SCHEMA,
    "line": LINE_SCHEMA,
    "trafo": TRAFO_SCHEMA,
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
