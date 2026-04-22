"""Budowanie figury Plotly i statystyk sieci dla dashboardu Dash."""

from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Final

import networkx as nx
import pandapower as pp
import plotly.graph_objects as go


# ---------------------------------------------------------------------------
# Stałe wyglądu — w jednym miejscu, łatwo dostroić.
# ---------------------------------------------------------------------------

_LINE_BG: Final[str] = "#0e1116"
_PANEL_BG: Final[str] = "#161b22"
_BORDER:  Final[str] = "#30363d"
_TEXT:    Final[str] = "#e6edf3"

_VOLTAGE_OK_MIN: Final[float] = 0.95
_VOLTAGE_OK_MAX: Final[float] = 1.05
_OVERLOAD_PCT:   Final[float] = 100.0
_LOAD_WARN_PCT:  Final[float] = 80.0
_LOAD_BAD_PCT:   Final[float] = 100.0


@dataclass(frozen=True)
class _LoadingBin:
    label: str
    lower: float
    upper: float
    color: str


_LINE_BINS: Final[tuple[_LoadingBin, ...]] = (
    _LoadingBin("0-40%",   0.0,           40.0,           "#43A047"),
    _LoadingBin("40-70%",  40.0,          70.0,           "#F9A825"),
    _LoadingBin("70-100%", 70.0,          100.0,          "#FB8C00"),
    _LoadingBin(">100%",   100.0,         float("inf"),   "#D32F2F"),
)

_TRAFO_BINS: Final[tuple[_LoadingBin, ...]] = (
    _LoadingBin("0-40%",   0.0,           40.0,           "#90CAF9"),
    _LoadingBin("40-70%",  40.0,          70.0,           "#26A69A"),
    _LoadingBin("70-100%", 70.0,          100.0,          "#FFB300"),
    _LoadingBin(">100%",   100.0,         float("inf"),   "#C62828"),
)

_LINE_WIDTHS: Final[tuple[tuple[float, float], ...]] = (
    (400.0, 3.6),
    (220.0, 2.6),
    (110.0, 1.7),
    (0.0,   1.2),
)

_BUS_SIZES: Final[tuple[tuple[float, float], ...]] = (
    (400.0, 14),
    (220.0, 12),
    (110.0, 10),
    (0.0,   8),
)


# ---------------------------------------------------------------------------
# Statystyki sieci dla kafelków sidebaru.
# ---------------------------------------------------------------------------

def _max_loading(net: pp.pandapowerNet) -> float:
    """Największe z procentowych obciążeń linii i transformatorów."""
    candidates: list[float] = []
    if not net.res_line.empty:
        line_loadings = net.res_line["loading_percent"].dropna()
        if not line_loadings.empty:
            candidates.append(float(line_loadings.max()))
    if not net.res_trafo.empty:
        trafo_loadings = net.res_trafo["loading_percent"].dropna()
        if not trafo_loadings.empty:
            candidates.append(float(trafo_loadings.max()))
    return max(candidates, default=0.0)


def _count_voltage_violations(net: pp.pandapowerNet) -> int:
    if net.res_bus.empty:
        return 0
    vm = net.res_bus["vm_pu"].dropna()
    return int(((vm < _VOLTAGE_OK_MIN) | (vm > _VOLTAGE_OK_MAX)).sum())


def _count_overloads(net: pp.pandapowerNet) -> int:
    total = 0
    if not net.res_line.empty:
        total += int((net.res_line["loading_percent"].fillna(0.0) > _OVERLOAD_PCT).sum())
    if not net.res_trafo.empty:
        total += int((net.res_trafo["loading_percent"].fillna(0.0) > _OVERLOAD_PCT).sum())
    return total


def _status_class(value: float, warn: float, bad: float) -> str:
    if value >= bad:
        return "bad"
    if value >= warn:
        return "warn"
    return "good"


