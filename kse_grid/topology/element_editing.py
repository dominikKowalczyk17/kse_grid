"""Schema of editable parameters for pandapower network elements.

Keeps in one place the list of fields the frontend can modify in the selection
panel, plus the type-coercion logic. The goal is that the HTTP layer does not
need to know pandapower model details, while `SwitchingSession` has a single
simple API for mutating elements.
"""

from __future__ import annotations

import math
from typing import Any

import pandapower as pp
import pandas as pd

# ---------------------------------------------------------------------------
# Schema
# ---------------------------------------------------------------------------

# Each entry: (column, label, type, unit, options, description)
# - type ∈ {"str", "float", "int", "bool", "enum"}
# - options used only for "enum"
# - description: short English description for tooltip / help modal
_BUS_FIELDS: list[tuple] = [
    ("name", "Name", "str", None, None,
     "Bus label — useful for identification in results and on the graph. "
     "Does not affect calculation results."),
    ("vn_kv", "Un", "float", "kV", None,
     "Nominal voltage of the bus (kV). Base value for per-unit conversions. "
     "Changing it requires consistency with the nominal voltages of connected elements."),
    ("type", "Bus type", "enum", None, ["b", "n", "m"],
     "Node type in the pandapower model:\n"
     "• b – busbar,\n"
     "• n – node without a physical busbar,\n"
     "• m – auxiliary node (muff), e.g. for line bending."),
    ("zone", "Zone", "str", None, None,
     "Arbitrary zone/region label. Used in reporting and grouping; "
     "does not affect load flow."),
    ("max_vm_pu", "U max", "float", "p.u.", None,
     "Upper permissible voltage level (p.u.). Used in voltage violation analyses "
     "and in OPF."),
    ("min_vm_pu", "U min", "float", "p.u.", None,
     "Lower permissible voltage level (p.u.). Used in voltage violation analyses "
     "and in OPF."),
    ("in_service", "In service", "bool", None, None,
     "When disabled, the bus and all elements connected to it are excluded "
     "from calculations (equivalent to physical disconnection)."),
]

_LINE_FIELDS: list[tuple] = [
    ("name", "Name", "str", None, None,
     "Line label — does not affect results, aids identification."),
    ("length_km", "Length", "float", "km", None,
     "Line length in kilometres. Multiplied by per-unit parameters "
     "(R', X', C', G') when building the admittance matrix."),
    ("r_ohm_per_km", "R'", "float", "Ω/km", None,
     "Per-unit resistance of the line (Ω/km). Determines active losses "
     "and voltage drops in steady state."),
    ("x_ohm_per_km", "X'", "float", "Ω/km", None,
     "Per-unit reactance of the line (Ω/km). Main parameter determining "
     "reactive power flow and voltage angles."),
    ("c_nf_per_km", "C' (source of B')", "float", "nF/km", None,
     "Per-unit shunt capacitance to ground (nF/km). This field is the source of "
     "line susceptance in the admittance matrix — pandapower does not store B' "
     "separately but computes B' = 2π·f·C'·10⁻³ [µS/km] (at 50 Hz: B' ≈ 0.3142·C').\n"
     "From MATPOWER: the `b` column (per-unit, total) is converted to C' by the "
     "importer. Affects reactive power generation of the line (Ferranti effect "
     "under light load)."),
    ("g_us_per_km", "G' (shunt conductance)", "float", "µS/km", None,
     "Per-unit shunt conductance to ground (µS/km). Not imported from MATPOWER "
     "(MATPOWER has no G column for branches) — usually close to 0 for overhead lines."),
    ("max_i_ka", "I max", "float", "kA", None,
     "Thermal current rating of the line (kA). Used together with Un to compute "
     "the percentage loading of the line."),
    ("df", "Derating factor", "float", None, None,
     "Capacity derating factor. A value of 1.0 means no derating. Applied e.g. "
     "for lines operating in adverse conditions."),
    ("parallel", "Parallel circuits", "int", None, None,
     "Number of parallel circuits with identical parameters. Increasing it reduces "
     "the effective impedance and increases the current rating."),
    ("type", "Line type", "enum", None, ["", "cs", "ol"],
     "Line type in the pandapower model:\n"
     "• cs – underground cable,\n"
     "• ol – overhead line,\n"
     "• empty – unspecified."),
    ("max_loading_percent", "Max loading", "float", "%", None,
     "Upper permissible loading level of the line (%). Used for overload flagging "
     "and in OPF."),
    ("in_service", "In service", "bool", None, None,
     "When disabled, the line is excluded from calculations (both ends disconnected)."),
]

