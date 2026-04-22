import base64
import json
import mimetypes
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import webbrowser

import networkx as nx
import pandapower as pp
import plotly.graph_objects as go

type GeoBounds = tuple[float, float, float, float]


_DASHBOARD_TEMPLATE = """<!DOCTYPE html>
<html lang="pl">
<head>
<meta charset="utf-8">
<title>{title}</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@500&display=swap" rel="stylesheet">
<script src="https://cdn.plot.ly/plotly-2.35.2.min.js" charset="utf-8"></script>
<style>
  :root {{
    --bg: #0a0d12;
    --panel: #11161d;
    --panel-2: #161b22;
    --border: #2a313c;
    --border-strong: #3a4150;
    --text: #e6edf3;
    --text-dim: #8b95a4;
    --accent: #4ea1ff;
    --good: #3fb950;
    --warn: #d29922;
    --bad: #f85149;
  }}
  * {{ box-sizing: border-box; }}
  html, body {{ margin: 0; padding: 0; height: 100%; background: var(--bg);
    color: var(--text); font-family: 'Inter', system-ui, sans-serif; -webkit-font-smoothing: antialiased; }}
  .app {{ display: grid; grid-template-columns: 320px 1fr; grid-template-rows: 64px 1fr;
    height: 100vh; gap: 0; }}
  header {{ grid-column: 1 / -1; display: flex; align-items: center; justify-content: space-between;
    padding: 0 24px; background: linear-gradient(180deg, #11161d 0%, #0d1117 100%);
    border-bottom: 1px solid var(--border); }}
  header .brand {{ display: flex; align-items: center; gap: 12px; }}
  header .logo {{ width: 32px; height: 32px; border-radius: 8px;
    background: linear-gradient(135deg, #4ea1ff 0%, #a371f7 100%);
    display: flex; align-items: center; justify-content: center; font-weight: 700; color: #0a0d12; }}
  header h1 {{ margin: 0; font-size: 15px; font-weight: 600; letter-spacing: 0.2px; }}
  header h1 .sub {{ color: var(--text-dim); font-weight: 400; margin-left: 8px; }}
  header .meta {{ font-size: 12px; color: var(--text-dim); font-family: 'JetBrains Mono', monospace; }}
  aside {{ background: var(--panel); border-right: 1px solid var(--border);
    padding: 20px 18px; overflow-y: auto; }}
  aside h2 {{ font-size: 11px; text-transform: uppercase; letter-spacing: 1.2px;
    color: var(--text-dim); margin: 0 0 12px 0; font-weight: 600; }}
  .stat-grid {{ display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 24px; }}
  .stat {{ background: var(--panel-2); border: 1px solid var(--border); border-radius: 8px;
    padding: 10px 12px; }}
  .stat .label {{ font-size: 10px; text-transform: uppercase; color: var(--text-dim);
    letter-spacing: 0.8px; margin-bottom: 4px; }}
  .stat .value {{ font-size: 18px; font-weight: 600; font-family: 'JetBrains Mono', monospace; }}
  .stat.full {{ grid-column: 1 / -1; }}
  .stat.good .value {{ color: var(--good); }}
  .stat.warn .value {{ color: var(--warn); }}
  .stat.bad .value {{ color: var(--bad); }}
  .vlevels {{ display: flex; flex-direction: column; gap: 6px; margin-bottom: 24px; }}
  .vlevel {{ display: flex; justify-content: space-between; padding: 8px 12px;
    background: var(--panel-2); border: 1px solid var(--border); border-radius: 6px;
    font-size: 12px; }}
  .vlevel .kv {{ font-weight: 600; }}
  .vlevel .count {{ color: var(--text-dim); font-family: 'JetBrains Mono', monospace; }}
  .legend-card {{ background: var(--panel-2); border: 1px solid var(--border);
    border-radius: 8px; padding: 12px; font-size: 12px; }}
  .legend-row {{ display: flex; align-items: center; gap: 8px; margin: 4px 0; }}
  .legend-swatch {{ width: 18px; height: 4px; border-radius: 2px; }}
  .legend-dot {{ width: 10px; height: 10px; border-radius: 50%; }}
  main {{ padding: 16px; display: flex; flex-direction: column; min-width: 0; min-height: 0; }}
  .viewport {{ flex: 1; background: #0e1116; border: 1px solid var(--border-strong);
    border-radius: 12px; box-shadow: 0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px rgba(78,161,255,0.05);
    overflow: hidden; position: relative; min-height: 0; }}
  .viewport::before {{ content: ''; position: absolute; inset: 0; pointer-events: none;
    border-radius: 12px; box-shadow: inset 0 1px 0 rgba(255,255,255,0.04); }}
  #plot {{ width: 100%; height: 100%; }}
  footer {{ font-size: 11px; color: var(--text-dim); text-align: center; padding: 8px 0 0 0; }}
  ::-webkit-scrollbar {{ width: 8px; height: 8px; }}
  ::-webkit-scrollbar-track {{ background: var(--panel); }}
  ::-webkit-scrollbar-thumb {{ background: var(--border-strong); border-radius: 4px; }}
  /* Plotly updatemenu (filter buttons) overrides for dark theme */
  .updatemenu-button rect {{ fill: #161b22 !important; stroke: #30363d !important; }}
  .updatemenu-button text {{ fill: #e6edf3 !important; }}
  .updatemenu-button:hover rect {{ fill: #1f262f !important; stroke: #4ea1ff !important; }}
  .updatemenu-button.active rect, .updatemenu-button[data-active="true"] rect {{
    fill: #1f3a5f !important; stroke: #4ea1ff !important;
  }}
  .updatemenu-button.active text, .updatemenu-button[data-active="true"] text {{
    fill: #ffffff !important;
  }}
  .modebar-btn path {{ fill: #8b95a4 !important; }}
  .modebar-btn:hover path {{ fill: #e6edf3 !important; }}
  .modebar-btn.active path {{ fill: #4ea1ff !important; }}
</style>
</head>
<body>
<div class="app">
  <header>
    <div class="brand">
      <div class="logo">⚡</div>
      <h1>{net_name}<span class="sub">{layout_note}</span></h1>
    </div>
    <div class="meta">{meta_line}</div>
  </header>
  <aside>
    <h2>Podsumowanie</h2>
    <div class="stat-grid">
      <div class="stat"><div class="label">Szyny</div><div class="value">{n_bus}</div></div>
      <div class="stat"><div class="label">Linie</div><div class="value">{n_line}</div></div>
      <div class="stat"><div class="label">Trafo</div><div class="value">{n_trafo}</div></div>
      <div class="stat"><div class="label">Generatory</div><div class="value">{n_gen}</div></div>
      <div class="stat full {load_class}"><div class="label">Maks. obciążenie linii</div><div class="value">{max_loading}</div></div>
      <div class="stat {viol_class}"><div class="label">Naruszenia U</div><div class="value">{n_viol}</div></div>
      <div class="stat {ovl_class}"><div class="label">Przeciążenia</div><div class="value">{n_overload}</div></div>
    </div>
    <h2>Poziomy napięć</h2>
    <div class="vlevels">{vlevels_html}</div>
    <h2>Legenda obciążenia</h2>
    <div class="legend-card">
      <div class="legend-row"><div class="legend-swatch" style="background:#3fb950"></div>0 – 40%</div>
      <div class="legend-row"><div class="legend-swatch" style="background:#d29922"></div>40 – 70%</div>
      <div class="legend-row"><div class="legend-swatch" style="background:#fb8500"></div>70 – 100%</div>
      <div class="legend-row"><div class="legend-swatch" style="background:#f85149"></div>&gt; 100% (przeciążenie)</div>
    </div>
  </aside>
  <main>
    <div class="viewport"><div id="plot"></div></div>
    <footer>Pandapower • Plotly • dane: {data_source}</footer>
  </main>
</div>
<script>
  const figure = {fig_json};
  Plotly.newPlot('plot', figure.data, figure.layout, {{responsive: true, displaylogo: false, scrollZoom: true, modeBarButtonsToRemove: ['select2d', 'lasso2d', 'toImage']}});
  window.addEventListener('resize', () => Plotly.Plots.resize('plot'));
</script>
</body>
</html>
"""