def _compute_stats(net: pp.pandapowerNet) -> dict[str, object]:
    """Statystyki wyświetlane w sidebarze."""
    max_loading = _max_loading(net)
    n_viol = _count_voltage_violations(net)
    n_overload = _count_overloads(net)
    return {
        "n_bus":      int(len(net.bus)),
        "n_line":     int(len(net.line)),
        "n_trafo":    int(len(net.trafo)),
        "n_gen":      int(len(net.gen)),
        "max_loading": f"{max_loading:.1f}%",
        "load_class":  _status_class(max_loading, _LOAD_WARN_PCT, _LOAD_BAD_PCT),
        "n_viol":      n_viol,
        "viol_class":  _status_class(float(n_viol), 1.0, 5.0),
        "n_overload":  n_overload,
        "ovl_class":   _status_class(float(n_overload), 1.0, 5.0),
    }


# ---------------------------------------------------------------------------
# Budowa figury Plotly.
# ---------------------------------------------------------------------------

def build_figure_for_dash(
    net: pp.pandapowerNet,
) -> tuple[go.Figure, list[dict], list[float]]:
    """Buduje figurę Plotly dla dashboardu Dash.

    Returns:
        (fig, trace_meta, voltage_levels) — `voltage_levels` to posortowana
        malejąco lista unikalnych napięć, używana do filtrów w sidebarze.
    """
    positions = _bus_positions(net)
    traces, trace_meta = _build_traces(net, positions)

    fig = go.Figure(data=traces)
    fig.update_layout(
        template="plotly_dark",
        paper_bgcolor=_LINE_BG,
        plot_bgcolor=_LINE_BG,
        font=dict(family="Inter, system-ui, sans-serif", color=_TEXT, size=12),
        hovermode="closest",
        dragmode="pan",
        clickmode="event",
        hoverdistance=18,
        autosize=True,
        showlegend=False,
        uirevision="kse-grid",
        margin=dict(l=0, r=0, t=0, b=0),
        hoverlabel=dict(
            bgcolor=_PANEL_BG,
            bordercolor=_BORDER,
            font=dict(family="Inter, system-ui, sans-serif", color=_TEXT, size=12),
        ),
    )
    _configure_axes(fig, positions)
    fig.update_xaxes(visible=False)
    fig.update_yaxes(visible=False, scaleanchor="x", scaleratio=1)

    voltage_levels = sorted({m["voltage"] for m in trace_meta}, reverse=True)
    return fig, trace_meta, voltage_levels


def _build_traces(
    net: pp.pandapowerNet,
    positions: dict[int, tuple[float, float]],
) -> tuple[list[go.Scatter], list[dict[str, object]]]:
    line_traces, line_meta = _line_traces(net, positions)
    bus_traces, bus_meta = _bus_traces(net, positions)
    trafo_traces, trafo_meta = _trafo_traces(net, positions)
    return (
        [*line_traces, *bus_traces, *trafo_traces],
        [*line_meta, *bus_meta, *trafo_meta],
    )


# ---------------------------------------------------------------------------
# Pozycje szyn (geo lub spring layout).
# ---------------------------------------------------------------------------

def _bus_positions(net: pp.pandapowerNet) -> dict[int, tuple[float, float]]:
    geo_positions: dict[int, tuple[float, float]] = {}
    for bus_idx, row in net.bus.iterrows():
        geo = row.get("geo")
        if not geo:
            continue
        data = json.loads(geo) if isinstance(geo, str) else geo
        lat, lon = data["coordinates"]
        geo_positions[bus_idx] = (lon, lat)

    if len(geo_positions) == len(net.bus):
        return geo_positions
    return _spring_layout_positions(net)


def _spring_layout_positions(net: pp.pandapowerNet) -> dict[int, tuple[float, float]]:
    graph = nx.Graph()
    graph.add_nodes_from(net.bus.index.tolist())
    graph.add_edges_from(zip(net.line.from_bus.tolist(), net.line.to_bus.tolist()))
    graph.add_edges_from(zip(net.trafo.hv_bus.tolist(), net.trafo.lv_bus.tolist()))
    layout = nx.spring_layout(graph, seed=42, iterations=30)
    return {bus_idx: (float(x), float(y)) for bus_idx, (x, y) in layout.items()}


def _configure_axes(fig: go.Figure, positions: dict[int, tuple[float, float]]) -> None:
    x_min, x_max, y_min, y_max = _auto_bounds(positions)
    fig.update_xaxes(range=[x_min, x_max])
    fig.update_yaxes(range=[y_min, y_max])