_TRAFO_FIELDS: list[tuple] = [
    ("name", "Name", "str", None, None,
     "Transformer label — does not affect results."),
    ("sn_mva", "Sn", "float", "MVA", None,
     "Nominal power of the transformer (MVA). Base value for computing "
     "percentage loading and physical-unit impedances."),
    ("vn_hv_kv", "Un HV", "float", "kV", None,
     "Nominal voltage on the high-voltage side (kV). Should match the "
     "voltage of the HV bus the transformer is connected to."),
    ("vn_lv_kv", "Un LV", "float", "kV", None,
     "Nominal voltage on the low-voltage side (kV). Should match the LV bus voltage."),
    ("vk_percent", "uk", "float", "%", None,
     "Short-circuit voltage of the transformer (%). Defines the total short-term "
     "impedance — critical for power flow and fault current calculations."),
    ("vkr_percent", "ukr", "float", "%", None,
     "Resistive component of the short-circuit voltage (%). Used to compute load "
     "losses (winding losses). Must be ≤ uk."),
    ("pfe_kw", "ΔP Fe", "float", "kW", None,
     "No-load (iron core) losses in kW. Constant losses independent of loading."),
    ("i0_percent", "i0", "float", "%", None,
     "No-load current as a percentage of rated current. Determines the "
     "magnetising branch in the equivalent circuit."),
    ("shift_degree", "Phase shift", "float", "°", None,
     "Phase shift introduced by the winding connection group (e.g. Yd11 = 30°). "
     "Relevant for multi-phase analyses and asymmetric fault studies."),
    ("tap_side", "Tap side", "enum", None, ["", "hv", "lv"],
     "Side of the transformer where the tap changer is located: "
     "hv = high voltage, lv = low voltage."),
    ("tap_neutral", "Neutral tap", "int", None, None,
     "Tap position corresponding to the nominal turns ratio (usually 0)."),
    ("tap_min", "Tap min", "int", None, None,
     "Lowest permissible tap position."),
    ("tap_max", "Tap max", "int", None, None,
     "Highest permissible tap position."),
    ("tap_step_percent", "Tap step", "float", "%", None,
     "Voltage ratio change per tap step (%)."),
    ("tap_step_degree", "Tap angle step", "float", "°", None,
     "Phase shift change per tap step (°). Applies to phase-shifting transformers."),
    ("tap_pos", "Tap position", "int", None, None,
     "Current tap position used in calculations."),
    ("parallel", "Parallel units", "int", None, None,
     "Number of identical transformers operating in parallel represented "
     "by this object."),
    ("df", "Derating factor", "float", None, None,
     "Capacity derating factor."),
    ("max_loading_percent", "Max loading", "float", "%", None,
     "Upper permissible loading level of the transformer (%)."),
    ("in_service", "In service", "bool", None, None,
     "When disabled, the transformer is excluded from calculations."),
]

_SWITCH_FIELDS: list[tuple] = [
    ("name", "Name", "str", None, None,
     "Switch label — does not affect results."),
    ("type", "Type", "enum", None, ["", "CB", "LBS", "LS", "DS"],
     "Apparatus type:\n"
     "• CB – Circuit Breaker,\n"
     "• LBS – Load-Break Switch,\n"
     "• LS – Load Switch,\n"
     "• DS – Disconnector."),
    ("closed", "Closed", "bool", None, None,
     "Switch state: closed (conducting) or open (break). "
     "Changes directly affect topology and load flow results."),
    ("z_ohm", "Impedance", "float", "Ω", None,
     "Equivalent impedance of the switch when closed (Ω). Normally 0 — "
     "set non-zero to model contact impedance."),
    ("in_ka", "I max", "float", "kA", None,
     "Rated continuous current of the apparatus (kA)."),
]


