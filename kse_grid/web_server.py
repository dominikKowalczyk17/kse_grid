"""Serwer FastAPI: REST API + statyczny frontend Vue."""

from __future__ import annotations

import webbrowser
from pathlib import Path
from threading import Timer

import pandapower as pp
import uvicorn
from fastapi import FastAPI
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from kse_grid.serializer import serialize_network


_WEB_DIR = Path(__file__).parent / "web"


def create_app(net: pp.pandapowerNet) -> FastAPI:
    """Tworzy aplikację FastAPI dla danej sieci."""
    payload = serialize_network(net)
    app = FastAPI(title=f"{payload['name']} – KSE Grid", docs_url=None, redoc_url=None)

    @app.get("/api/network")
    def get_network() -> JSONResponse:
        return JSONResponse(payload)

    @app.get("/")
    def index() -> FileResponse:
        return FileResponse(_WEB_DIR / "index.html")

    app.mount("/", StaticFiles(directory=_WEB_DIR, html=True), name="web")
    return app


def serve(
    net: pp.pandapowerNet,
    host: str = "127.0.0.1",
    port: int = 8050,
    auto_open: bool = True,
) -> None:
    """Uruchamia serwer i opcjonalnie otwiera przeglądarkę."""
    app = create_app(net)
    if auto_open:
        Timer(1.5, lambda: webbrowser.open(f"http://{host}:{port}/")).start()
    uvicorn.run(app, host=host, port=port, log_level="warning")
