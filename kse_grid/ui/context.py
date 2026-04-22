"""Wspólny kontekst aplikacji Dash — figura, indeksy, wartości domyślne."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

import pandapower as pp
import plotly.graph_objects as go

from kse_grid.plotting import build_figure_for_dash
from kse_grid.ui.theme import CORE_VOLTAGE_KV, FOCUS_ZOOM_RATIO


@dataclass(frozen=True)
class BusReference:
    """Pozycja szyny w figurze Plotly: numer śladu i indeks punktu w nim."""
    curve: int
    point: int
    voltage_kv: float


@dataclass
class DashContext:
    """Cały stan przekazywany do builderów layoutu i rejestracji callbacków."""

    net: pp.pandapowerNet
    fig: go.Figure
    trace_meta: list[dict[str, Any]]
    voltage_levels: list[float]
    default_voltage_filter: list[float]
    bus_lookup: dict[int, BusReference]
    bus_options: list[dict[str, Any]]
    selection_trace_index: int
    default_view: dict[str, list[float]]
    focus_half_extent: dict[str, float]
    net_name: str

    has_results: bool = field(init=False)

    def __post_init__(self) -> None:
        self.has_results = not self.net.res_bus.empty


def _build_bus_lookup(
    net: pp.pandapowerNet,
    trace_meta: list[dict[str, Any]],
) -> dict[int, BusReference]:
    """Mapowanie bus_idx → (curve, point, voltage) dla śladów typu „bus"."""
    lookup: dict[int, BusReference] = {}
    for curve_num, meta in enumerate(trace_meta):
        if meta["kind"] != "bus":
            continue
        voltage = float(meta["voltage"])
        bus_indices = net.bus.index[net.bus.vn_kv == voltage].tolist()
        for point_idx, bus_idx in enumerate(bus_indices):
            lookup[int(bus_idx)] = BusReference(curve_num, point_idx, voltage)
    return lookup


def _build_bus_options(net: pp.pandapowerNet) -> list[dict[str, Any]]:
    """Opcje dla wyszukiwarki szyn — sortowane od najwyższego napięcia."""
    options: list[dict[str, Any]] = []
    sorted_buses = net.bus.sort_values(["vn_kv", "name"], ascending=[False, True])
    for bus_idx, row in sorted_buses.iterrows():
        bus_name = str(row["name"]).strip() or f"Bus {bus_idx}"
        options.append({
            "label": f"{bus_name} ({int(row['vn_kv'])} kV)",
            "value": int(bus_idx),
        })
    return options


def _add_selection_highlight_trace(fig: go.Figure, accent_color: str) -> int:
    """Dodaje pusty ślad nakładki na zaznaczony element. Zwraca jego indeks."""
    selection_trace_index = len(fig.data)
    fig.add_trace(
        go.Scatter(
            x=[], y=[],
            mode="markers",
            hoverinfo="skip",
            showlegend=False,
            visible=False,
            marker=dict(
                size=24,
                color="rgba(255,255,255,0.12)",
                line=dict(color=accent_color, width=3),
            ),
        )
    )
    return selection_trace_index


def build_dash_context(net: pp.pandapowerNet, accent_color: str) -> DashContext:
    """Buduje figurę Plotly i wszystkie pochodne struktury raz, dla całej sesji."""
    fig, trace_meta, voltage_levels = build_figure_for_dash(net)

    default_voltage_filter = [v for v in voltage_levels if v >= CORE_VOLTAGE_KV] or list(voltage_levels)

    default_view = {
        "x": list(fig.layout.xaxis.range),
        "y": list(fig.layout.yaxis.range),
    }
    view_dx = max(default_view["x"][1] - default_view["x"][0], 0.2)
    view_dy = max(default_view["y"][1] - default_view["y"][0], 0.2)
    focus_half_extent = {"x": view_dx * FOCUS_ZOOM_RATIO, "y": view_dy * FOCUS_ZOOM_RATIO}

    selection_trace_index = _add_selection_highlight_trace(fig, accent_color)

    return DashContext(
        net=net,
        fig=fig,
        trace_meta=trace_meta,
        voltage_levels=voltage_levels,
        default_voltage_filter=default_voltage_filter,
        bus_lookup=_build_bus_lookup(net, trace_meta),
        bus_options=_build_bus_options(net),
        selection_trace_index=selection_trace_index,
        default_view=default_view,
        focus_half_extent=focus_half_extent,
        net_name=getattr(net, "name", None) or "Sieć elektroenergetyczna",
    )