_GEN_FIELDS: list[tuple] = [
    ("name", "Name", "str", None, None,
     "Generator label — useful for identification."),
    ("in_service", "In service", "bool", None, None,
     "When disabled, the generator is excluded from calculations (taken out of service). "
     "Disabling converts the bus from PV to PQ and removes voltage regulation."),
    ("p_mw", "P setpoint", "float", "MW", None,
     "Active power setpoint of the generator (MW). In PV load flow the generator "
     "maintains this setpoint within the Pmax/Pmin limits."),
    ("vm_pu", "U setpoint", "float", "p.u.", None,
     "Voltage setpoint (p.u.) on the bus the generator regulates. "
     "Active only when the generator is PV (in_service=True)."),
    ("max_p_mw", "P max", "float", "MW", None,
     "Maximum active power of the generator (MW). Limits output in OPF."),
    ("min_p_mw", "P min", "float", "MW", None,
     "Minimum active power of the generator (MW). Limits output in OPF."),
    ("max_q_mvar", "Q max", "float", "Mvar", None,
     "Maximum reactive power (Mvar). When the limit is reached the generator "
     "switches from voltage regulation to Q regulation."),
    ("min_q_mvar", "Q min", "float", "Mvar", None,
     "Minimum reactive power (Mvar). Lower bound on Q."),
]


_LOAD_FIELDS: list[tuple] = [
    ("name", "Name", "str", None, None,
     "Load label — useful for identification."),
    ("p_mw", "P load", "float", "MW", None,
     "Consumed active power (MW). MATPOWER `Pd` in the bus row maps here."),
    ("q_mvar", "Q load", "float", "Mvar", None,
     "Consumed reactive power (Mvar). MATPOWER `Qd`."),
    ("const_z_percent", "Constant Z share", "float", "%", None,
     "Percentage of load modelled as constant impedance (ZIP). Z+I+P should sum to 100."),
    ("const_i_percent", "Constant I share", "float", "%", None,
     "Percentage of load modelled as constant current (ZIP)."),
    ("sn_mva", "Sn", "float", "MVA", None,
     "Nominal power of the load (MVA) — used for ZIP scaling."),
    ("scaling", "Scaling factor", "float", None, None,
     "Multiplier applied to P and Q in calculations (e.g. daily load profile)."),
    ("type", "Type", "enum", None, ["", "wye", "delta"],
     "Connection scheme: wye (star) or delta."),
    ("controllable", "Controllable (OPF)", "bool", None, None,
     "Whether OPF can modify P/Q (load shedding / DSM)."),
    ("in_service", "In service", "bool", None, None,
     "When disabled, the load is excluded from calculations."),
]

_SGEN_FIELDS: list[tuple] = [
    ("name", "Name", "str", None, None,
     "Static generator label (PV / wind / farm)."),
    ("p_mw", "P", "float", "MW", None,
     "Injected active power (MW). Convention: positive = generation."),
    ("q_mvar", "Q", "float", "Mvar", None,
     "Injected reactive power (Mvar)."),
    ("sn_mva", "Sn", "float", "MVA", None,
     "Nominal power (MVA)."),
    ("scaling", "Scaling factor", "float", None, None,
     "Multiplier applied to P and Q in calculations."),
    ("type", "Type", "str", None, None,
     "Arbitrary type label (e.g. 'PV', 'WT'). Does not affect load flow."),
    ("current_source", "Current source", "bool", None, None,
     "When True, the model treats this as a current source (relevant for fault analysis)."),
    ("max_p_mw", "P max", "float", "MW", None,
     "Maximum active power (OPF)."),
    ("min_p_mw", "P min", "float", "MW", None,
     "Minimum active power (OPF)."),
    ("max_q_mvar", "Q max", "float", "Mvar", None,
     "Maximum reactive power (OPF)."),
    ("min_q_mvar", "Q min", "float", "Mvar", None,
     "Minimum reactive power (OPF)."),
    ("controllable", "Controllable (OPF)", "bool", None, None,
     "Whether OPF can change P/Q."),
    ("in_service", "In service", "bool", None, None,
     "When disabled, excluded from calculations."),
]