def _compute_stats(net: pp.pandapowerNet) -> dict:
    has_res = not net.res_bus.empty
    n_bus = len(net.bus)
    n_line = len(net.line) if "line" in net else 0
    n_trafo = len(net.trafo) if "trafo" in net else 0
    n_gen = (len(net.gen) if "gen" in net else 0) + (len(net.ext_grid) if "ext_grid" in net else 0)

    max_loading = "—"
    n_overload = 0
    n_viol = 0
    load_class = ovl_class = viol_class = ""
    if has_res and not net.res_line.empty:
        ml = float(net.res_line["loading_percent"].max())
        max_loading = f"{ml:.1f}%"
        load_class = "bad" if ml > 100 else ("warn" if ml > 70 else "good")
        n_overload = int((net.res_line["loading_percent"] > 100).sum())
        if "res_trafo" in net and not net.res_trafo.empty:
            n_overload += int((net.res_trafo["loading_percent"] > 100).sum())
        ovl_class = "bad" if n_overload > 0 else "good"
    if has_res:
        vm = net.res_bus["vm_pu"]
        n_viol = int(((vm < 0.9) | (vm > 1.1)).sum())
        viol_class = "bad" if n_viol > 50 else ("warn" if n_viol > 0 else "good")

    levels = sorted(net.bus["vn_kv"].unique().tolist(), reverse=True)
    vlevels_html = "".join(
        f'<div class="vlevel"><span class="kv">{int(v)} kV</span>'
        f'<span class="count">{int((net.bus.vn_kv == v).sum())} szyn</span></div>'
        for v in levels
    )
    return dict(
        n_bus=n_bus, n_line=n_line, n_trafo=n_trafo, n_gen=n_gen,
        max_loading=max_loading, n_overload=n_overload, n_viol=n_viol,
        load_class=load_class, ovl_class=ovl_class, viol_class=viol_class,
        vlevels_html=vlevels_html,
    )


