"""Analiza topologiczna sieci — wyspy, szyny bez zasilania, stany odłączników."""

from __future__ import annotations

from typing import Any

import networkx as nx
import pandapower as pp
from pandapower.topology import create_nxgraph, unsupplied_buses

from kse_grid.type_coercion import to_int as _to_int


def compute_topology(net: pp.pandapowerNet) -> dict[str, Any]:
    graph = _build_topology_graph(net)
    slack_bus_ids = _active_slack_bus_ids(net)
    unsupplied = _find_unsupplied_buses(net, graph, slack_bus_ids)
    islands = _build_islands(graph, slack_bus_ids, unsupplied)

    closed_switches = int(net.switch["closed"].fillna(False).astype(bool).sum()) if not net.switch.empty else 0
    return {
        "islandCount": len(islands),
        "energizedIslandCount": int(sum(island["unsuppliedBusCount"] == 0 for island in islands)),
        "unsuppliedIslandCount": int(sum(island["unsuppliedBusCount"] > 0 for island in islands)),
        "unsuppliedBusCount": len(unsupplied),
        "switchCount": int(len(net.switch)),
        "closedSwitchCount": closed_switches,
        "openSwitchCount": int(len(net.switch) - closed_switches),
        "islands": islands,
    }


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


def _find_unsupplied_buses(
    net: pp.pandapowerNet,
    graph: nx.Graph,
    slack_bus_ids: set[int],
) -> set[int]:
    return {
        _to_int(bus_id)
        for bus_id in unsupplied_buses(
            net,
            mg=graph,
            respect_switches=True,
            slacks=slack_bus_ids or None,
        )
    }


def _build_islands(
    graph: nx.Graph,
    slack_bus_ids: set[int],
    unsupplied: set[int],
) -> list[dict[str, Any]]:
    components = [
        sorted(_to_int(bus_id) for bus_id in component)
        for component in nx.connected_components(graph)
    ]
    components.sort(key=lambda component: (-len(component), component[0] if component else -1))

    islands = []
    for island_idx, bus_ids in enumerate(components, start=1):
        island_slacks = [bus_id for bus_id in bus_ids if bus_id in slack_bus_ids]
        island_unsupplied = [bus_id for bus_id in bus_ids if bus_id in unsupplied]
        islands.append({
            "id": island_idx,
            "busCount": len(bus_ids),
            "hasSlack": bool(island_slacks),
            "slackBusIds": island_slacks,
            "unsuppliedBusCount": len(island_unsupplied),
            "sampleBusIds": bus_ids[:5],
        })
    return islands


def _active_bus_ids(net: pp.pandapowerNet) -> list[int]:
    if "in_service" not in net.bus.columns:
        return [_to_int(bus_id) for bus_id in net.bus.index]
    mask = net.bus["in_service"].fillna(False).astype(bool)
    return [_to_int(bus_id) for bus_id in net.bus.index[mask]]


def _active_slack_bus_ids(net: pp.pandapowerNet) -> set[int]:
    slack_buses: set[int] = set()
    if not net.ext_grid.empty:
        rows = net.ext_grid.loc[net.ext_grid["in_service"].fillna(False).astype(bool)] if "in_service" in net.ext_grid.columns else net.ext_grid
        slack_buses.update(_to_int(row.bus) for _, row in rows.iterrows())
    if not net.gen.empty and "slack" in net.gen.columns:
        slack_mask = net.gen["slack"].fillna(False).astype(bool)
        if "in_service" in net.gen.columns:
            slack_mask &= net.gen["in_service"].fillna(False).astype(bool)
        slack_buses.update(_to_int(row.bus) for _, row in net.gen.loc[slack_mask].iterrows())
    return slack_buses
