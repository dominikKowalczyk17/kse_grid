"""Interaktywny dashboard Dash z grafem sieci (Plotly)."""

from __future__ import annotations

import re
import webbrowser
from pathlib import Path
from threading import Timer

import dash
import pandapower as pp
from dash import Input, Output, Patch, State, dcc, html

from kse_grid.plotting import _compute_stats, build_figure_for_dash

# ---------------------------------------------------------------------------
# Motyw kolorystyczny
# ---------------------------------------------------------------------------
_C = {
    "bg":      "#0a0d12",
    "panel":   "#11161d",
    "panel2":  "#161b22",
    "border":  "#2a313c",
    "text":    "#e6edf3",
    "dim":     "#8b95a4",
    "accent":  "#4ea1ff",
    "good":    "#3fb950",
    "warn":    "#d29922",
    "bad":     "#f85149",
}


# ---------------------------------------------------------------------------
# UI helpers
# ---------------------------------------------------------------------------

def _h2(text: str) -> html.Div:
    return html.Div(text, style={
        "fontSize": 11, "textTransform": "uppercase", "letterSpacing": "1.2px",
        "color": _C["dim"], "margin": "0 0 8px 0", "fontWeight": 600,
    })


def _stat_card(label: str, value: object, cls: str = "", full: bool = False) -> html.Div:
    color = {"good": _C["good"], "warn": _C["warn"], "bad": _C["bad"]}.get(cls, _C["text"])
    return html.Div(style={
        "background": _C["panel2"], "border": f"1px solid {_C['border']}",
        "borderRadius": 8, "padding": "8px 12px",
        **( {"gridColumn": "1 / -1"} if full else {} ),
    }, children=[
        html.Div(label, style={
            "fontSize": 10, "textTransform": "uppercase",
            "color": _C["dim"], "letterSpacing": "0.8px", "marginBottom": 4,
        }),
        html.Div(str(value), style={
            "fontSize": 18, "fontWeight": 600,
            "fontFamily": "JetBrains Mono, monospace", "color": color,
        }),
    ])


def _info_row(label: str, value: str, color: str = "#e6edf3") -> html.Div:
    return html.Div(style={
        "display": "flex", "justifyContent": "space-between",
        "padding": "4px 0", "borderBottom": f"1px solid {_C['border']}", "fontSize": 12,
    }, children=[
        html.Span(label, style={"color": _C["dim"]}),
        html.Span(value, style={
            "fontFamily": "JetBrains Mono, monospace",
            "fontWeight": 500,
            "color": color,
        }),
    ])


def _parse_html_text(html_text: str) -> list[str]:
    """Rozkłada tekst HTML tooltipa na listę czystych linii."""
    lines = re.split(r"<br\s*/?>", html_text, flags=re.IGNORECASE)
    return [re.sub(r"<[^>]+>", "", line).strip() for line in lines if line.strip()]


_EMPTY_INFO = html.Div(
    "Kliknij węzeł lub linię, aby zobaczyć szczegóły.",
    style={"color": _C["dim"], "fontSize": 12, "fontStyle": "italic"},
)

_EMPTY_HOVER = html.Div(
    "Najedź kursorem na element, aby zobaczyć podgląd.",
    style={"color": _C["dim"], "fontSize": 12, "fontStyle": "italic"},
)


# ---------------------------------------------------------------------------
# Tworzenie aplikacji Dash
# ---------------------------------------------------------------------------

