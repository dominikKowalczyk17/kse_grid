"""Cienki entrypoint dashboardu Dash — montaż kontekstu, layoutu i callbacków."""

from __future__ import annotations

import webbrowser
from pathlib import Path
from threading import Timer

import dash
import pandapower as pp

from kse_grid.plotting import _compute_stats
from kse_grid.ui.callbacks import register_callbacks
from kse_grid.ui.context import build_dash_context
from kse_grid.ui.layout import build_app_layout
from kse_grid.ui.theme import COLORS


def create_dash_app(net: pp.pandapowerNet) -> dash.Dash:
    """Tworzy aplikację Dash dla danej sieci pandapower."""
    context = build_dash_context(net, accent_color=COLORS["accent"])
    stats = _compute_stats(net)

    app = dash.Dash(
        __name__,
        assets_folder=str(Path(__file__).parent / "assets"),
        title=f"{context.net_name} – KSE Grid",
        suppress_callback_exceptions=True,
        update_title=None,
    )
    app.layout = build_app_layout(context, stats)
    register_callbacks(app, context)
    return app


def serve_dash_app(
    net: pp.pandapowerNet,
    host: str = "127.0.0.1",
    port: int = 8050,
    auto_open: bool = True,
    debug: bool = False,
) -> None:
    """Uruchamia serwer Dash i opcjonalnie otwiera przeglądarkę."""
    app = create_dash_app(net)
    if auto_open:
        Timer(1.5, lambda: webbrowser.open(f"http://{host}:{port}/")).start()
    app.run(host=host, port=port, debug=debug)