_EXT_GRID_FIELDS: list[tuple] = [
    ("name", "Name", "str", None, None,
     "External grid (slack) label."),
    ("vm_pu", "U setpoint", "float", "p.u.", None,
     "Slack bus voltage setpoint (p.u.). MATPOWER `Vg` for the slack row."),
    ("va_degree", "Angle setpoint", "float", "°", None,
     "Slack bus voltage angle (°). Usually 0 as the reference node."),
    ("slack_weight", "Slack weight", "float", None, None,
     "Share of loss coverage — relevant only when multiple slacks are present."),
    ("max_p_mw", "P max", "float", "MW", None,
     "Maximum active power injected into the network (OPF)."),
    ("min_p_mw", "P min", "float", "MW", None,
     "Minimum active power (OPF; may be negative = consumption)."),
    ("max_q_mvar", "Q max", "float", "Mvar", None,
     "Maximum reactive power (OPF)."),
    ("min_q_mvar", "Q min", "float", "Mvar", None,
     "Minimum reactive power (OPF)."),
    ("controllable", "Controllable (OPF)", "bool", None, None,
     "Whether OPF can modify P/Q of the slack."),
    ("in_service", "In service", "bool", None, None,
     "When disabled, the slack is inactive — the system loses its reference point."),
]

_SHUNT_FIELDS: list[tuple] = [
    ("name", "Name", "str", None, None,
     "Shunt element label (capacitor bank / reactor)."),
    ("p_mw", "P (Gs)", "float", "MW", None,
     "Active losses of the shunt at nominal voltage. MATPOWER `Gs`."),
    ("q_mvar", "Q (Bs)", "float", "Mvar", None,
     "Q generation at U=1 p.u. Positive = capacitor, negative = reactor. MATPOWER `Bs`."),
    ("vn_kv", "Un", "float", "kV", None,
     "Nominal voltage of the shunt (kV) — base for admittance conversion."),
    ("step", "Current step", "int", None, None,
     "Currently connected regulation step."),
    ("max_step", "Step count", "int", None, None,
     "Maximum number of regulation steps."),
    ("in_service", "In service", "bool", None, None,
     "When disabled, the shunt contributes no admittance to the matrix."),
]


# ---------------------------------------------------------------------------
# Element creation schema
# ---------------------------------------------------------------------------