def _auto_bounds(
    positions: dict[int, tuple[float, float]],
    padding_ratio: float = 0.08,
) -> tuple[float, float, float, float]:
    xs = [x for x, _ in positions.values()]
    ys = [y for _, y in positions.values()]
    x_min, x_max = min(xs), max(xs)
    y_min, y_max = min(ys), max(ys)
    x_pad = max((x_max - x_min) * padding_ratio, 0.2)
    y_pad = max((y_max - y_min) * padding_ratio, 0.2)
    return x_min - x_pad, x_max + x_pad, y_min - y_pad, y_max + y_pad


# ---------------------------------------------------------------------------
# Ślady linii.
# ---------------------------------------------------------------------------

def _line_traces(
    net: pp.pandapowerNet,
    positions: dict[int, tuple[float, float]],
) -> tuple[list[go.Scatter], list[dict[str, object]]]:
    traces: list[go.Scatter] = []
    trace_meta: list[dict[str, object]] = []
    voltage_levels = sorted({float(v) for v in net.bus.vn_kv.dropna().tolist() if v > 0})
    has_results = not net.res_line.empty

    for level in voltage_levels:
        level_lines = net.line.index[net.bus.loc[net.line.from_bus, "vn_kv"].to_numpy() == level]
        for bin_idx, bucket in enumerate(_LINE_BINS):
            segments = _collect_line_segments(net, positions, level_lines, bucket, level, has_results)
            if not segments.has_any:
                continue

            legend_group = f"linie-{int(level)}"
            traces.append(_line_segment_trace(segments, level, bucket, legend_group, bin_idx == 0))
            trace_meta.append({"kind": "line", "voltage": level})
            traces.append(_line_hover_trace(segments, level, bucket, legend_group))
            trace_meta.append({"kind": "line", "voltage": level})

    return traces, trace_meta


@dataclass
class _Segments:
    polyline_x: list[float | None]
    polyline_y: list[float | None]
    midpoint_x: list[float]
    midpoint_y: list[float]
    hover_text: list[str]

    @property
    def has_any(self) -> bool:
        return bool(self.polyline_x)


def _collect_line_segments(
    net: pp.pandapowerNet,
    positions: dict[int, tuple[float, float]],
    line_indices,
    bucket: _LoadingBin,
    voltage: float,
    has_results: bool,
) -> _Segments:
    seg = _Segments([], [], [], [], [])
    for line_idx in line_indices:
        row = net.line.loc[line_idx]
        loading = float(net.res_line.at[line_idx, "loading_percent"]) if has_results else 0.0
        if loading < bucket.lower or loading >= bucket.upper:
            continue

        x1, y1 = positions[row.from_bus]
        x2, y2 = positions[row.to_bus]
        seg.polyline_x.extend([x1, x2, None])
        seg.polyline_y.extend([y1, y2, None])
        seg.midpoint_x.append((x1 + x2) / 2)
        seg.midpoint_y.append((y1 + y2) / 2)

        details = [
            f"<b>{row['name']}</b>",
            f"Napięcie: {voltage:.0f} kV",
            f"Długość: {row['length_km']:.1f} km",
        ]
        if has_results:
            details.append(f"Obciążenie: {loading:.1f}%")
            details.append(f"P od strony from: {net.res_line.at[line_idx, 'p_from_mw']:.1f} MW")
        seg.hover_text.append("<br>".join(details))
    return seg


def _line_segment_trace(seg: _Segments, voltage: float, bucket: _LoadingBin, legend_group: str, show_legend: bool) -> go.Scatter:
    return go.Scatter(
        x=seg.polyline_x, y=seg.polyline_y,
        mode="lines",
        name=f"Linie {int(voltage)} kV",
        legendgroup=legend_group,
        showlegend=show_legend,
        hoverinfo="skip",
        line=dict(color=bucket.color, width=_line_width(voltage)),
    )


def _line_hover_trace(seg: _Segments, voltage: float, bucket: _LoadingBin, legend_group: str) -> go.Scatter:
    return go.Scatter(
        x=seg.midpoint_x, y=seg.midpoint_y,
        mode="markers",
        name=f"Linie {int(voltage)} kV - {bucket.label}",
        legendgroup=legend_group,
        showlegend=False,
        hovertemplate="%{text}<extra></extra>",
        text=seg.hover_text,
        marker=dict(size=max(_line_width(voltage) * 2.5, 8), color=bucket.color, opacity=0.25),
    )