def create_dash_app(net: pp.pandapowerNet) -> dash.Dash:
    fig, trace_meta, voltage_levels = build_figure_for_dash(net)
    stats       = _compute_stats(net)
    has_results = not net.res_bus.empty
    net_name    = getattr(net, "name", None) or "Sieć elektroenergetyczna"
    default_voltage_filter = [v for v in voltage_levels if v >= 220] or voltage_levels
    default_view = {
        "x": list(fig.layout.xaxis.range),
        "y": list(fig.layout.yaxis.range),
    }
    view_dx = max(default_view["x"][1] - default_view["x"][0], 0.2)
    view_dy = max(default_view["y"][1] - default_view["y"][0], 0.2)
    focus_view = {"x": view_dx * 0.12, "y": view_dy * 0.12}
    bus_lookup: dict[int, dict[str, float | int]] = {}
    bus_options: list[dict[str, str | int]] = []

    for curve_num, meta in enumerate(trace_meta):
        if meta["kind"] != "bus":
            continue
        voltage = float(meta["voltage"])
        bus_indices = net.bus.index[net.bus.vn_kv == voltage].tolist()
        for point_idx, bus_idx in enumerate(bus_indices):
            bus_lookup[int(bus_idx)] = {
                "curve": curve_num,
                "point": point_idx,
                "voltage": voltage,
            }

    for bus_idx, row in net.bus.sort_values(["vn_kv", "name"], ascending=[False, True]).iterrows():
        bus_name = str(row["name"]).strip() or f"Bus {bus_idx}"
        bus_options.append({
            "label": f"{bus_name} ({int(row['vn_kv'])} kV)",
            "value": int(bus_idx),
        })

    def _bus_info(bus_idx: int, voltage: float) -> html.Div:
        row = net.bus.loc[bus_idx]
        items: list = [html.Div(row["name"], style={
            "fontWeight": 600, "marginBottom": 8, "fontSize": 13,
            "color": _C["accent"], "wordBreak": "break-word",
        }), _info_row("Napięcie znam.", f"{int(voltage)} kV")]
        if has_results:
            vm = float(net.res_bus.at[bus_idx, "vm_pu"])
            va = float(net.res_bus.at[bus_idx, "va_degree"])
            vm_color = (_C["good"] if 0.95 <= vm <= 1.05
                        else (_C["warn"] if 0.9 <= vm <= 1.1 else _C["bad"]))
            items.append(_info_row("Um",  f"{vm:.4f} p.u.", vm_color))
            items.append(_info_row("Kąt", f"{va:.2f}°"))
        lmw = net.load.loc[net.load.bus == bus_idx, "p_mw"].sum() if not net.load.empty else 0.0
        gmw = net.gen.loc[net.gen.bus == bus_idx, "p_mw"].sum() if not net.gen.empty else 0.0
        if gmw > 0:
            items.append(_info_row("Generacja",  f"{gmw:.1f} MW", _C["good"]))
        if lmw > 0:
            items.append(_info_row("Obciążenie", f"{lmw:.1f} MW"))
        return html.Div(items)

    def _tooltip_info(raw_text: str) -> html.Div | None:
        lines = _parse_html_text(raw_text)
        if not lines:
            return None
        rows: list = [html.Div(lines[0], style={
            "fontWeight": 600, "marginBottom": 8, "fontSize": 13,
            "color": _C["accent"], "wordBreak": "break-word",
        })]
        for line in lines[1:]:
            if ": " in line:
                lbl, val = line.split(": ", 1)
                rows.append(_info_row(lbl, val))
            else:
                rows.append(html.Div(line, style={"fontSize": 12, "padding": "4px 0"}))
        return html.Div(rows)

    app = dash.Dash(
        __name__,
        assets_folder=str(Path(__file__).parent / "assets"),
        title=f"{net_name} – KSE Grid",
        suppress_callback_exceptions=True,
        update_title=None,
    )

    # ------------------------------------------------------------------ layout
    _sidebar_children = [
        # Statystyki
        html.Div([
            _h2("Podsumowanie"),
            html.Div(
                style={"display": "grid", "gridTemplateColumns": "1fr 1fr", "gap": 8},
                children=[
                    _stat_card("Szyny",      stats["n_bus"]),
                    _stat_card("Linie",      stats["n_line"]),
                    _stat_card("Trafo",      stats["n_trafo"]),
                    _stat_card("Generatory", stats["n_gen"]),
                    _stat_card("Maks. obciążenie", stats["max_loading"],
                               cls=stats["load_class"], full=True),
                    _stat_card("Naruszenia U",  stats["n_viol"],    cls=stats["viol_class"]),
                    _stat_card("Przeciążenia",  stats["n_overload"], cls=stats["ovl_class"]),
                ],
            ),
        ]),

        # Nawigacja
        html.Div([
            _h2("Nawigacja"),
            dcc.Dropdown(
                id="bus-search",
                options=bus_options,
                value=None,
                placeholder="Wyszukaj szynę...",
                clearable=True,
                optionHeight=36,
                style={"marginBottom": 8, "color": "#0a0d12"},
            ),
            html.Button("Resetuj widok", id="btn-reset-view", n_clicks=0, style={
                "fontSize": 11, "padding": "6px 10px", "cursor": "pointer",
                "background": _C["panel2"], "color": _C["text"],
                "border": f"1px solid {_C['border']}", "borderRadius": 4, "width": "100%",
            }),
        ]),

        # Filtr napięć
        html.Div([
            _h2("Filtr napięć"),
            html.Div(style={"display": "flex", "gap": 6, "marginBottom": 8}, children=[
                html.Button("Rdzeń 400/220", id="btn-core", n_clicks=0, style={
                    "fontSize": 11, "padding": "3px 8px", "cursor": "pointer",
                    "background": _C["panel2"], "color": _C["text"],
                    "border": f"1px solid {_C['border']}", "borderRadius": 4,
                }),
                html.Button("Wszystkie", id="btn-all", n_clicks=0, style={
                    "fontSize": 11, "padding": "3px 8px", "cursor": "pointer",
                    "background": _C["panel2"], "color": _C["dim"],
                    "border": f"1px solid {_C['border']}", "borderRadius": 4,
                }),
                html.Button("Żadne", id="btn-none", n_clicks=0, style={
                    "fontSize": 11, "padding": "3px 8px", "cursor": "pointer",
                    "background": _C["panel2"], "color": _C["dim"],
                    "border": f"1px solid {_C['border']}", "borderRadius": 4,
                }),
            ]),
            html.Div(
                "Domyślnie pokazany jest rdzeń 400/220 kV, żeby sieć była czytelna przy dużych case'ach.",
                style={"fontSize": 11, "color": _C["dim"], "marginBottom": 8, "lineHeight": 1.4},
            ),
            dcc.Checklist(
                id="voltage-filter",
                options=[{"label": f" {int(v)} kV", "value": v} for v in voltage_levels],
                value=default_voltage_filter,
                style={"display": "flex", "flexDirection": "column", "gap": 6},
                inputStyle={"marginRight": 8, "accentColor": _C["accent"], "cursor": "pointer"},
                labelStyle={"fontSize": 13, "color": _C["text"], "cursor": "pointer"},
            ),
        ]),

        # Filtr elementów
        html.Div([
            _h2("Elementy"),
            dcc.Checklist(
                id="type-filter",
                options=[
                    {"label": " Linie",          "value": "line"},
                    {"label": " Transformatory", "value": "trafo"},
                    {"label": " Szyny",          "value": "bus"},
                ],
                value=["line", "trafo", "bus"],
                style={"display": "flex", "flexDirection": "column", "gap": 6},
                inputStyle={"marginRight": 8, "accentColor": _C["accent"], "cursor": "pointer"},
                labelStyle={"fontSize": 13, "color": _C["text"], "cursor": "pointer"},
            ),
        ]),

        # Legenda obciążenia
        html.Div([
            _h2("Legenda obciążenia"),
            html.Div(style={
                "background": _C["panel2"], "border": f"1px solid {_C['border']}",
                "borderRadius": 8, "padding": "10px 12px",
                "display": "flex", "flexDirection": "column", "gap": 6,
            }, children=[
                html.Div(style={"display": "flex", "alignItems": "center", "gap": 8}, children=[
                    html.Div(style={"width": 18, "height": 4, "borderRadius": 2, "background": c}),
                    html.Span(label, style={"fontSize": 12}),
                ])
                for c, label in [
                    ("#43A047", "0 – 40%"),
                    ("#F9A825", "40 – 70%"),
                    ("#FB8C00", "70 – 100%"),
                    ("#D32F2F", "> 100%  (przeciążenie)"),
                ]
            ]),
        ]),

        # Szczegóły elementu
        html.Div([
            _h2("Pod kursorem"),
            html.Div(
                id="hover-info",
                style={
                    "background": _C["panel2"], "border": f"1px solid {_C['border']}",
                    "borderRadius": 8, "padding": "10px 12px", "minHeight": 60,
                },
                children=_EMPTY_HOVER,
            ),
        ]),

        html.Div([
            _h2("Wybrany element"),
            html.Div(
                id="element-info",
                style={
                    "background": _C["panel2"], "border": f"1px solid {_C['border']}",
                    "borderRadius": 8, "padding": "10px 12px", "minHeight": 60,
                },
                children=_EMPTY_INFO,
            ),
        ]),
    ]

    app.layout = html.Div(
        className="app-shell",
        style={
            "background": _C["bg"], "color": _C["text"],
            "fontFamily": "'Inter', system-ui, sans-serif",
        },
        children=[
            # hidden store dla zaznaczonego punktu
            dcc.Store(id="sel-store", data=None),
            dcc.Store(id="view-store", data=default_view),

            # ── Header ────────────────────────────────────────────────
            html.Div(className="app-header", style={
                "display": "flex", "alignItems": "center",
                "justifyContent": "space-between",
                "padding": "0 24px",
                "height": "56px",
                "background": _C["panel"],
                "borderBottom": f"1px solid {_C['border']}",
            }, children=[
                html.Div(style={"display": "flex", "alignItems": "center", "gap": 12}, children=[
                    html.Div("⚡", style={
                        "width": 32, "height": 32, "borderRadius": 8, "fontSize": 16,
                        "background": "linear-gradient(135deg,#4ea1ff 0%,#a371f7 100%)",
                        "display": "flex", "alignItems": "center", "justifyContent": "center",
                        "fontWeight": 700, "color": "#0a0d12",
                    }),
                    html.Span(net_name, style={"fontWeight": 600, "fontSize": 15}),
                    html.Span(
                        f"{stats['n_bus']} szyn · {stats['n_line']} linii · {stats['n_trafo']} trafo",
                        style={"color": _C["dim"], "fontSize": 12},
                    ),
                ]),
                html.Span(
                    "✅ Zbieżny" if has_results else "⚠️ Brak wyników load flow",
                    style={
                        "fontSize": 12,
                        "color": _C["good"] if has_results else _C["warn"],
                        "fontFamily": "JetBrains Mono, monospace",
                    },
                ),
            ]),

            # ── Body (sidebar + graph) ────────────────────────────────
            html.Div(className="app-body", style={
                "display": "grid",
                "gridTemplateColumns": "300px minmax(0, 1fr)",
                "minHeight": 0,
                "overflow": "hidden",
            }, children=[

                # ── Sidebar ──────────────────────────────────────────
                html.Div(className="app-sidebar", style={
                    "background": _C["panel"],
                    "borderRight": f"1px solid {_C['border']}",
                    "overflowY": "auto",
                    "padding": "16px 14px",
                    "display": "flex", "flexDirection": "column", "gap": 20,
                }, children=_sidebar_children),

                # ── Graf (Plotly) ─────────────────────────────────────
                html.Div(
                    className="graph-panel",
                    style={"overflow": "hidden", "minWidth": 0, "minHeight": 0},
                    children=dcc.Graph(
                        id="graph",
                        className="graph-canvas",
                        figure=fig,
                        clear_on_unhover=True,
                        responsive=True,
                        config={"displayModeBar": False, "scrollZoom": True},
                        style={"width": "100%", "height": "100%"},
                    ),
                ),
            ]),
        ],
    )

    # ----------------------------------------------------------------- callbacks

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
        sv = set(sel_voltages or [])
        st = set(sel_types or [])
        pf = Patch()
        visible_bus_traces: set[int] = set()

        # widoczność śladów
        for i, meta in enumerate(trace_meta):
            kind    = meta["kind"]
            voltage = meta["voltage"]
            if kind == "bus":
                is_visible = voltage in sv and "bus" in st
                pf["data"][i]["visible"] = is_visible
                if is_visible:
                    visible_bus_traces.add(i)
            else:
                pf["data"][i]["visible"] = kind in st and voltage in sv

        # podświetlenie zaznaczonego węzła
        sel_curve = selection.get("c") if selection else None
        sel_point = selection.get("p") if selection else None
        for i, meta in enumerate(trace_meta):
            if meta["kind"] != "bus":
                continue
            if i == sel_curve and sel_point is not None and i in visible_bus_traces:
                pf["data"][i]["selectedpoints"] = [sel_point]
            else:
                pf["data"][i]["selectedpoints"] = None

        if view_state:
            if isinstance(view_state.get("x"), list) and len(view_state["x"]) == 2:
                pf["layout"]["xaxis"]["range"] = view_state["x"]
            if isinstance(view_state.get("y"), list) and len(view_state["y"]) == 2:
                pf["layout"]["yaxis"]["range"] = view_state["y"]

        return pf

    @app.callback(
        Output("voltage-filter", "value"),
        Input("btn-core", "n_clicks"),
        Input("btn-all",  "n_clicks"),
        Input("btn-none", "n_clicks"),
        prevent_initial_call=True,
    )
    def toggle_voltages(core_clicks: int, all_clicks: int, none_clicks: int):
        from dash import ctx as _ctx
        if _ctx.triggered_id == "btn-core":
            return default_voltage_filter
        if _ctx.triggered_id == "btn-all":
            return voltage_levels
        return []

    @app.callback(
        Output("hover-info", "children"),
        Input("graph", "hoverData"),
    )
    def on_hover(hover_data: dict | None):
        if not hover_data:
            return _EMPTY_HOVER

        points = hover_data.get("points") or []
        if not points:
            return _EMPTY_HOVER

        point = points[0]
        curve_num = point.get("curveNumber")
        point_idx = point.get("pointIndex")
        if not isinstance(curve_num, int) or not isinstance(point_idx, int):
            return _EMPTY_HOVER

        meta = trace_meta[curve_num] if 0 <= curve_num < len(trace_meta) else {}
        kind = str(meta.get("kind", ""))
        voltage = float(meta.get("voltage", 0.0))

        if kind == "bus":
            bus_indices = net.bus.index[net.bus.vn_kv == voltage].tolist()
            if point_idx >= len(bus_indices):
                return _EMPTY_HOVER
            return _bus_info(bus_indices[point_idx], voltage)

        raw_text = point.get("text", "")
        info = _tooltip_info(raw_text) if raw_text else None
        return info or _EMPTY_HOVER

    @app.callback(
        Output("element-info", "children"),
        Output("sel-store",    "data"),
        Output("view-store",   "data"),
        Output("bus-search",   "value"),
        Input("graph",         "clickData"),
        Input("bus-search",    "value"),
        Input("btn-reset-view", "n_clicks"),
        State("view-store",    "data"),
    )
    def on_select(
        click_data: dict | None,
        bus_value: int | None,
        reset_clicks: int,
        current_view: dict | None,
    ):
        from dash import ctx as _ctx

        trigger = _ctx.triggered_id
        if trigger == "btn-reset-view":
            return _EMPTY_INFO, None, default_view, None

        if trigger == "bus-search" and bus_value is not None:
            lookup = bus_lookup.get(int(bus_value))
            if lookup is None:
                return _EMPTY_INFO, None, current_view or default_view, bus_value
            curve_num = int(lookup["curve"])
            point_idx = int(lookup["point"])
            voltage = float(lookup["voltage"])
            bus_x = float(fig.data[curve_num].x[point_idx])
            bus_y = float(fig.data[curve_num].y[point_idx])
            view = {
                "x": [bus_x - focus_view["x"], bus_x + focus_view["x"]],
                "y": [bus_y - focus_view["y"], bus_y + focus_view["y"]],
            }
            return _bus_info(int(bus_value), voltage), {"c": curve_num, "p": point_idx}, view, bus_value

        if not click_data:
            return _EMPTY_INFO, None, current_view or default_view, bus_value

        points = click_data.get("points") or []
        if not points:
            return _EMPTY_INFO, None, current_view or default_view, bus_value

        point = points[0]
        curve_num = point.get("curveNumber")
        point_idx = point.get("pointIndex")
        if not isinstance(curve_num, int) or not isinstance(point_idx, int):
            return _EMPTY_INFO, None, current_view or default_view, bus_value

        meta = trace_meta[curve_num] if 0 <= curve_num < len(trace_meta) else {}
        kind = str(meta.get("kind", ""))
        voltage = float(meta.get("voltage", 0.0))

        if kind == "bus":
            bus_indices = net.bus.index[net.bus.vn_kv == voltage].tolist()
            if point_idx >= len(bus_indices):
                return _EMPTY_INFO, None, current_view or default_view, bus_value
            bus_idx = int(bus_indices[point_idx])
            return _bus_info(bus_idx, voltage), {"c": curve_num, "p": point_idx}, current_view or default_view, bus_idx

        # Linie i trafo – midpoint markers mają text tooltipa
        raw_text = point.get("text", "")
        if raw_text:
            info = _tooltip_info(raw_text)
            if info is not None:
                return info, None, current_view or default_view, bus_value

        return _EMPTY_INFO, None, current_view or default_view, bus_value

    return app


# ---------------------------------------------------------------------------
# Punkt wejścia – uruchomienie serwera
# ---------------------------------------------------------------------------

def serve_dash(
    net: pp.pandapowerNet,
    host: str = "127.0.0.1",
    port: int = 8050,
    auto_open: bool = True,
    debug: bool = False,
) -> None:
    """Uruchamia serwer Dash i otwiera przeglądarkę."""
    app = create_dash_app(net)
    url = f"http://{host}:{port}/"
    if auto_open:
        Timer(1.5, lambda: webbrowser.open(url)).start()
    app.run(host=host, port=port, debug=debug)

