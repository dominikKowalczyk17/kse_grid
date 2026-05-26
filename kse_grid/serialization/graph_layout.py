"""Obliczanie pozycji szyn do renderowania grafu topologii sieci."""

from __future__ import annotations

import networkx as nx
import pandapower as pp
from pandapower.topology import create_nxgraph

from kse_grid.type_coercion import to_int as _to_int

_LINE_WEIGHT = 1.0
_TRAFO_WEIGHT = 50.0


def compute_graph_positions(net: pp.pandapowerNet) -> dict[int, tuple[float, float]]:
    """
    Liczy pozycje szyn algorytmem spring layout (Fruchterman-Reingold) na grafie
    topologii sieci. Geodane (`net.bus.geo`) są celowo ignorowane — siatka jest
    renderowana jako abstrakcyjny graf, nie jako mapa.

    Krawędzie transformatorów dostają znacznie większą wagę niż linie — fizycznie
    łączą szyny tej samej stacji (różne poziomy napięć), więc na grafie powinny być
    rysowane bardzo blisko, a nie rozciągnięte przez połowę sieci.
    """
    graph = _build_weighted_graph(net)
    return _spring_layout_with_offsets(graph)


recompute_graph_positions = compute_graph_positions


def compute_bounds(positions: dict[int, tuple[float, float]]) -> dict[str, list[float]]:
    if not positions:
        return {"x": [-1.0, 1.0], "y": [-1.0, 1.0]}
    xs = [x for x, _ in positions.values()]
    ys = [y for _, y in positions.values()]
    x_min, x_max = min(xs), max(xs)
    y_min, y_max = min(ys), max(ys)
    pad_x = max((x_max - x_min) * 0.08, 0.2)
    pad_y = max((y_max - y_min) * 0.08, 0.2)
    return {"x": [x_min - pad_x, x_max + pad_x], "y": [y_min - pad_y, y_max + pad_y]}


def _build_weighted_graph(net: pp.pandapowerNet) -> nx.Graph:
    graph = create_nxgraph(
        net,
        respect_switches=True,
        include_out_of_service=False,
        multi=False,
    )
    for bus_idx in net.bus.index:
        if bus_idx not in graph:
            graph.add_node(bus_idx)

    for _, _, data in graph.edges(data=True):
        data["weight"] = _LINE_WEIGHT

    for _, trow in net.trafo.iterrows():
        hv = _to_int(trow.hv_bus)
        lv = _to_int(trow.lv_bus)
        if graph.has_edge(hv, lv):
            graph[hv][lv]["weight"] = _TRAFO_WEIGHT

    if hasattr(net, "trafo3w") and not net.trafo3w.empty:
        for _, trow in net.trafo3w.iterrows():
            for a, b in (
                (_to_int(trow.hv_bus), _to_int(trow.mv_bus)),
                (_to_int(trow.hv_bus), _to_int(trow.lv_bus)),
                (_to_int(trow.mv_bus), _to_int(trow.lv_bus)),
            ):
                if graph.has_edge(a, b):
                    graph[a][b]["weight"] = _TRAFO_WEIGHT

    return graph


def _spring_layout_with_offsets(graph: nx.Graph) -> dict[int, tuple[float, float]]:
    components = list(nx.connected_components(graph))
    positions: dict[int, tuple[float, float]] = {}

    for i, comp in enumerate(components):
        subgraph = graph.subgraph(comp)
        if len(comp) == 1:
            sub_layout = {next(iter(comp)): (0.0, 0.0)}
        else:
            sub_layout = nx.spring_layout(subgraph, seed=42, iterations=80, weight="weight")

        offset_x = (i % 4) * 2.5
        offset_y = (i // 4) * 2.5
        for bus_idx, (x, y) in sub_layout.items():
            positions[bus_idx] = (float(x) + offset_x, float(y) + offset_y)

    return positions