# Structure: {kind: {required: [(name, type)], optional: [(name, type, options)], defaults: {name: value}}}
_CREATION_SCHEMA: dict[str, dict[str, Any]] = {
    "bus": {
        "required": [("vn_kv", "float")],
        "optional": [
            ("name", "str", None),
            ("type", "enum", ["b", "n", "m"]),
            ("in_service", "bool", ["true", "false"]),
        ],
        "defaults": {"name": "", "type": "b", "in_service": True},
    },
    "load": {
        "required": [("bus", "int"), ("p_mw", "float")],
        "optional": [
            ("name", "str", None),
            ("q_mvar", "float", None),
            ("scaling", "float", None),
            ("in_service", "bool", ["true", "false"]),
        ],
        "defaults": {"name": "", "q_mvar": 0.0, "scaling": 1.0, "in_service": True},
    },
    "sgen": {
        "required": [("bus", "int"), ("p_mw", "float")],
        "optional": [
            ("name", "str", None),
            ("q_mvar", "float", None),
            ("scaling", "float", None),
            ("in_service", "bool", ["true", "false"]),
        ],
        "defaults": {"name": "", "q_mvar": 0.0, "scaling": 1.0, "in_service": True},
    },
    "ext_grid": {
        "required": [("bus", "int")],
        "optional": [
            ("name", "str", None),
            ("vm_pu", "float", None),
            ("va_degree", "float", None),
            ("in_service", "bool", ["true", "false"]),
        ],
        "defaults": {"name": "", "vm_pu": 1.0, "va_degree": 0.0, "in_service": True},
    },
    "shunt": {
        "required": [("bus", "int"), ("q_mvar", "float"), ("vn_kv", "float")],
        "optional": [
            ("name", "str", None),
            ("p_mw", "float", None),
            ("in_service", "bool", ["true", "false"]),
        ],
        "defaults": {"name": "", "p_mw": 0.0, "in_service": True},
    },
    "line": {
        "required": [
            ("from_bus", "int"), ("to_bus", "int"), ("length_km", "float"),
            ("r_ohm_per_km", "float"), ("x_ohm_per_km", "float"),
            ("c_nf_per_km", "float"), ("max_i_ka", "float"),
        ],
        "optional": [
            ("name", "str", None),
            ("g_us_per_km", "float", None),
            ("parallel", "int", [1, 2, 3, 4, 5, 6]),
            ("in_service", "bool", ["true", "false"]),
        ],
        "defaults": {"name": "", "g_us_per_km": 0.0, "parallel": 1, "in_service": True},
    },
    "trafo": {
        "required": [
            ("hv_bus", "int"), ("lv_bus", "int"), ("sn_mva", "float"),
            ("vn_hv_kv", "float"), ("vn_lv_kv", "float"),
            ("vk_percent", "float"), ("vkr_percent", "float"),
            ("pfe_kw", "float"), ("i0_percent", "float"),
        ],
        "optional": [
            ("name", "str", None),
            ("tap_neutral", "int", None),
            ("tap_min", "int", None),
            ("tap_max", "int", None),
            ("tap_step_percent", "float", None),
            ("tap_pos", "int", None),
            ("parallel", "int", [1, 2, 3, 4, 5, 6]),
            ("in_service", "bool", ["true", "false"]),
        ],
        "defaults": {
            "name": "", "tap_neutral": 0, "tap_min": -2, "tap_max": 2,
            "tap_step_percent": 1.25, "tap_pos": 0, "parallel": 1, "in_service": True,
        },
    },
    "gen": {
        "required": [("bus", "int"), ("p_mw", "float")],
        "optional": [
            ("name", "str", None),
            ("vm_pu", "float", None),
            ("max_q_mvar", "float", None),
            ("min_q_mvar", "float", None),
            ("max_p_mw", "float", None),
            ("min_p_mw", "float", None),
            ("in_service", "bool", ["true", "false"]),
        ],
        "defaults": {"name": "", "vm_pu": 1.0, "in_service": True},
    },
}

_CREATORS: dict[str, Any] = {
    "bus": pp.create_bus,
    "load": pp.create_load,
    "sgen": pp.create_sgen,
    "ext_grid": pp.create_ext_grid,
    "shunt": pp.create_shunt,
    "line": pp.create_line_from_parameters,
    "trafo": pp.create_transformer_from_parameters,
    "gen": pp.create_gen,
}

_AUTO_NAME_PREFIX: dict[str, str] = {
    "bus": "Bus",
    "load": "Load",
    "sgen": "SGen",
    "ext_grid": "Grid",
    "shunt": "Shunt",
    "line": "Line",
    "trafo": "Trafo",
    "gen": "Gen",
}


_TABLES = {
    "bus": ("bus", _BUS_FIELDS),
    "line": ("line", _LINE_FIELDS),
    "trafo": ("trafo", _TRAFO_FIELDS),
    "switch": ("switch", _SWITCH_FIELDS),
    "gen": ("gen", _GEN_FIELDS),
    "load": ("load", _LOAD_FIELDS),
    "sgen": ("sgen", _SGEN_FIELDS),
    "ext_grid": ("ext_grid", _EXT_GRID_FIELDS),
    "shunt": ("shunt", _SHUNT_FIELDS),
}


def field_schema() -> dict[str, list[dict[str, Any]]]:
    """Return the editable field schema in a JSON-serialisable format."""
    schema: dict[str, list[dict[str, Any]]] = {}
    for kind, (_table, fields) in _TABLES.items():
        schema[kind] = [
            {
                "field": name,
                "label": label,
                "type": ftype,
                "unit": unit,
                "options": options,
                "description": description,
            }
            for (name, label, ftype, unit, options, description) in fields
        ]
    return schema


