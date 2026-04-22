"""Budowanie layoutu aplikacji Dash (sidebar + nagłówek + panel grafu)."""

from __future__ import annotations

from dash import dcc, html

from kse_grid.ui.components import (
    EMPTY_INFO,
    filter_button_style,
    info_row,
    section_heading,
    stat_card,
)
from kse_grid.ui.context import DashContext
from kse_grid.ui.theme import COLORS, FONT_FAMILY, LOADING_LEGEND, MONO_FONT_FAMILY


def _build_summary_section(stats: dict) -> html.Div:
    return html.Div([
        section_heading("Podsumowanie"),
        html.Div(
            style={"display": "grid", "gridTemplateColumns": "1fr 1fr", "gap": 8},
            children=[
                stat_card("Szyny",      stats["n_bus"]),
                stat_card("Linie",      stats["n_line"]),
                stat_card("Trafo",      stats["n_trafo"]),
                stat_card("Generatory", stats["n_gen"]),
                stat_card("Maks. obciążenie", stats["max_loading"],
                          status=stats["load_class"], full_width=True),
                stat_card("Naruszenia U", stats["n_viol"], status=stats["viol_class"]),
                stat_card("Przeciążenia", stats["n_overload"], status=stats["ovl_class"]),
            ],
        ),
    ])


def _build_navigation_section(bus_options: list[dict]) -> html.Div:
    return html.Div([
        section_heading("Nawigacja"),
        dcc.Dropdown(
            id="bus-search",
            options=bus_options,
            value=None,
            placeholder="Wyszukaj szynę...",
            clearable=True,
            optionHeight=36,
            style={"marginBottom": 8, "color": COLORS["bg"]},
        ),
        html.Button("Resetuj widok", id="btn-reset-view", n_clicks=0, style={
            "fontSize": 11, "padding": "6px 10px", "cursor": "pointer",
            "background": COLORS["panel2"], "color": COLORS["text"],
            "border": f"1px solid {COLORS['border']}", "borderRadius": 4, "width": "100%",
        }),
    ])


def _build_voltage_filter_section(
    voltage_levels: list[float],
    default_voltage_filter: list[float],
) -> html.Div:
    return html.Div([
        section_heading("Filtr napięć"),
        html.Div(style={"display": "flex", "gap": 6, "marginBottom": 8}, children=[
            html.Button("Rdzeń 400/220", id="btn-core", n_clicks=0,
                        style=filter_button_style(active=True)),
            html.Button("Wszystkie", id="btn-all", n_clicks=0,
                        style=filter_button_style(active=False)),
            html.Button("Żadne", id="btn-none", n_clicks=0,
                        style=filter_button_style(active=False)),
        ]),
        html.Div(
            "Domyślnie pokazany jest rdzeń 400/220 kV, żeby sieć była czytelna przy dużych case'ach.",
            style={"fontSize": 11, "color": COLORS["dim"], "marginBottom": 8, "lineHeight": 1.4},
        ),
        dcc.Checklist(
            id="voltage-filter",
            options=[{"label": f" {int(v)} kV", "value": v} for v in voltage_levels],
            value=default_voltage_filter,
            style={"display": "flex", "flexDirection": "column", "gap": 6},
            inputStyle={"marginRight": 8, "accentColor": COLORS["accent"], "cursor": "pointer"},
            labelStyle={"fontSize": 13, "color": COLORS["text"], "cursor": "pointer"},
        ),
    ])


def _build_type_filter_section() -> html.Div:
    return html.Div([
        section_heading("Elementy"),
        dcc.Checklist(
            id="type-filter",
            options=[
                {"label": " Linie",          "value": "line"},
                {"label": " Transformatory", "value": "trafo"},
                {"label": " Szyny",          "value": "bus"},
            ],
            value=["line", "trafo", "bus"],
            style={"display": "flex", "flexDirection": "column", "gap": 6},
            inputStyle={"marginRight": 8, "accentColor": COLORS["accent"], "cursor": "pointer"},
            labelStyle={"fontSize": 13, "color": COLORS["text"], "cursor": "pointer"},
        ),
    ])


