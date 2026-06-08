"""Import a MATPOWER file into pandapower with gencost error handling."""

from __future__ import annotations

import math
import re
import tempfile
from pathlib import Path

import pandapower as pp
from pandapower.converter.matpower import from_mpc

from kse_grid.type_coercion import to_int as _to_int


def import_matpower_case(case_path: Path, f_hz: int = 50) -> pp.pandapowerNet:
    try:
        net = from_mpc(str(case_path), f_hz=f_hz)
    except IndexError as exc:
        if "too many indices for array" not in str(exc):
            raise
        net = _import_without_gencost(case_path, f_hz=f_hz)
    _promote_voltage_step_impedances_to_trafos(net)
    return net


def seed_operational_switches(net: pp.pandapowerNet) -> None:
    """Add operational pandapower switches for lines and transformers.

    MATPOWER describes branches via a `branch status` flag; after import the
    `net.switch` table is empty. This helper fills in the missing topological
    layer by creating one switch (at from_bus/hv_bus) per line and transformer.
    The function is idempotent.
    """
    existing_switches = {
        (_to_int(row.bus), _to_int(row.element), str(row.et))
        for _, row in net.switch.iterrows()
    }

    for line_idx, row in net.line.iterrows():
        line_id = _to_int(line_idx)
        closed = _initial_switch_state(row)
        line_name = str(row.get("name") or f"Line {line_id + 1}")
        _create_switch(net, _to_int(row.from_bus), line_id, "l", closed, line_name, existing_switches)

    for trafo_idx, row in net.trafo.iterrows():
        trafo_id = _to_int(trafo_idx)
        closed = _initial_switch_state(row)
        trafo_name = str(row.get("name") or f"Trafo {trafo_id + 1}")
        _create_switch(net, _to_int(row.hv_bus), trafo_id, "t", closed, trafo_name, existing_switches)


def _promote_voltage_step_impedances_to_trafos(net: pp.pandapowerNet) -> None:
    """Reclassify `net.impedance` entries as transformers per the MATPOWER specification.

    pandapower `from_ppc` treats a branch as a transformer only when `tap ∉ {0, 1}`,
    so branches with `tap = 1` connecting buses with different `vn_kv` (valid trafos
    per MATPOWER) end up in the impedance table. This function detects them and moves
    them to `net.trafo`, reversing the maths from `_from_ppc_branch`.
    """
    if net.impedance.empty:
        return

    to_drop: list[int] = []
    for imp_idx, row in net.impedance.iterrows():
        from_bus = _to_int(row.from_bus)
        to_bus = _to_int(row.to_bus)
        vn_from = float(net.bus.at[from_bus, "vn_kv"])
        vn_to = float(net.bus.at[to_bus, "vn_kv"])
        if math.isclose(vn_from, vn_to, rel_tol=1e-9):
            continue

        sn_mva = float(row.sn_mva)
        rft_pu = float(row.rft_pu)
        xft_pu = float(row.xft_pu)
        bf_pu = float(row.get("bf_pu", 0.0) or 0.0)
        gf_pu = float(row.get("gf_pu", 0.0) or 0.0)

        # Invert formulas from _from_ppc_branch: per-unit on sn_mva -> trafo %
        vkr_percent = rft_pu * 100.0
        vk_percent = math.hypot(rft_pu, xft_pu) * 100.0
        # bf_pu/gf_pu are half of the total branch Y (on sn_mva base)
        i0_percent = 2.0 * math.hypot(bf_pu, gf_pu) * 100.0
        pfe_kw = 2.0 * gf_pu * sn_mva * 1e3

        if vn_from >= vn_to:
            hv_bus, lv_bus = from_bus, to_bus
            vn_hv_kv, vn_lv_kv = vn_from, vn_to
        else:
            hv_bus, lv_bus = to_bus, from_bus
            vn_hv_kv, vn_lv_kv = vn_to, vn_from

        name = str(row.get("name") or f"Trafo {hv_bus}-{lv_bus}")
        in_service = bool(row.get("in_service", True))

        pp.create_transformer_from_parameters(
            net,
            hv_bus=hv_bus,
            lv_bus=lv_bus,
            sn_mva=sn_mva,
            vn_hv_kv=vn_hv_kv,
            vn_lv_kv=vn_lv_kv,
            vk_percent=vk_percent,
            vkr_percent=vkr_percent,
            pfe_kw=pfe_kw,
            i0_percent=i0_percent,
            shift_degree=0.0,
            name=name,
            in_service=in_service,
            max_loading_percent=100,
        )
        to_drop.append(_to_int(imp_idx))

    if to_drop:
        net.impedance.drop(index=to_drop, inplace=True)


def _import_without_gencost(case_path: Path, f_hz: int) -> pp.pandapowerNet:
    text = case_path.read_text(encoding="utf-8", errors="ignore")
    stripped, replacements = re.subn(
        r"(?ms)^mpc\.gencost\s*=\s*\[.*?^];\s*",
        "",
        text,
    )
    if replacements == 0:
        raise RuntimeError(f"Failed to remove the gencost block from {case_path.name}")

    with tempfile.NamedTemporaryFile("w", suffix=".m", delete=False, encoding="utf-8") as handle:
        handle.write(stripped)
        temp_path = Path(handle.name)

    try:
        return from_mpc(str(temp_path), f_hz=f_hz)
    finally:
        temp_path.unlink(missing_ok=True)


def _initial_switch_state(row: object) -> bool:
    if not hasattr(row, "get"):
        return True
    raw = row.get("in_service", True)
    if isinstance(raw, str):
        return raw.strip().lower() not in {"false", "0", "no"}
    return bool(raw)


def _create_switch(
    net: pp.pandapowerNet,
    bus_id: int,
    element_id: int,
    et: str,
    closed: bool,
    name: str,
    existing_switches: set[tuple[int, int, str]],
) -> None:
    key = (bus_id, element_id, et)
    if key in existing_switches:
        return
    pp.create_switch(net, bus=bus_id, element=element_id, et=et, closed=closed, type="CB", name=name)
    existing_switches.add(key)
