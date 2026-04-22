import json

import networkx as nx
import pandapower as pp
import plotly.graph_objects as go


def _compute_stats(net: pp.pandapowerNet) -> dict[str, object]:
    has_bus_results = not net.res_bus.empty
    has_line_results = not net.res_line.empty
    has_trafo_results = not net.res_trafo.empty

    max_line_loading = (
        float(net.res_line["loading_percent"].max())
        if has_line_results and not net.res_line["loading_percent"].dropna().empty
        else 0.0
    )
    max_trafo_loading = (
        float(net.res_trafo["loading_percent"].max())
        if has_trafo_results and not net.res_trafo["loading_percent"].dropna().empty
        else 0.0
    )
    max_loading = max(max_line_loading, max_trafo_loading)

    n_viol = 0
    if has_bus_results:
        vm = net.res_bus["vm_pu"].dropna()
        n_viol = int(((vm < 0.95) | (vm > 1.05)).sum())

    n_line_overload = (
        int((net.res_line["loading_percent"].fillna(0.0) > 100.0).sum())
        if has_line_results
        else 0
    )
    n_trafo_overload = (
        int((net.res_trafo["loading_percent"].fillna(0.0) > 100.0).sum())
        if has_trafo_results
        else 0
    )
    n_overload = n_line_overload + n_trafo_overload

    def _status_class(value: float, warn_threshold: float, bad_threshold: float) -> str:
        if value >= bad_threshold:
            return "bad"
        if value >= warn_threshold:
            return "warn"
        return "good"

    return {
        "n_bus": int(len(net.bus)),
        "n_line": int(len(net.line)),
        "n_trafo": int(len(net.trafo)),
        "n_gen": int(len(net.gen)),
        "max_loading": f"{max_loading:.1f}%",
        "load_class": _status_class(max_loading, 80.0, 100.0),
        "n_viol": n_viol,
        "viol_class": _status_class(float(n_viol), 1.0, 5.0),
        "n_overload": n_overload,
        "ovl_class": _status_class(float(n_overload), 1.0, 5.0),
    }


