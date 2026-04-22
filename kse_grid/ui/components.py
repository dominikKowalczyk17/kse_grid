"""Małe, wielokrotnego użytku komponenty Dash dla dashboardu."""

from __future__ import annotations

from dash import html

from kse_grid.ui.theme import COLORS, MONO_FONT_FAMILY, STATUS_COLORS


def section_heading(text: str) -> html.Div:
    """Nagłówek sekcji w sidebarze (uppercase, dim)."""
    return html.Div(text, style={
        "fontSize": 11,
        "textTransform": "uppercase",
        "letterSpacing": "1.2px",
        "color": COLORS["dim"],
        "margin": "0 0 8px 0",
        "fontWeight": 600,
    })


def stat_card(label: str, value: object, status: str = "", full_width: bool = False) -> html.Div:
    """Kafelek z wartością statystyki sieci."""
    color = STATUS_COLORS.get(status, COLORS["text"])
    container_style: dict = {
        "background": COLORS["panel2"],
        "border": f"1px solid {COLORS['border']}",
        "borderRadius": 8,
        "padding": "8px 12px",
    }
    if full_width:
        container_style["gridColumn"] = "1 / -1"

    return html.Div(style=container_style, children=[
        html.Div(label, style={
            "fontSize": 10,
            "textTransform": "uppercase",
            "color": COLORS["dim"],
            "letterSpacing": "0.8px",
            "marginBottom": 4,
        }),
        html.Div(str(value), style={
            "fontSize": 18,
            "fontWeight": 600,
            "fontFamily": MONO_FONT_FAMILY,
            "color": color,
        }),
    ])


def info_row(label: str, value: str, value_color: str = COLORS["text"]) -> html.Div:
    """Wiersz „etykieta → wartość" w karcie selekcji."""
    return html.Div(style={
        "display": "flex",
        "justifyContent": "space-between",
        "padding": "4px 0",
        "borderBottom": f"1px solid {COLORS['border']}",
        "fontSize": 12,
    }, children=[
        html.Span(label, style={"color": COLORS["dim"]}),
        html.Span(value, style={
            "fontFamily": MONO_FONT_FAMILY,
            "fontWeight": 500,
            "color": value_color,
        }),
    ])


def filter_button_style(active: bool) -> dict[str, object]:
    """Styl przycisku presetu filtra napięć (aktywny vs nieaktywny)."""
    return {
        "fontSize": 11,
        "padding": "3px 8px",
        "cursor": "pointer",
        "borderRadius": 4,
        "border": f"1px solid {COLORS['accent'] if active else COLORS['border']}",
        "background": "rgba(78,161,255,0.16)" if active else COLORS["panel2"],
        "color": COLORS["text"] if active else COLORS["dim"],
        "boxShadow": "inset 0 0 0 1px rgba(78,161,255,0.25)" if active else "none",
    }


SELECTION_CARD_STYLE: dict[str, object] = {
    "display": "block",
    "position": "absolute",
    "top": 16,
    "right": 16,
    "width": 320,
    "maxWidth": "calc(100% - 32px)",
    "maxHeight": "calc(100% - 32px)",
    "overflowY": "auto",
    "background": "rgba(17,22,29,0.94)",
    "backdropFilter": "blur(8px)",
    "border": f"1px solid {COLORS['border']}",
    "borderRadius": 10,
    "padding": "12px 14px",
    "boxShadow": "0 12px 28px rgba(0,0,0,0.35)",
    "zIndex": 10,
}

EMPTY_INFO = html.Div(
    "Kliknij węzeł lub linię, aby zobaczyć szczegóły.",
    style={"color": COLORS["dim"], "fontSize": 12, "fontStyle": "italic"},
)