# ---------------------------------------------------------------------------
# Ślady transformatorów (grupowane po napięciu strony LV).
# ---------------------------------------------------------------------------

def _trafo_traces(
    net: pp.pandapowerNet,
    positions: dict[int, tuple[float, float]],
) -> tuple[list[go.Scatter], list[dict[str, object]]]:
    traces: list[go.Scatter] = []
    trace_meta: list[dict[str, object]] = []
    has_results = not net.res_trafo.empty

    # Grupujemy trafo po napięciu strony LV — to decyduje, do którego poziomu
    # napięcia "należy" trafo przy filtrowaniu (np. trafo 400/220 zostaje
    # widoczne, gdy 110 kV jest odznaczone).
    lv_levels = sorted(net.trafo["vn_lv_kv"].dropna().unique().tolist(), reverse=True)

    for lv_level in lv_levels:
        lv_rows = net.trafo.index[net.trafo["vn_lv_kv"] == lv_level]
        legend_group = f"transformatory-{int(lv_level)}"

        for bin_idx, bucket in enumerate(_TRAFO_BINS):
            segments = _collect_trafo_segments(net, positions, lv_rows, bucket, has_results)
            if not segments.has_any:
                continue

            traces.append(_trafo_segment_trace(segments, lv_level, bucket, legend_group, bin_idx == 0))
            trace_meta.append({"kind": "trafo", "voltage": lv_level})
            traces.append(_trafo_hover_trace(segments, lv_level, bucket, legend_group))
            trace_meta.append({"kind": "trafo", "voltage": lv_level})

    return traces, trace_meta


def _collect_trafo_segments(
    net: pp.pandapowerNet,
    positions: dict[int, tuple[float, float]],
    trafo_indices,
    bucket: _LoadingBin,
    has_results: bool,
) -> _Segments:
    seg = _Segments([], [], [], [], [])
    for trafo_idx in trafo_indices:
        row = net.trafo.loc[trafo_idx]
        loading = float(net.res_trafo.at[trafo_idx, "loading_percent"]) if has_results else 0.0
        if loading < bucket.lower or loading >= bucket.upper:
            continue

        x1, y1 = positions[row.hv_bus]
        x2, y2 = positions[row.lv_bus]
        seg.polyline_x.extend([x1, x2, None])
        seg.polyline_y.extend([y1, y2, None])
        seg.midpoint_x.append((x1 + x2) / 2)
        seg.midpoint_y.append((y1 + y2) / 2)

        details = [
            f"<b>{row['name']}</b>",
            f"Trafo {row['vn_hv_kv']:.0f}/{row['vn_lv_kv']:.0f} kV",
            f"Moc znamionowa: {row['sn_mva']:.0f} MVA",
        ]
        if has_results:
            details.append(f"Obciążenie: {loading:.1f}%")
            details.append(f"P po stronie HV: {net.res_trafo.at[trafo_idx, 'p_hv_mw']:.1f} MW")
        seg.hover_text.append("<br>".join(details))
    return seg


def _trafo_segment_trace(seg: _Segments, lv_level: float, bucket: _LoadingBin, legend_group: str, show_legend: bool) -> go.Scatter:
    return go.Scatter(
        x=seg.polyline_x, y=seg.polyline_y,
        mode="lines",
        name=f"Trafo /{int(lv_level)} kV",
        legendgroup=legend_group,
        showlegend=show_legend,
        hoverinfo="skip",
        line=dict(color=bucket.color, width=2.2, dash="dot"),
    )


def _trafo_hover_trace(seg: _Segments, lv_level: float, bucket: _LoadingBin, legend_group: str) -> go.Scatter:
    return go.Scatter(
        x=seg.midpoint_x, y=seg.midpoint_y,
        mode="markers",
        name=f"Trafo /{int(lv_level)} kV - {bucket.label}",
        legendgroup=legend_group,
        showlegend=False,
        hovertemplate="%{text}<extra></extra>",
        text=seg.hover_text,
        marker=dict(size=9, color=bucket.color, opacity=0.35, symbol="diamond"),
    )