# ---------------------------------------------------------------------------
# Element creation form schema
# ---------------------------------------------------------------------------

_CREATION_FIELD_META: dict[str, tuple] = {
    "vn_kv":           ("Un",             "kV",     "Nominal bus voltage.",                          [15.0, 30.0, 110.0, 220.0, 400.0]),
    "from_bus":        ("From bus",        None,     "Bus from which the line departs.",              None),
    "to_bus":          ("To bus",          None,     "Bus at which the line arrives.",                None),
    "hv_bus":          ("HV bus",          None,     "High-voltage side bus.",                        None),
    "lv_bus":          ("LV bus",          None,     "Low-voltage side bus.",                         None),
    "bus":             ("Bus",             None,     "Connection bus of the element.",                None),
    "p_mw":            ("P",              "MW",     "Active power.",                                  None),
    "q_mvar":          ("Q",              "Mvar",   "Reactive power.",                                None),
    "length_km":       ("Length",         "km",     "Line section length.",                           None),
    "r_ohm_per_km":    ("R",              "Ω/km",   "Per-unit resistance.",                           None),
    "x_ohm_per_km":    ("X",              "Ω/km",   "Per-unit reactance.",                            None),
    "c_nf_per_km":     ("C",              "nF/km",  "Per-unit capacitance.",                          None),
    "max_i_ka":        ("Imax",           "kA",     "Maximum continuous current.",                    None),
    "sn_mva":          ("Sn",             "MVA",    "Nominal transformer power.",                     None),
    "vn_hv_kv":        ("Un HV",          "kV",     "Nominal voltage on the HV side.",               None),
    "vn_lv_kv":        ("Un LV",          "kV",     "Nominal voltage on the LV side.",               None),
    "vk_percent":      ("uk",             "%",      "Short-circuit voltage of the transformer.",      None),
    "vkr_percent":     ("ukr",            "%",      "Resistive component of short-circuit voltage.",  None),
    "pfe_kw":          ("Pfe",            "kW",     "Iron core losses (no-load).",                   None),
    "i0_percent":      ("i0",             "%",      "No-load current.",                               None),
    "vm_pu":           ("Um",             "p.u.",   "Voltage setpoint (magnitude).",                 None),
    "va_degree":       ("δ",              "°",      "Voltage angle of the reference node.",          None),
    "name":            ("Name",           None,     "Text label for the element.",                    None),
    "type":            ("Bus type",       None,     "Node type (b=busbar, n=node, m=auxiliary).",     ["b", "n", "m"]),
    "in_service":      ("In service",     None,     "Whether the element is active.",                 ["true", "false"], ["Yes", "No"]),
    "g_us_per_km":     ("G",              "μS/km",  "Per-unit conductance.",                          None,                None),
    "parallel":        ("Parallel",       None,     "Number of parallel circuits.",                   [1, 2, 3, 4, 5, 6],  None),
    "scaling":         ("Scaling",        None,     "Power scaling factor.",                          None),
    "max_q_mvar":      ("Qmax",           "Mvar",   "Maximum reactive power of the generator.",       None),
    "min_q_mvar":      ("Qmin",           "Mvar",   "Minimum reactive power of the generator.",       None),
    "max_p_mw":        ("Pmax",           "MW",     "Maximum active power of the generator.",         None),
    "min_p_mw":        ("Pmin",           "MW",     "Minimum active power of the generator.",         None),
    "tap_neutral":     ("Tap neutral",    None,     "Tap regulator position at nominal ratio.",       None),
    "tap_min":         ("Tap min",        None,     "Minimum regulator position.",                    None),
    "tap_max":         ("Tap max",        None,     "Maximum regulator position.",                    None),
    "tap_step_percent":("Tap step",       "%",      "Voltage change per regulator step.",             None),
    "tap_pos":         ("Tap position",   None,     "Current regulator position.",                    None),
}


