"""Import pliku MATPOWER do pandapower z obsługą błędów gencost."""

from __future__ import annotations

import re
import tempfile
from pathlib import Path

import pandapower as pp
from pandapower.converter.matpower import from_mpc

from kse_grid.type_coercion import to_int as _to_int


def import_matpower_case(case_path: Path, f_hz: int = 50) -> pp.pandapowerNet:
    try:
        return from_mpc(str(case_path), f_hz=f_hz)
    except IndexError as exc:
        if "too many indices for array" not in str(exc):
            raise
        return _import_without_gencost(case_path, f_hz=f_hz)


def seed_operational_switches(net: pp.pandapowerNet) -> None:
    """Dodaje operacyjne switche pandapower na końcach linii i transformatorów.

    Matpower opisuje gałęzie przez flagę `branch status`; po imporcie tabela
    `net.switch` zostaje pusta. Ten helper uzupełnia brakujący poziom topologiczny,
    tworząc po dwa switche (obu końcach) dla każdej linii i transformatora.
    Funkcja jest idempotentna.
    """
    existing_switches = {
        (_to_int(row.bus), _to_int(row.element), str(row.et))
        for _, row in net.switch.iterrows()
    }

    for line_idx, row in net.line.iterrows():
        line_id = _to_int(line_idx)
        closed = _initial_switch_state(row)
        line_name = str(row.get("name") or f"Line {line_id + 1}")
        _create_switch(net, _to_int(row.from_bus), line_id, "l", closed, f"{line_name} [from]", existing_switches)
        _create_switch(net, _to_int(row.to_bus), line_id, "l", closed, f"{line_name} [to]", existing_switches)

    for trafo_idx, row in net.trafo.iterrows():
        trafo_id = _to_int(trafo_idx)
        closed = _initial_switch_state(row)
        trafo_name = str(row.get("name") or f"Trafo {trafo_id + 1}")
        _create_switch(net, _to_int(row.hv_bus), trafo_id, "t", closed, f"{trafo_name} [hv]", existing_switches)
        _create_switch(net, _to_int(row.lv_bus), trafo_id, "t", closed, f"{trafo_name} [lv]", existing_switches)


def _import_without_gencost(case_path: Path, f_hz: int) -> pp.pandapowerNet:
    text = case_path.read_text(encoding="utf-8", errors="ignore")
    stripped, replacements = re.subn(
        r"(?ms)^mpc\.gencost\s*=\s*\[.*?^];\s*",
        "",
        text,
    )
    if replacements == 0:
        raise RuntimeError(f"Nie udało się usunąć bloku gencost z {case_path.name}")

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