def render_dashboard_html(
    net: pp.pandapowerNet,
    background_image: str | Path | None = None,
    background_bounds: GeoBounds | None = None,
) -> str:
    """Buduje pełen dashboard HTML z opakowaniem viewportu i statystykami."""
    fig = build_interactive_figure(
        net,
        background_image=background_image,
        background_bounds=background_bounds,
    )
    _, has_real_geodata = _bus_positions(net)
    stats = _compute_stats(net)
    net_name = getattr(net, "name", None) or "Sieć elektroenergetyczna"
    layout_note = "" if has_real_geodata else " · układ poglądowy (brak geodanych)"
    meta_line = f"{stats['n_bus']} szyn  ·  {stats['n_line']} linii  ·  {stats['n_trafo']} trafo"
    return _DASHBOARD_TEMPLATE.format(
        title=f"{net_name} – KSE Grid",
        net_name=net_name,
        layout_note=layout_note,
        meta_line=meta_line,
        data_source=net_name or "user-provided",
        fig_json=fig.to_json(),
        **stats,
    )


def export_interactive_graph(
    net: pp.pandapowerNet,
    output_file: str | Path = "kse_grid_interactive.html",
    auto_open: bool = False,
    background_image: str | Path | None = None,
    background_bounds: GeoBounds | None = None,
) -> Path:
    """Eksportuje interaktywny graf sieci do pliku HTML."""
    output_path = Path(output_file).expanduser()
    html = render_dashboard_html(
        net,
        background_image=background_image,
        background_bounds=background_bounds,
    )
    output_path.write_text(html, encoding="utf-8")
    if auto_open:
        webbrowser.open(output_path.resolve().as_uri())
    return output_path.resolve()