def build_figure_for_dash(
    net: pp.pandapowerNet,
) -> tuple[go.Figure, list[dict], list[float]]:
    """Buduje figurę Plotly dla dashboardu Dash (bez menu filtrów Plotly).

    Returns:
        (fig, trace_meta, voltage_levels) gdzie voltage_levels to posortowana
        lista unikalnych napięć (malejąco) do budowy checkboxów filtrów.
    """
    positions, _ = _bus_positions(net)
    traces, trace_meta = _build_traces(net, positions)

    fig = go.Figure(data=traces)
    fig.update_layout(
        template="plotly_dark",
        paper_bgcolor="#0e1116",
        plot_bgcolor="#0e1116",
        font=dict(family="Inter, system-ui, sans-serif", color="#e6edf3", size=12),
        hovermode="closest",
        dragmode="pan",
        clickmode="event",
        hoverdistance=18,
        autosize=True,
        showlegend=False,
        uirevision="kse-grid",
        margin=dict(l=0, r=0, t=0, b=0),
        hoverlabel=dict(
            bgcolor="#161b22",
            bordercolor="#30363d",
            font=dict(family="Inter, system-ui, sans-serif", color="#e6edf3", size=12),
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
    traces: list[go.Scatter] = []
    trace_meta: list[dict[str, object]] = []

    line_traces, line_meta = _line_traces(net, positions)
    bus_traces, bus_meta = _bus_traces(net, positions)
    trafo_traces, trafo_meta = _trafo_traces(net, positions)

    traces.extend(line_traces)
    traces.extend(bus_traces)
    traces.extend(trafo_traces)
    trace_meta.extend(line_meta)
    trace_meta.extend(bus_meta)
    trace_meta.extend(trafo_meta)
    return traces, trace_meta


def _bus_positions(net: pp.pandapowerNet) -> tuple[dict[int, tuple[float, float]], bool]:
    positions: dict[int, tuple[float, float]] = {}
    for bus_idx, row in net.bus.iterrows():
        geo = row.get("geo")
        if not geo:
            continue

        data = json.loads(geo) if isinstance(geo, str) else geo
        coordinates = data["coordinates"]
        lat, lon = coordinates
        positions[bus_idx] = (lon, lat)

    if len(positions) == len(net.bus):
        return positions, True
    return _generic_positions(net), False


def _generic_positions(net: pp.pandapowerNet) -> dict[int, tuple[float, float]]:
    graph = nx.Graph()
    graph.add_nodes_from(net.bus.index.tolist())
    graph.add_edges_from(zip(net.line.from_bus.tolist(), net.line.to_bus.tolist()))
    graph.add_edges_from(zip(net.trafo.hv_bus.tolist(), net.trafo.lv_bus.tolist()))
    layout = nx.spring_layout(graph, seed=42, iterations=30)
    return {bus_idx: (float(x), float(y)) for bus_idx, (x, y) in layout.items()}


def _configure_axes(
    fig: go.Figure,
    positions: dict[int, tuple[float, float]],
):
    bounds = _auto_bounds(positions)
    lon_min, lon_max, lat_min, lat_max = bounds
    fig.update_xaxes(range=[lon_min, lon_max])
    fig.update_yaxes(range=[lat_min, lat_max])


def _auto_bounds(positions: dict[int, tuple[float, float]], padding_ratio: float = 0.08) -> tuple[float, float, float, float]:
    x_values = [x for x, _ in positions.values()]
    y_values = [y for _, y in positions.values()]
    x_min = min(x_values)
    x_max = max(x_values)
    y_min = min(y_values)
    y_max = max(y_values)

    x_padding = max((x_max - x_min) * padding_ratio, 0.2)
    y_padding = max((y_max - y_min) * padding_ratio, 0.2)
    return (
        x_min - x_padding,
        x_max + x_padding,
        y_min - y_padding,
        y_max + y_padding,
    )


def _line_traces(
    net: pp.pandapowerNet,
    positions: dict[int, tuple[float, float]],
) -> tuple[list[go.Scatter], list[dict[str, object]]]:
    traces: list[go.Scatter] = []
    trace_meta: list[dict[str, object]] = []
    levels = sorted({float(v) for v in net.bus.vn_kv.dropna().tolist() if v > 0})
    bins = [
        ("0-40%", 0.0, 40.0, "#43A047"),
        ("40-70%", 40.0, 70.0, "#F9A825"),
        ("70-100%", 70.0, 100.0, "#FB8C00"),
        (">100%", 100.0, float("inf"), "#D32F2F"),
    ]
    has_results = not net.res_line.empty

    for level in levels:
        level_rows = net.line.index[net.bus.loc[net.line.from_bus, "vn_kv"].to_numpy() == level]
        for bin_idx, (label, lower, upper, color) in enumerate(bins):
            x_points: list[float | None] = []
            y_points: list[float | None] = []
            mid_x: list[float] = []
            mid_y: list[float] = []
            hover_text: list[str] = []

            for line_idx in level_rows:
                row = net.line.loc[line_idx]
                loading = float(net.res_line.at[line_idx, "loading_percent"]) if has_results else 0.0
                if loading < lower or loading >= upper:
                    continue

                x1, y1 = positions[row.from_bus]
                x2, y2 = positions[row.to_bus]
                x_points.extend([x1, x2, None])
                y_points.extend([y1, y2, None])
                mid_x.append((x1 + x2) / 2)
                mid_y.append((y1 + y2) / 2)

                details = [
                    f"<b>{row['name']}</b>",
                    f"Napięcie: {level:.0f} kV",
                    f"Długość: {row['length_km']:.1f} km",
                ]
                if has_results:
                    details.append(f"Obciążenie: {loading:.1f}%")
                    details.append(f"P od strony from: {net.res_line.at[line_idx, 'p_from_mw']:.1f} MW")
                hover_text.append("<br>".join(details))

            if not x_points:
                continue

            legend_group = f"linie-{int(level)}"
            traces.append(
                go.Scatter(
                    x=x_points,
                    y=y_points,
                    mode="lines",
                    name=f"Linie {int(level)} kV",
                    legendgroup=legend_group,
                    showlegend=bin_idx == 0,
                    hoverinfo="skip",
                    line=dict(color=color, width=_line_width(level)),
                )
            )
            trace_meta.append({"kind": "line", "voltage": level})

            traces.append(
                go.Scatter(
                    x=mid_x,
                    y=mid_y,
                    mode="markers",
                    name=f"Linie {int(level)} kV - {label}",
                    legendgroup=legend_group,
                    showlegend=False,
                    hovertemplate="%{text}<extra></extra>",
                    text=hover_text,
                    marker=dict(size=max(_line_width(level) * 2.5, 8), color=color, opacity=0.25),
                )
            )
            trace_meta.append({"kind": "line", "voltage": level})

    return traces, trace_meta


def _trafo_traces(
    net: pp.pandapowerNet,
    positions: dict[int, tuple[float, float]],
) -> tuple[list[go.Scatter], list[dict[str, object]]]:
    traces: list[go.Scatter] = []
    trace_meta: list[dict[str, object]] = []
    bins = [
        ("0-40%", 0.0, 40.0, "#90CAF9"),
        ("40-70%", 40.0, 70.0, "#26A69A"),
        ("70-100%", 70.0, 100.0, "#FFB300"),
        (">100%", 100.0, float("inf"), "#C62828"),
    ]
    has_results = not net.res_trafo.empty

    # Grupujemy trafo po napięciu strony LV — decyduje o tym do jakiego
    # poziomu napięcia "należy" trafo przy filtrowaniu.
    # Trafo 400/220 kV → lv_level=220 → zostaje przy filtrze "Bez 110 kV".
    # Trafo 400/110 kV → lv_level=110 → znika przy filtrze "Bez 110 kV".
    lv_levels = sorted(net.trafo["vn_lv_kv"].dropna().unique().tolist(), reverse=True)

    for lv_level in lv_levels:
        lv_rows = net.trafo.index[net.trafo["vn_lv_kv"] == lv_level]
        legend_group = f"transformatory-{int(lv_level)}"

        for bin_idx, (label, lower, upper, color) in enumerate(bins):
            line_x: list[float | None] = []
            line_y: list[float | None] = []
            mid_x: list[float] = []
            mid_y: list[float] = []
            hover_text: list[str] = []

            for trafo_idx in lv_rows:
                row = net.trafo.loc[trafo_idx]
                loading = float(net.res_trafo.at[trafo_idx, "loading_percent"]) if has_results else 0.0
                if loading < lower or loading >= upper:
                    continue

                x1, y1 = positions[row.hv_bus]
                x2, y2 = positions[row.lv_bus]
                line_x.extend([x1, x2, None])
                line_y.extend([y1, y2, None])
                mid_x.append((x1 + x2) / 2)
                mid_y.append((y1 + y2) / 2)

                details = [
                    f"<b>{row['name']}</b>",
                    f"Trafo {row['vn_hv_kv']:.0f}/{row['vn_lv_kv']:.0f} kV",
                    f"Moc znamionowa: {row['sn_mva']:.0f} MVA",
                ]
                if has_results:
                    details.append(f"Obciążenie: {loading:.1f}%")
                    details.append(f"P po stronie HV: {net.res_trafo.at[trafo_idx, 'p_hv_mw']:.1f} MW")
                hover_text.append("<br>".join(details))

            if not line_x:
                continue

            traces.append(
                go.Scatter(
                    x=line_x,
                    y=line_y,
                    mode="lines",
                    name=f"Trafo /{int(lv_level)} kV",
                    legendgroup=legend_group,
                    showlegend=bin_idx == 0,
                    hoverinfo="skip",
                    line=dict(color=color, width=2.2, dash="dot"),
                )
            )
            trace_meta.append({"kind": "trafo", "voltage": lv_level})

            traces.append(
                go.Scatter(
                    x=mid_x,
                    y=mid_y,
                    mode="markers",
                    name=f"Trafo /{int(lv_level)} kV - {label}",
                    legendgroup=legend_group,
                    showlegend=False,
                    hovertemplate="%{text}<extra></extra>",
                    text=hover_text,
                    marker=dict(size=9, color=color, opacity=0.35, symbol="diamond"),
                )
            )
            trace_meta.append({"kind": "trafo", "voltage": lv_level})

    return traces, trace_meta


def _bus_traces(
    net: pp.pandapowerNet,
    positions: dict[int, tuple[float, float]],
) -> tuple[list[go.Scatter], list[dict[str, object]]]:
    traces: list[go.Scatter] = []
    trace_meta: list[dict[str, object]] = []
    levels = sorted({float(v) for v in net.bus.vn_kv.dropna().tolist() if v > 0})
    has_results = not net.res_bus.empty

    for idx, level in enumerate(levels):
        bus_indices = net.bus.index[net.bus.vn_kv == level]
        x: list[float] = []
        y: list[float] = []
        text: list[str] = []
        color_values: list[float] = []

        for bus_idx in bus_indices:
            row = net.bus.loc[bus_idx]
            bus_x, bus_y = positions[bus_idx]
            x.append(bus_x)
            y.append(bus_y)
            color_values.append(float(net.res_bus.at[bus_idx, "vm_pu"]) if has_results else 1.0)

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
            text.append("<br>".join(details))

        traces.append(
            go.Scatter(
                x=x,
                y=y,
                mode="markers",
                name=f"Szyny {int(level)} kV",
                legendgroup=f"szyny-{int(level)}",
                showlegend=True,
                hovertemplate="%{text}<extra></extra>",
                text=text,
                marker=dict(
                    size=_bus_size(level),
                    color=color_values,
                    colorscale="Turbo",
                    cmin=0.9,
                    cmax=1.1,
                    showscale=idx == 0 and has_results,
                    colorbar=dict(
                        title=dict(text="Um [p.u.]", font=dict(color="#e6edf3")),
                        tickfont=dict(color="#e6edf3"),
                        bgcolor="rgba(22,27,34,0.7)",
                        bordercolor="#30363d",
                        borderwidth=1,
                        outlinewidth=0,
                        thickness=14,
                        len=0.6,
                        x=1.0,
                    ),
                    line=dict(color="#0e1116", width=1.0),
                ),
            )
        )
        trace_meta.append({"kind": "bus", "voltage": level})

    return traces, trace_meta


def _line_width(voltage_kv: float) -> float:
    if voltage_kv >= 400:
        return 3.6
    if voltage_kv >= 220:
        return 2.6
    if voltage_kv >= 110:
        return 1.7
    return 1.2


def _bus_size(voltage_kv: float) -> float:
    if voltage_kv >= 400:
        return 14
    if voltage_kv >= 220:
        return 12
    if voltage_kv >= 110:
        return 10
    return 8
