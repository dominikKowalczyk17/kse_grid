"""Serwer FastAPI: REST API + statyczny frontend Vue."""

from __future__ import annotations

import webbrowser
from pathlib import Path
from threading import Timer

import pandapower as pp
import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from kse_grid.switching import SwitchingSession


_WEB_DIR = Path(__file__).parent / "web"


class SwitchStateUpdate(BaseModel):
    """Payload PATCH dla pojedynczego switcha."""

    closed: bool


def create_app(net: pp.pandapowerNet) -> FastAPI:
    """Tworzy aplikację FastAPI dla danej sieci."""
    session = SwitchingSession(net)
    payload = session.build_payload()
    app = FastAPI(title=f"{payload['name']} – KSE Grid", docs_url=None, redoc_url=None)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_methods=["GET", "PATCH", "POST"],
        allow_headers=["Content-Type"],
    )

    @app.get("/api/network")
    def get_network() -> JSONResponse:
        return JSONResponse(session.build_payload())

    @app.patch("/api/switches/{switch_id}")
    def patch_switch(switch_id: int, update: SwitchStateUpdate) -> JSONResponse:
        try:
            payload = session.set_switch_state(switch_id, update.closed)
        except KeyError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc
        return JSONResponse(payload)

    @app.post("/api/topology/reset")
    def reset_topology() -> JSONResponse:
        return JSONResponse(session.reset())

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