def build_interactive_figure(
    net: pp.pandapowerNet,
    background_image: str | Path | None = None,
    background_bounds: GeoBounds | None = None,
) -> go.Figure:
    """Buduje figurę Plotly z filtrami napięć, linii i transformatorów."""
    positions, has_real_geodata = _bus_positions(net)
    traces, trace_meta = _build_traces(net, positions)

    fig = go.Figure(data=traces)
    fig.update_layout(
        template="plotly_dark",
        paper_bgcolor="#0e1116",
        plot_bgcolor="#0e1116",
        font=dict(family="Inter, system-ui, sans-serif", color="#e6edf3", size=12),
        hovermode="closest",
        dragmode="pan",
        autosize=True,
        legend=dict(
            orientation="h",
            yanchor="bottom", y=1.05,
            xanchor="left", x=0.0,
            bgcolor="rgba(22,27,34,0.85)",
            bordercolor="#30363d",
            borderwidth=1,
            font=dict(color="#e6edf3", size=11),
        ),
        margin=dict(l=12, r=12, t=56, b=12),
        hoverlabel=dict(
            bgcolor="#161b22",
            bordercolor="#30363d",
            font=dict(family="Inter, system-ui, sans-serif", color="#e6edf3", size=12),
        ),
    )
    _configure_axes(fig, positions, background_bounds)
    if background_image is not None and has_real_geodata:
        _add_background_image(
            fig,
            background_image=background_image,
            background_bounds=background_bounds or _auto_bounds(positions),
        )
    _add_filter_menu(fig, trace_meta)
    fig.update_xaxes(visible=False)
    fig.update_yaxes(visible=False, scaleanchor="x", scaleratio=1)
    return fig


def serve_interactive_graph(
    net: pp.pandapowerNet,
    host: str = "127.0.0.1",
    port: int = 8000,
    auto_open: bool = True,
    background_image: str | Path | None = None,
    background_bounds: GeoBounds | None = None,
) -> str:
    """Uruchamia lokalny serwer HTTP z interaktywnym grafem."""
    html = render_dashboard_html(
        net,
        background_image=background_image,
        background_bounds=background_bounds,
    )

    class GraphHandler(BaseHTTPRequestHandler):
        def do_GET(self):
            if self.path not in ("/", "/index.html"):
                self.send_error(404)
                return

            payload = html.encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)

        def log_message(self, format: str, *args):
            return

    ThreadingHTTPServer.allow_reuse_address = True
    server = ThreadingHTTPServer((host, port), GraphHandler)
    url = f"http://{host}:{port}/"
    if auto_open:
        webbrowser.open(url)

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        server.server_close()

    return url


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
    background_bounds: GeoBounds | None,
):
    bounds = background_bounds or _auto_bounds(positions)
    lon_min, lon_max, lat_min, lat_max = bounds
    fig.update_xaxes(range=[lon_min, lon_max])
    fig.update_yaxes(range=[lat_min, lat_max])


def _auto_bounds(positions: dict[int, tuple[float, float]], padding_ratio: float = 0.08) -> GeoBounds:
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


def _add_background_image(
    fig: go.Figure,
    background_image: str | Path,
    background_bounds: GeoBounds,
):
    lon_min, lon_max, lat_min, lat_max = background_bounds
    fig.add_layout_image(
        dict(
            source=_image_source(background_image),
            xref="x",
            yref="y",
            x=lon_min,
            y=lat_max,
            sizex=lon_max - lon_min,
            sizey=lat_max - lat_min,
            sizing="stretch",
            opacity=0.75,
            layer="below",
        )
    )