def _build_loading_legend_section() -> html.Div:
    legend_rows = [
        html.Div(style={"display": "flex", "alignItems": "center", "gap": 8}, children=[
            html.Div(style={"width": 18, "height": 4, "borderRadius": 2, "background": color}),
            html.Span(label, style={"fontSize": 12}),
        ])
        for color, label in LOADING_LEGEND
    ]
    return html.Div([
        section_heading("Legenda obciążenia"),
        html.Div(style={
            "background": COLORS["panel2"], "border": f"1px solid {COLORS['border']}",
            "borderRadius": 8, "padding": "10px 12px",
            "display": "flex", "flexDirection": "column", "gap": 6,
        }, children=legend_rows),
    ])


def _build_sidebar(ctx: DashContext, stats: dict) -> html.Div:
    return html.Div(
        className="app-sidebar",
        style={
            "background": COLORS["panel"],
            "borderRight": f"1px solid {COLORS['border']}",
            "overflowY": "auto",
            "padding": "16px 14px",
            "display": "flex", "flexDirection": "column", "gap": 20,
        },
        children=[
            _build_summary_section(stats),
            _build_navigation_section(ctx.bus_options),
            _build_voltage_filter_section(ctx.voltage_levels, ctx.default_voltage_filter),
            _build_type_filter_section(),
            _build_loading_legend_section(),
        ],
    )


def _build_header(ctx: DashContext, stats: dict) -> html.Div:
    status_label = "✅ Zbieżny" if ctx.has_results else "⚠️ Brak wyników load flow"
    status_color = COLORS["good"] if ctx.has_results else COLORS["warn"]

    return html.Div(className="app-header", style={
        "display": "flex", "alignItems": "center",
        "justifyContent": "space-between",
        "padding": "0 24px",
        "height": "56px",
        "background": COLORS["panel"],
        "borderBottom": f"1px solid {COLORS['border']}",
    }, children=[
        html.Div(style={"display": "flex", "alignItems": "center", "gap": 12}, children=[
            html.Div("⚡", style={
                "width": 32, "height": 32, "borderRadius": 8, "fontSize": 16,
                "background": "linear-gradient(135deg,#4ea1ff 0%,#a371f7 100%)",
                "display": "flex", "alignItems": "center", "justifyContent": "center",
                "fontWeight": 700, "color": COLORS["bg"],
            }),
            html.Span(ctx.net_name, style={"fontWeight": 600, "fontSize": 15}),
            html.Span(
                f"{stats['n_bus']} szyn · {stats['n_line']} linii · {stats['n_trafo']} trafo",
                style={"color": COLORS["dim"], "fontSize": 12},
            ),
        ]),
        html.Span(status_label, style={
            "fontSize": 12,
            "color": status_color,
            "fontFamily": MONO_FONT_FAMILY,
        }),
    ])


def _build_graph_panel(ctx: DashContext) -> html.Div:
    return html.Div(
        className="graph-panel",
        style={"overflow": "hidden", "minWidth": 0, "minHeight": 0, "position": "relative"},
        children=[
            dcc.Graph(
                id="graph",
                className="graph-canvas",
                figure=ctx.fig,
                responsive=True,
                config={"displayModeBar": False, "scrollZoom": True},
                style={"width": "100%", "height": "100%"},
            ),
            html.Div(
                id="selection-card",
                className="selection-card",
                style={"display": "none"},
                children=EMPTY_INFO,
            ),
        ],
    )


def build_app_layout(ctx: DashContext, stats: dict) -> html.Div:
    """Cały szkielet aplikacji: nagłówek + sidebar + panel grafu + ukryte stores."""
    return html.Div(
        className="app-shell",
        style={
            "background": COLORS["bg"], "color": COLORS["text"],
            "fontFamily": FONT_FAMILY,
        },
        children=[
            dcc.Store(id="sel-store", data=None),
            dcc.Store(id="view-store", data=ctx.default_view),
            html.Button(id="clear-selection", n_clicks=0, style={"display": "none"}),
            _build_header(ctx, stats),
            html.Div(className="app-body", style={
                "display": "grid",
                "gridTemplateColumns": "300px minmax(0, 1fr)",
                "minHeight": 0,
                "overflow": "hidden",
            }, children=[
                _build_sidebar(ctx, stats),
                _build_graph_panel(ctx),
            ]),
        ],
    )