def creation_field_schema() -> dict[str, list[dict[str, Any]]]:
    """Return the element creation form field schema (pandapower)."""
    result: dict[str, list[dict[str, Any]]] = {}
    for kind, schema in _CREATION_SCHEMA.items():
        required_names = {name for name, _ in schema["required"]}
        all_fields: list[tuple[str, str, list | None]] = [
            (name, ftype, None) for name, ftype in schema["required"]
        ] + [
            (name, ftype, options) for name, ftype, options in schema["optional"]
        ]
        fields: list[dict[str, Any]] = []
        for name, ftype, schema_options in all_fields:
            meta = _CREATION_FIELD_META.get(name, (name, None, None, None))
            label, unit, description, meta_options, *_rest = (*meta, None)
            labels: list | None = _rest[0] if _rest else None
            options = schema_options if schema_options is not None else meta_options
            resolved_type = "enum" if options else ftype
            entry: dict[str, Any] = {
                "name": name,
                "label": label,
                "type": resolved_type,
                "unit": unit,
                "options": options,
                "description": description,
                "required": name in required_names,
            }
            if labels is not None:
                entry["labels"] = labels
            fields.append(entry)
        result[kind] = fields
    return result


# ---------------------------------------------------------------------------
# Read / write
# ---------------------------------------------------------------------------

def _resolve(net: pp.pandapowerNet, kind: str, element_id: int) -> tuple[pd.DataFrame, list[tuple]]:
    if kind not in _TABLES:
        raise KeyError(f"Unknown element type: {kind!r}.")
    table_name, fields = _TABLES[kind]
    table = getattr(net, table_name)
    if element_id not in table.index:
        raise KeyError(f"Element {kind} #{element_id} does not exist.")
    return table, fields


def read_element_params(net: pp.pandapowerNet, kind: str, element_id: int) -> dict[str, Any]:
    """Return the current values of editable fields for the given element."""
    table, fields = _resolve(net, kind, element_id)
    out: dict[str, Any] = {}
    for name, _label, ftype, _unit, _options, _description in fields:
        if name not in table.columns:
            out[name] = None
            continue
        raw = table.at[element_id, name]
        out[name] = _normalize_for_json(raw, ftype)
    return out


def apply_element_update(
    net: pp.pandapowerNet,
    kind: str,
    element_id: int,
    fields: dict[str, Any],
) -> None:
    """Mutate the element row according to the supplied fields.

    Raises `ValueError` on an unknown field or failed type coercion so that
    the HTTP layer can return 400 without any additional inspection.
    """
    table, schema_fields = _resolve(net, kind, element_id)
    schema_index = {
        name: (ftype, options)
        for (name, _label, ftype, _unit, options, _description) in schema_fields
    }

    for raw_name, raw_value in fields.items():
        if raw_name not in schema_index:
            raise ValueError(f"Field {raw_name!r} is not editable for {kind}.")
        ftype, options = schema_index[raw_name]
        coerced = _coerce(raw_name, raw_value, ftype, options)
        if raw_name not in table.columns:
            table[raw_name] = None
        table.at[element_id, raw_name] = coerced


# ---------------------------------------------------------------------------
# Type helpers
# ---------------------------------------------------------------------------

def _normalize_for_json(value: Any, ftype: str) -> Any:
    if value is None:
        return None
    if isinstance(value, float) and (math.isnan(value) or math.isinf(value)):
        return None
    if pd.isna(value):
        return None
    if ftype == "bool":
        return bool(value)
    if ftype == "int":
        try:
            return int(value)
        except (TypeError, ValueError):
            return None
    if ftype == "float":
        try:
            return float(value)
        except (TypeError, ValueError):
            return None
    return str(value)


