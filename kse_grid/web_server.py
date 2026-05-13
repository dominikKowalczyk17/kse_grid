"""Serwer FastAPI: REST API + statyczny frontend Vue."""

from __future__ import annotations

import tempfile
import traceback
import webbrowser
from pathlib import Path
from threading import Lock, Timer

import pandapower as pp
import uvicorn
from fastapi import FastAPI, File, HTTPException, Request, UploadFile
from fastapi.exceptions import RequestValidationError
from pydantic import BaseModel, Field
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from kse_grid.matpower import load_matpower_case
from kse_grid.runner import PowerFlowRunner
from kse_grid.switching import SwitchingSession


_WEB_DIR = Path(__file__).parent / "web"
_MAX_UPLOAD_BYTES = 32 * 1024 * 1024  # 32 MiB


class SwitchStateUpdate(BaseModel):
    """Payload PATCH dla pojedynczego switcha."""

    closed: bool


class ElementUpdate(BaseModel):
    """Payload PATCH dla edycji parametrów elementu sieci."""

    fields: dict[str, object] = Field(default_factory=dict)


_ELEMENT_KINDS = {"bus", "line", "trafo", "switch"}


def create_app(net: pp.pandapowerNet) -> FastAPI:
    """Tworzy aplikację FastAPI dla danej sieci."""
    state: dict[str, SwitchingSession] = {"session": SwitchingSession(net)}
    state_lock = Lock()
    payload = state["session"].build_payload()
    app = FastAPI(title=f"{payload['name']} – KSE Grid", docs_url=None, redoc_url=None)

    def current_session() -> SwitchingSession:
        return state["session"]

    @app.exception_handler(RequestValidationError)
    async def handle_validation_error(
        request: Request,
        exc: RequestValidationError,
    ) -> JSONResponse:
        detail = (
            f"Request validation failed for {request.method} {request.url.path}\n"
            f"{exc}\n\n"
            f"{exc.errors()}"
        )
        return JSONResponse(status_code=422, content={"detail": detail})

    @app.exception_handler(Exception)
    async def handle_unexpected_exception(
        request: Request,
        exc: Exception,
    ) -> JSONResponse:
        detail = (
            f"Unhandled server exception during {request.method} {request.url.path}\n\n"
            + "".join(traceback.format_exception(type(exc), exc, exc.__traceback__))
        )
        return JSONResponse(status_code=500, content={"detail": detail})

    @app.get("/api/network")
    def get_network() -> JSONResponse:
        return JSONResponse(current_session().build_payload())

    @app.patch("/api/switches/{switch_id}")
    def patch_switch(switch_id: int, update: SwitchStateUpdate) -> JSONResponse:
        try:
            payload = current_session().set_switch_state(switch_id, update.closed)
        except KeyError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc
        return JSONResponse(payload)

    @app.post("/api/topology/reset")
    def reset_topology() -> JSONResponse:
        return JSONResponse(current_session().reset())

    @app.post("/api/powerflow/recalculate")
    def recalculate_powerflow() -> JSONResponse:
        return JSONResponse(current_session().recalculate())

    @app.get("/api/elements/schema")
    def get_element_schema() -> JSONResponse:
        return JSONResponse(SwitchingSession.field_schema())

    @app.get("/api/elements/{kind}/{element_id}")
    def get_element_params(kind: str, element_id: int) -> JSONResponse:
        if kind not in _ELEMENT_KINDS:
            raise HTTPException(status_code=404, detail=f"Nieznany typ elementu: {kind}.")
        try:
            params = current_session().get_element_params(kind, element_id)
        except KeyError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc
        return JSONResponse({"kind": kind, "id": element_id, "params": params})

    @app.patch("/api/elements/{kind}/{element_id}")
    def patch_element(kind: str, element_id: int, update: ElementUpdate) -> JSONResponse:
        if kind not in _ELEMENT_KINDS:
            raise HTTPException(status_code=404, detail=f"Nieznany typ elementu: {kind}.")
        try:
            payload = current_session().update_element(kind, element_id, update.fields)
        except KeyError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        return JSONResponse(payload)

    @app.post("/api/network/upload")
    async def upload_network(file: UploadFile = File(...)) -> JSONResponse:
        filename = file.filename or "uploaded.m"
        if not filename.lower().endswith(".m"):
            raise HTTPException(status_code=400, detail="Oczekiwano pliku MATPOWER (.m).")

        contents = await file.read(_MAX_UPLOAD_BYTES + 1)
        if len(contents) > _MAX_UPLOAD_BYTES:
            raise HTTPException(status_code=413, detail="Plik przekracza limit 32 MiB.")
        if not contents:
            raise HTTPException(status_code=400, detail="Pusty plik.")

        suffix = ".m"
        stem = Path(filename).stem or "uploaded"
        with tempfile.NamedTemporaryFile(
            "wb", suffix=suffix, prefix=f"{stem}_", delete=False
        ) as handle:
            handle.write(contents)
            temp_path = Path(handle.name)

        try:
            new_net = load_matpower_case(temp_path)
            new_net.name = stem
            PowerFlowRunner(new_net).run()
        except HTTPException:
            raise
        except Exception as exc:
            raise HTTPException(
                status_code=400, detail=f"Nie udało się załadować pliku: {exc}"
            ) from exc
        finally:
            temp_path.unlink(missing_ok=True)

        with state_lock:
            state["session"] = SwitchingSession(new_net)
            payload = state["session"].build_payload()
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