# ---------------------------------------------------------------------------
# Ślady szyn.
# ---------------------------------------------------------------------------

def _bus_traces(
    net: pp.pandapowerNet,
    positions: dict[int, tuple[float, float]],
) -> tuple[list[go.Scatter], list[dict[str, object]]]:
    traces: list[go.Scatter] = []
    trace_meta: list[dict[str, object]] = []
    voltage_levels = sorted({float(v) for v in net.bus.vn_kv.dropna().tolist() if v > 0})
    has_results = not net.res_bus.empty

    for idx, level in enumerate(voltage_levels):
        bus_indices = net.bus.index[net.bus.vn_kv == level]
        xs, ys, hovers, color_values = _collect_bus_points(net, positions, bus_indices, has_results)

        traces.append(go.Scatter(
            x=xs, y=ys,
            mode="markers",
            name=f"Szyny {int(level)} kV",
            legendgroup=f"szyny-{int(level)}",
            showlegend=True,
            hovertemplate="%{text}<extra></extra>",
            text=hovers,
            marker=_bus_marker(level, color_values, show_colorbar=idx == 0 and has_results),
        ))
        trace_meta.append({"kind": "bus", "voltage": level})

    return traces, trace_meta


def _collect_bus_points(
    net: pp.pandapowerNet,
    positions: dict[int, tuple[float, float]],
    bus_indices,
    has_results: bool,
) -> tuple[list[float], list[float], list[str], list[float]]:
    xs: list[float] = []
    ys: list[float] = []
    hovers: list[str] = []
    color_values: list[float] = []

    for bus_idx in bus_indices:
        row = net.bus.loc[bus_idx]
        bus_x, bus_y = positions[bus_idx]
        xs.append(bus_x)
        ys.append(bus_y)
        color_values.append(float(net.res_bus.at[bus_idx, "vm_pu"]) if has_results else 1.0)
        hovers.append(_bus_hover_text(net, bus_idx, row, has_results))

    return xs, ys, hovers, color_values


def _bus_hover_text(net: pp.pandapowerNet, bus_idx: int, row, has_results: bool) -> str:
    load_mw = net.load.loc[net.load.bus == bus_idx, "p_mw"].sum() if "load" in net else 0.0
    gen_mw = net.gen.loc[net.gen.bus == bus_idx, "p_mw"].sum() if "gen" in net else 0.0

    details = [
        f"<b>{row['name']}</b>",
        f"Napięcie znamionowe: {row['vn_kv']:.0f} kV",
    ]
    if has_results:
        details.append(f"Um: {net.res_bus.at[bus_idx, 'vm_pu']:.4f} p.u.")
        details.append(f"Kąt: {net.res_bus.at[bus_idx, 'va_degree']:.2f}°")
    if gen_mw:
        details.append(f"Generacja: {gen_mw:.1f} MW")
    if load_mw:
        details.append(f"Obciążenie: {load_mw:.1f} MW")
    return "<br>".join(details)


def _bus_marker(level: float, color_values: list[float], show_colorbar: bool) -> dict:
    marker = dict(
        size=_bus_size(level),
        color=color_values,
        colorscale="Turbo",
        cmin=0.9,
        cmax=1.1,
        showscale=show_colorbar,
        line=dict(color=_LINE_BG, width=1.0),
    )
    if show_colorbar:
        marker["colorbar"] = dict(
            title=dict(text="Um [p.u.]", font=dict(color=_TEXT)),
            tickfont=dict(color=_TEXT),
            bgcolor="rgba(22,27,34,0.7)",
            bordercolor=_BORDER,
            borderwidth=1,
            outlinewidth=0,
            thickness=14,
            len=0.6,
            x=1.0,
        )
    return marker


# ---------------------------------------------------------------------------
# Skalowanie szerokości linii i rozmiaru szyn wg napięcia.
# ---------------------------------------------------------------------------

def _line_width(voltage_kv: float) -> float:
    for threshold, width in _LINE_WIDTHS:
        if voltage_kv >= threshold:
            return width
    return _LINE_WIDTHS[-1][1]


def _bus_size(voltage_kv: float) -> float:
    for threshold, size in _BUS_SIZES:
        if voltage_kv >= threshold:
            return size
    return _BUS_SIZES[-1][1]