def _image_source(background_image: str | Path) -> str:
    image_path = Path(background_image).expanduser()
    if image_path.exists():
        mime_type, _ = mimetypes.guess_type(image_path.name)
        if mime_type is None or not mime_type.startswith("image/"):
            raise ValueError(f"Nieobsługiwany typ pliku obrazu: {image_path}")
        encoded = base64.b64encode(image_path.read_bytes()).decode("ascii")
        return f"data:{mime_type};base64,{encoded}"

    image_url = str(background_image)
    if image_url.startswith(("http://", "https://", "data:")):
        return image_url

    raise FileNotFoundError(f"Nie znaleziono obrazu tła: {background_image}")


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

    for bin_idx, (label, lower, upper, color) in enumerate(bins):
        line_x: list[float | None] = []
        line_y: list[float | None] = []
        mid_x: list[float] = []
        mid_y: list[float] = []
        hover_text: list[str] = []
        min_voltage = 9999.0

        for trafo_idx, row in net.trafo.iterrows():
            loading = float(net.res_trafo.at[trafo_idx, "loading_percent"]) if has_results else 0.0
            if loading < lower or loading >= upper:
                continue

            x1, y1 = positions[row.hv_bus]
            x2, y2 = positions[row.lv_bus]
            line_x.extend([x1, x2, None])
            line_y.extend([y1, y2, None])
            mid_x.append((x1 + x2) / 2)
            mid_y.append((y1 + y2) / 2)
            min_voltage = min(min_voltage, float(min(row.vn_hv_kv, row.vn_lv_kv)))

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
                name="Transformatory",
                legendgroup="transformatory",
                showlegend=bin_idx == 0,
                hoverinfo="skip",
                line=dict(color=color, width=2.2, dash="dot"),
            )
        )
        trace_meta.append({"kind": "trafo", "voltage": min_voltage})

        traces.append(
            go.Scatter(
                x=mid_x,
                y=mid_y,
                mode="markers",
                name=f"Transformatory - {label}",
                legendgroup="transformatory",
                showlegend=False,
                hovertemplate="%{text}<extra></extra>",
                text=hover_text,
                marker=dict(size=9, color=color, opacity=0.35, symbol="diamond"),
            )
        )
        trace_meta.append({"kind": "trafo", "voltage": min_voltage})

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


def _add_filter_menu(fig: go.Figure, trace_meta: list[dict[str, object]]):
    def selector(kind: str | None = None, min_voltage: float | None = None) -> list[bool]:
        visible: list[bool] = []
        for meta in trace_meta:
            meta_kind = str(meta["kind"])
            meta_voltage = float(meta["voltage"])
            is_visible = True
            if kind is not None and meta_kind != kind:
                is_visible = False
            if min_voltage is not None and meta_voltage < min_voltage:
                is_visible = False
            visible.append(is_visible)
        return visible

    fig.update_layout(
        updatemenus=[
            dict(
                type="buttons",
                direction="right",
                x=0.0,
                y=1.13,
                xanchor="left",
                yanchor="bottom",
                showactive=True,
                bgcolor="#161b22",
                bordercolor="#30363d",
                borderwidth=1,
                font=dict(color="#e6edf3", size=11, family="Inter, system-ui, sans-serif"),
                pad=dict(l=8, r=8, t=4, b=4),
                buttons=[
                    dict(label="Wszystko", method="update", args=[{"visible": selector()}]),
                    dict(label="Bez 110 kV", method="update", args=[{"visible": selector(min_voltage=220.0)}]),
                    dict(label="Tylko 400 kV", method="update", args=[{"visible": selector(min_voltage=400.0)}]),
                    dict(label="Tylko transformatory", method="update", args=[{"visible": selector(kind='trafo')}]),
                ],
            )
        ]
    )


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
        return 10
    if voltage_kv >= 220:
        return 8
    if voltage_kv >= 110:
        return 6
    return 5
