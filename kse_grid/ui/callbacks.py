"""Rejestracja callbacków Dash. Każdy callback ma jedną odpowiedzialność."""

from __future__ import annotations

from typing import Any

import dash
from dash import Input, Output, Patch, State, ctx as dash_ctx

from kse_grid.ui.components import (
    EMPTY_INFO,
    SELECTION_CARD_STYLE,
    filter_button_style,
)
from kse_grid.ui.context import DashContext
from kse_grid.ui.info_card import build_bus_card, build_hovertext_card
from kse_grid.ui.theme import SELECTION_HIGHLIGHT_SCALE


_HIDDEN_CARD_STYLE = {"display": "none"}


def register_callbacks(app: dash.Dash, ctx: DashContext) -> None:
    """Rejestruje wszystkie 4 callbacki dashboardu."""
    _register_graph_update(app, ctx)
    _register_voltage_presets(app, ctx)
    _register_filter_button_styles(app, ctx)
    _register_selection(app, ctx)


# ---------------------------------------------------------------------------
# Aktualizacja figury: widoczność śladów + podświetlenie + zakres osi
# ---------------------------------------------------------------------------

def _register_graph_update(app: dash.Dash, ctx: DashContext) -> None:
    @app.callback(
        Output("graph", "figure"),
        Input("voltage-filter", "value"),
        Input("type-filter",    "value"),
        Input("sel-store",      "data"),
        Input("view-store",     "data"),
    )
    def update_graph(
        sel_voltages: list[float] | None,
        sel_types: list[str] | None,
        selection: dict | None,
        view_state: dict | None,
    ):
        patch = Patch()
        visible_bus_traces = _apply_visibility(patch, ctx, sel_voltages, sel_types)
        _apply_selection_highlight(patch, ctx, selection, visible_bus_traces)
        _apply_axis_ranges(patch, view_state)
        return patch


def _apply_visibility(
    patch: Patch,
    ctx: DashContext,
    sel_voltages: list[float] | None,
    sel_types: list[str] | None,
) -> set[int]:
    visible_voltages = set(sel_voltages or [])
    visible_types = set(sel_types or [])
    visible_bus_traces: set[int] = set()

    for trace_index, meta in enumerate(ctx.trace_meta):
        kind = meta["kind"]
        voltage = meta["voltage"]
        is_visible = kind in visible_types and voltage in visible_voltages
        patch["data"][trace_index]["visible"] = is_visible
        if is_visible and kind == "bus":
            visible_bus_traces.add(trace_index)

    return visible_bus_traces


def _apply_selection_highlight(
    patch: Patch,
    ctx: DashContext,
    selection: dict | None,
    visible_bus_traces: set[int],
) -> None:
    sel_index = ctx.selection_trace_index

    if not selection:
        patch["data"][sel_index]["x"] = []
        patch["data"][sel_index]["y"] = []
        patch["data"][sel_index]["visible"] = False
        return

    curve = selection.get("c")
    point = selection.get("p")
    if not (isinstance(curve, int) and isinstance(point, int) and curve in visible_bus_traces):
        patch["data"][sel_index]["x"] = []
        patch["data"][sel_index]["y"] = []
        patch["data"][sel_index]["visible"] = False
        return

    source_trace = ctx.fig.data[curve]
    patch["data"][sel_index]["x"] = [source_trace.x[point]]
    patch["data"][sel_index]["y"] = [source_trace.y[point]]
    patch["data"][sel_index]["marker"]["size"] = float(source_trace.marker.size) * SELECTION_HIGHLIGHT_SCALE
    patch["data"][sel_index]["visible"] = True


def _apply_axis_ranges(patch: Patch, view_state: dict | None) -> None:
    if not view_state:
        return
    if isinstance(view_state.get("x"), list) and len(view_state["x"]) == 2:
        patch["layout"]["xaxis"]["range"] = view_state["x"]
    if isinstance(view_state.get("y"), list) and len(view_state["y"]) == 2:
        patch["layout"]["yaxis"]["range"] = view_state["y"]


# ---------------------------------------------------------------------------
# Presety filtra napięć
# ---------------------------------------------------------------------------

def _register_voltage_presets(app: dash.Dash, ctx: DashContext) -> None:
    @app.callback(
        Output("voltage-filter", "value"),
        Input("btn-core", "n_clicks"),
        Input("btn-all",  "n_clicks"),
        Input("btn-none", "n_clicks"),
        prevent_initial_call=True,
    )
    def toggle_voltages(_core: int, _all: int, _none: int):
        if dash_ctx.triggered_id == "btn-core":
            return ctx.default_voltage_filter
        if dash_ctx.triggered_id == "btn-all":
            return ctx.voltage_levels
        return []


