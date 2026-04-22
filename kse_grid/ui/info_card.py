"""Budowanie zawartości karty selekcji (szyna, linia, transformator)."""

from __future__ import annotations

import re

import pandapower as pp
from dash import html

from kse_grid.ui.components import info_row
from kse_grid.ui.theme import COLORS


def _voltage_status_color(vm_pu: float) -> str:
    if 0.95 <= vm_pu <= 1.05:
        return COLORS["good"]
    if 0.9 <= vm_pu <= 1.1:
        return COLORS["warn"]
    return COLORS["bad"]


def _title(text: str) -> html.Div:
    return html.Div(text, style={
        "fontWeight": 600,
        "marginBottom": 8,
        "fontSize": 13,
        "color": COLORS["accent"],
        "wordBreak": "break-word",
    })


def _bus_load_mw(net: pp.pandapowerNet, bus_idx: int) -> float:
    if net.load.empty:
        return 0.0
    return float(net.load.loc[net.load.bus == bus_idx, "p_mw"].sum())


def _bus_gen_mw(net: pp.pandapowerNet, bus_idx: int) -> float:
    if net.gen.empty:
        return 0.0
    return float(net.gen.loc[net.gen.bus == bus_idx, "p_mw"].sum())


def build_bus_card(net: pp.pandapowerNet, bus_idx: int, voltage_kv: float) -> html.Div:
    """Karta selekcji dla wybranej szyny — pełne dane z load flow."""
    row = net.bus.loc[bus_idx]
    has_results = not net.res_bus.empty

    items: list = [_title(row["name"]), info_row("Napięcie znam.", f"{int(voltage_kv)} kV")]

    if has_results:
        vm = float(net.res_bus.at[bus_idx, "vm_pu"])
        va = float(net.res_bus.at[bus_idx, "va_degree"])
        items.append(info_row("Um", f"{vm:.4f} p.u.", _voltage_status_color(vm)))
        items.append(info_row("Kąt", f"{va:.2f}°"))

    gen_mw = _bus_gen_mw(net, bus_idx)
    if gen_mw > 0:
        items.append(info_row("Generacja", f"{gen_mw:.1f} MW", COLORS["good"]))

    load_mw = _bus_load_mw(net, bus_idx)
    if load_mw > 0:
        items.append(info_row("Obciążenie", f"{load_mw:.1f} MW"))

    return html.Div(items)


_HTML_BR_RE = re.compile(r"<br\s*/?>", re.IGNORECASE)
_HTML_TAG_RE = re.compile(r"<[^>]+>")


def _strip_html_to_lines(html_text: str) -> list[str]:
    """Rozkłada tekst hovertemplate Plotly (z `<br>`) na czyste linie."""
    parts = _HTML_BR_RE.split(html_text)
    return [_HTML_TAG_RE.sub("", part).strip() for part in parts if part.strip()]


def build_hovertext_card(hovertext: str) -> html.Div | None:
    """Karta selekcji dla linii/trafo — zbudowana z tekstu hovertemplate."""
    lines = _strip_html_to_lines(hovertext)
    if not lines:
        return None

    rows: list = [_title(lines[0])]
    for line in lines[1:]:
        if ": " in line:
            label, value = line.split(": ", 1)
            rows.append(info_row(label, value))
        else:
            rows.append(html.Div(line, style={"fontSize": 12, "padding": "4px 0"}))
    return html.Div(rows)