def _coerce(name: str, value: Any, ftype: str, options: list | None) -> Any:
    if value is None or (isinstance(value, str) and value == "" and ftype != "str"):
        # Optional fields — allow "clearing" (NaN) everywhere except str.
        if ftype == "str":
            return ""
        return float("nan") if ftype in {"float", "int"} else None

    if ftype == "bool":
        if isinstance(value, bool):
            return value
        if isinstance(value, str):
            return value.strip().lower() in {"true", "1", "yes"}
        return bool(value)

    if ftype == "int":
        try:
            return int(float(value))
        except (TypeError, ValueError) as exc:
            raise ValueError(f"Field {name!r} requires an integer.") from exc

    if ftype == "float":
        try:
            result = float(value)
        except (TypeError, ValueError) as exc:
            raise ValueError(f"Field {name!r} requires a number.") from exc
        if math.isnan(result) or math.isinf(result):
            raise ValueError(f"Field {name!r} has an invalid value.")
        return result

    if ftype == "enum":
        text = str(value)
        if options is not None and text not in options:
            raise ValueError(f"Field {name!r} only accepts: {options}.")
        return text

    return str(value)


# ---------------------------------------------------------------------------
# Element creation
# ---------------------------------------------------------------------------

def validate_creation_fields(kind: str, fields: dict[str, Any]) -> None:
    """Raise ValueError if required fields for the given element kind are missing."""
    if kind not in _CREATION_SCHEMA:
        raise ValueError(f"Creating element {kind!r} is not supported.")
    schema = _CREATION_SCHEMA[kind]
    missing = [name for name, _ in schema["required"] if name not in fields or fields[name] is None]
    if missing:
        raise ValueError(f"Missing required fields: {', '.join(missing)}.")


def create_element_in_net(net: pp.pandapowerNet, kind: str, fields: dict[str, Any]) -> int:
    """Create an element in the network and return its index.

    Raises ValueError for missing fields, invalid values, or bad bus references.
    """
    validate_creation_fields(kind, fields)
    schema = _CREATION_SCHEMA[kind]

    req_names = {name for name, _ in schema["required"]}
    kwargs: dict[str, Any] = dict(schema["defaults"])

    for name, ftype in schema["required"]:
        kwargs[name] = _coerce(name, fields[name], ftype, None)

    opt_index = {name: (ftype, options) for name, ftype, options in schema["optional"]}
    for name, value in fields.items():
        if name in opt_index and name not in req_names:
            ftype, options = opt_index[name]
            kwargs[name] = _coerce(name, value, ftype, options)

    if "bus" in kwargs and not net.bus.empty and int(kwargs["bus"]) not in net.bus.index:
        raise ValueError(f"Bus with id={kwargs['bus']} does not exist.")

    for bus_field in ("from_bus", "to_bus", "hv_bus", "lv_bus"):
        if bus_field in kwargs and not net.bus.empty and int(kwargs[bus_field]) not in net.bus.index:
            raise ValueError(f"Bus with id={kwargs[bus_field]} ({bus_field}) does not exist.")

    if kind == "line" and "from_bus" in kwargs and "to_bus" in kwargs:
        if int(kwargs["from_bus"]) == int(kwargs["to_bus"]):
            raise ValueError("A line cannot connect a bus to itself (from_bus == to_bus).")

    if kind == "trafo" and "hv_bus" in kwargs and "lv_bus" in kwargs:
        if int(kwargs["hv_bus"]) == int(kwargs["lv_bus"]):
            raise ValueError("A transformer cannot connect a bus to itself (hv_bus == lv_bus).")

    if kind == "gen" and "bus" in kwargs:
        bus_id = int(kwargs["bus"])
        if not net.ext_grid.empty and bus_id in net.ext_grid["bus"].values:
            raise ValueError(
                f"Bus #{bus_id} is already a slack node (ext_grid) — "
                "adding a PV generator would cause a reference node conflict."
            )

    try:
        idx = int(_CREATORS[kind](net, **kwargs))
    except (ValueError, KeyError) as exc:
        raise ValueError(f"pandapower error when creating {kind}: {exc}") from exc
    except Exception as exc:
        raise ValueError(f"Unexpected error when creating {kind}: {exc}") from exc

    table = getattr(net, kind)
    if "name" in table.columns and not str(table.at[idx, "name"]).strip():
        prefix = _AUTO_NAME_PREFIX.get(kind, kind.capitalize())
        table.at[idx, "name"] = f"{prefix} {idx + 1}"

    return idx
