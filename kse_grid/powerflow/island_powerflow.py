"""Island-aware powerflow — runs PF independently per electrical island."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import networkx as nx
import pandapower as pp
import pandapower.auxiliary as pp_aux
import pandas as pd
from pandapower.topology import create_nxgraph

from kse_grid.type_coercion import to_int as _to_int

_PF_EXCEPTIONS: tuple[type[Exception], ...] = (pp_aux.LoadflowNotConverged,)
try:
    from pandapower.auxiliary import OPFNotConverged as _OPFNotConverged  # type: ignore[attr-defined]
    _PF_EXCEPTIONS = (*_PF_EXCEPTIONS, _OPFNotConverged)
except ImportError:
    pass


@dataclass
class IslandPFResult:
    id: int
    bus_ids: list[int]
    slack_bus_ids: list[int]
    status: str  # "converged" | "unsupplied" | "not_converged"
    converged: bool
    message: str | None = None

    @property
    def bus_count(self) -> int:
        return len(self.bus_ids)

    @property
    def has_slack(self) -> bool:
        return bool(self.slack_bus_ids)


def run_island_powerflow(
    net: pp.pandapowerNet,
    algorithm: str = "nr",
    max_iteration: int = 100,
    tolerance_mva: float = 1e-3,
) -> list[IslandPFResult]:
    """Run PF per island. Mutates net.res_* tables. Returns per-island results.

    Islands without a slack source are classified as 'unsupplied' and skipped.
    Results from converged islands are merged back into net.res_*.
    """
    graph = _build_topology_graph(net)
    slack_bus_ids = _active_slack_bus_ids(net)

    components = sorted(
        [sorted(_to_int(b) for b in comp) for comp in nx.connected_components(graph)],
        key=lambda c: (-len(c), c[0] if c else -1),
    )

    pf_opts: dict[str, Any] = dict(
        algorithm=algorithm,
        calculate_voltage_angles=True,
        max_iteration=max_iteration,
        init="flat",
        tolerance_mva=tolerance_mva,
    )

    results: list[IslandPFResult] = []

    for island_idx, bus_ids in enumerate(components, start=1):
        island_slacks = [b for b in bus_ids if b in slack_bus_ids]

        if not island_slacks:
            results.append(IslandPFResult(
                id=island_idx,
                bus_ids=bus_ids,
                slack_bus_ids=[],
                status="unsupplied",
                converged=False,
                message="No reference source in the island.",
            ))
            continue

        try:
            sub = pp.select_subnet(net, buses=set(bus_ids), include_switch_buses=True)
            pp.runpp(sub, **pf_opts)
            _merge_results(net, sub)
            results.append(IslandPFResult(
                id=island_idx,
                bus_ids=bus_ids,
                slack_bus_ids=island_slacks,
                status="converged",
                converged=True,
            ))
        except _PF_EXCEPTIONS as exc:
            results.append(IslandPFResult(
                id=island_idx,
                bus_ids=bus_ids,
                slack_bus_ids=island_slacks,
                status="not_converged",
                converged=False,
                message=str(exc),
            ))
        except Exception as exc:  # noqa: BLE001 — degenerate network (singular matrix etc.)
            results.append(IslandPFResult(
                id=island_idx,
                bus_ids=bus_ids,
                slack_bus_ids=island_slacks,
                status="not_converged",
                converged=False,
                message=f"Computation error: {exc}",
            ))

    return results


def _merge_results(net: pp.pandapowerNet, sub: pp.pandapowerNet) -> None:
    """Append res_* rows from subnet back into the main network."""
    for key in (
        "res_bus", "res_line", "res_trafo",
        "res_gen", "res_load", "res_sgen", "res_ext_grid", "res_shunt",
    ):
        sub_table = getattr(sub, key, None)
        if sub_table is None or sub_table.empty:
            continue
        net_table = getattr(net, key, None)
        if net_table is None:
            setattr(net, key, sub_table.copy())
        else:
            setattr(net, key, pd.concat([net_table, sub_table]))


def _build_topology_graph(net: pp.pandapowerNet) -> nx.Graph:
    graph = create_nxgraph(
        net,
        respect_switches=True,
        include_out_of_service=False,
        multi=False,
    )
    for bus_id in _active_bus_ids(net):
        if bus_id not in graph:
            graph.add_node(bus_id)
    return graph


def _active_bus_ids(net: pp.pandapowerNet) -> list[int]:
    if "in_service" not in net.bus.columns:
        return [_to_int(b) for b in net.bus.index]
    mask = net.bus["in_service"].fillna(False).astype(bool)
    return [_to_int(b) for b in net.bus.index[mask]]


def _active_slack_bus_ids(net: pp.pandapowerNet) -> set[int]:
    slack_buses: set[int] = set()
    if not net.ext_grid.empty:
        rows = (
            net.ext_grid.loc[net.ext_grid["in_service"].fillna(False).astype(bool)]
            if "in_service" in net.ext_grid.columns
            else net.ext_grid
        )
        slack_buses.update(_to_int(row.bus) for _, row in rows.iterrows())
    if not net.gen.empty and "slack" in net.gen.columns:
        slack_mask = net.gen["slack"].fillna(False).astype(bool)
        if "in_service" in net.gen.columns:
            slack_mask &= net.gen["in_service"].fillna(False).astype(bool)
        slack_buses.update(_to_int(row.bus) for _, row in net.gen.loc[slack_mask].iterrows())
    return slack_buses