def _register_filter_button_styles(app: dash.Dash, ctx: DashContext) -> None:
    @app.callback(
        Output("btn-core", "style"),
        Output("btn-all",  "style"),
        Output("btn-none", "style"),
        Input("voltage-filter", "value"),
    )
    def update_filter_button_styles(sel_voltages: list[float] | None):
        selected = set(sel_voltages or [])
        return (
            filter_button_style(selected == set(ctx.default_voltage_filter)),
            filter_button_style(selected == set(ctx.voltage_levels)),
            filter_button_style(not selected),
        )


# ---------------------------------------------------------------------------
# Selekcja: klik w grafie / wybór z dropdownu / reset
# ---------------------------------------------------------------------------

_HIDDEN = (EMPTY_INFO, _HIDDEN_CARD_STYLE)


def _hidden(view: dict | None, default_view: dict, bus_value: int | None = None):
    """Pomocnik: zwraca pustą kartę, brak selekcji, zachowany widok."""
    return EMPTY_INFO, _HIDDEN_CARD_STYLE, None, view or default_view, bus_value


def _register_selection(app: dash.Dash, ctx: DashContext) -> None:
    @app.callback(
        Output("selection-card", "children"),
        Output("selection-card", "style"),
        Output("sel-store",      "data"),
        Output("view-store",     "data"),
        Output("bus-search",     "value"),
        Input("graph",           "clickData"),
        Input("bus-search",      "value"),
        Input("btn-reset-view",  "n_clicks"),
        Input("clear-selection", "n_clicks"),
        State("view-store",      "data"),
    )
    def on_select(
        click_data: dict | None,
        bus_value: int | None,
        _reset_clicks: int,
        _clear_clicks: int,
        current_view: dict | None,
    ):
        trigger = dash_ctx.triggered_id

        if trigger in {"btn-reset-view", "clear-selection"}:
            return _hidden(current_view, ctx.default_view, None)

        if trigger == "bus-search":
            return _handle_bus_search(ctx, bus_value, current_view)

        return _handle_graph_click(ctx, click_data, current_view, bus_value)


def _handle_bus_search(ctx: DashContext, bus_value: int | None, current_view: dict | None):
    if bus_value is None:
        return _hidden(current_view, ctx.default_view, None)

    lookup = ctx.bus_lookup.get(int(bus_value))
    if lookup is None:
        return _hidden(current_view, ctx.default_view, bus_value)

    bus_x = float(ctx.fig.data[lookup.curve].x[lookup.point])
    bus_y = float(ctx.fig.data[lookup.curve].y[lookup.point])
    half_x = ctx.focus_half_extent["x"]
    half_y = ctx.focus_half_extent["y"]
    focused_view = {
        "x": [bus_x - half_x, bus_x + half_x],
        "y": [bus_y - half_y, bus_y + half_y],
    }
    card = build_bus_card(ctx.net, int(bus_value), lookup.voltage)
    return card, SELECTION_CARD_STYLE, {"c": lookup.curve, "p": lookup.point}, focused_view, bus_value


def _handle_graph_click(
    ctx: DashContext,
    click_data: dict | None,
    current_view: dict | None,
    bus_value: int | None,
):
    point = _first_clicked_point(click_data)
    if point is None:
        return _hidden(current_view, ctx.default_view, bus_value)

    curve_num = point["curveNumber"]
    point_idx = point["pointIndex"]
    meta = ctx.trace_meta[curve_num] if 0 <= curve_num < len(ctx.trace_meta) else {}
    kind = str(meta.get("kind", ""))
    voltage = float(meta.get("voltage", 0.0))

    if kind == "bus":
        bus_indices = ctx.net.bus.index[ctx.net.bus.vn_kv == voltage].tolist()
        if point_idx >= len(bus_indices):
            return _hidden(current_view, ctx.default_view, bus_value)
        bus_idx = int(bus_indices[point_idx])
        card = build_bus_card(ctx.net, bus_idx, voltage)
        return card, SELECTION_CARD_STYLE, {"c": curve_num, "p": point_idx}, current_view or ctx.default_view, bus_idx

    raw_text = point.get("text", "")
    if raw_text:
        card = build_hovertext_card(raw_text)
        if card is not None:
            return card, SELECTION_CARD_STYLE, None, current_view or ctx.default_view, bus_value

    return _hidden(current_view, ctx.default_view, bus_value)


def _first_clicked_point(click_data: dict | None) -> dict[str, Any] | None:
    if not click_data:
        return None
    points = click_data.get("points") or []
    if not points:
        return None
    point = points[0]
    if not (isinstance(point.get("curveNumber"), int) and isinstance(point.get("pointIndex"), int)):
        return None
    return point
