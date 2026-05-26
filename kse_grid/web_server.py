"""Serwer FastAPI: REST API + statyczny frontend Vue."""

from __future__ import annotations

import tempfile
import traceback
import webbrowser
from pathlib import Path
from threading import Lock, Timer

import pandapower as pp
import uvicorn
from fastapi import FastAPI, File, HTTPException, Query, Request, UploadFile
from fastapi.exceptions import RequestValidationError
from pydantic import BaseModel, Field
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from kse_grid.loading.json_loader import detect_format, load_pandapower_json
from kse_grid.loading.matpower import load_matpower_case, load_geo_sidecar
from kse_grid.powerflow.runner import PowerFlowRunner
from kse_grid.topology.matpower_params import (
    MATPOWER_SCHEMA,
    convert_branch,
    convert_bus,
    convert_gen,
)
from kse_grid.topology.switching import SwitchingSession


_WEB_DIR = Path(__file__).parent / "web"
_DATA_DIR = Path(__file__).parent.parent / "data"
_MAX_UPLOAD_BYTES = 32 * 1024 * 1024  # 32 MiB


class SwitchStateUpdate(BaseModel):
    """Payload PATCH dla pojedynczego switcha."""

    closed: bool


class ElementUpdate(BaseModel):
    """Payload PATCH dla edycji parametrów elementu sieci."""

    fields: dict[str, object] = Field(default_factory=dict)


_ELEMENT_KINDS = {"bus", "line", "trafo", "switch", "gen", "load", "sgen", "ext_grid", "shunt"}
_CREATABLE_KINDS = {"bus", "load", "sgen", "ext_grid", "shunt", "line", "trafo", "gen"}


def _create_matpower(
    session: SwitchingSession,
    kind: str,
    fields: dict,
) -> dict:
    """Dispatch a matpower-format creation request.

    Returns {"created": [...], "topologyUpdate": {...}}.
    """
    _BRANCH_KINDS_MP = {"line", "trafo"}
    _GEN_KINDS_MP = {"gen"}

    if kind == "bus":
        ops = convert_bus(fields)
    elif kind in _BRANCH_KINDS_MP:
        # Derive baseKV from the from_bus / hv_bus voltage.
        ref_bus_key = "from_bus" if kind == "line" else "hv_bus"
        if ref_bus_key not in fields:
            raise ValueError(f"Brakuje wymaganego pola '{ref_bus_key}' (id szyny).")
        ref_bus_id = int(fields[ref_bus_key])
        if ref_bus_id not in session.working_net.bus.index:
            raise ValueError(f"Szyna o id {ref_bus_id} nie istnieje w sieci.")
        base_kv = float(session.working_net.bus.at[ref_bus_id, "vn_kv"])
        kind_out, converted = convert_branch(fields, base_kv=base_kv)
        result = session.create_element(kind_out, converted)
        return {
            "created": [{"kind": kind_out,
                          "newElementId": result["newElementId"]}],
            "topologyUpdate": result["topologyUpdate"],
        }
    elif kind in _GEN_KINDS_MP:
        kind_out, converted = convert_gen(fields)
        result = session.create_element(kind_out, converted)
        return {
            "created": [{"kind": kind_out,
                          "newElementId": result["newElementId"]}],
            "topologyUpdate": result["topologyUpdate"],
        }
    else:
        raise ValueError(f"Matpower format not supported for {kind!r}.")

    # Bus path: create bus first, then dependent elements.
    created: list[dict] = []
    topology_update: dict = {}
    bus_id: int | None = None

    for op_kind, op_fields in ops:
        if op_kind != "bus" and bus_id is not None and op_fields.get("bus") is None:
            op_fields = {**op_fields, "bus": bus_id}
        result = session.create_element(op_kind, op_fields)
        created.append({"kind": op_kind, "newElementId": result["newElementId"]})
        topology_update = result["topologyUpdate"]
        if op_kind == "bus":
            bus_id = result["newElementId"]

    return {"created": created, "topologyUpdate": topology_update}


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
        tb = (
            f"Validation error for {request.method} {request.url.path}\n\n"
            f"{exc}\n\n"
            f"{exc.errors()}"
        )
        return JSONResponse(status_code=422, content={
            "detail": "Nieprawidłowe dane wejściowe żądania.",
            "traceback": tb,
        })

    @app.exception_handler(Exception)
    async def handle_unexpected_exception(
        request: Request,
        exc: Exception,
    ) -> JSONResponse:
        tb = (
            f"Unhandled exception during {request.method} {request.url.path}\n\n"
            + "".join(traceback.format_exception(type(exc), exc, exc.__traceback__))
        )
        return JSONResponse(status_code=500, content={
            "detail": "Nieoczekiwany błąd serwera. Operacja nie została wykonana.",
            "traceback": tb,
        })

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

    @app.get("/api/elements/create-schema")
    def get_create_schema() -> JSONResponse:
        from kse_grid.topology.element_editing import field_schema
        return JSONResponse({
            "pandapower": field_schema(),
            "matpower": MATPOWER_SCHEMA,
        })

    @app.delete("/api/elements/{kind}/{element_id}")
    def delete_element(kind: str, element_id: int) -> JSONResponse:
        if kind not in _ELEMENT_KINDS:
            raise HTTPException(status_code=404, detail=f"Nieznany typ elementu: {kind}.")
        try:
            result = current_session().delete_element(kind, element_id)
        except KeyError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc
        return JSONResponse(result)

    @app.post("/api/elements/{kind}", status_code=201)
    def create_element(
        kind: str,
        update: ElementUpdate,
        fmt: str = Query(default="pandapower", alias="format"),
    ) -> JSONResponse:
        if kind not in _CREATABLE_KINDS:
            raise HTTPException(
                status_code=404,
                detail=f"Tworzenie elementu {kind!r} nie jest obsługiwane.",
            )
        try:
            if fmt == "matpower":
                result = _create_matpower(current_session(), kind, update.fields)
            else:
                result = current_session().create_element(kind, update.fields)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        except KeyError as exc:
            raise HTTPException(
                status_code=400,
                detail=f"Brakuje wymaganego pola {exc} w danych elementu {kind!r}.",
            ) from exc
        return JSONResponse(result, status_code=201)

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
        filename = file.filename or "uploaded"
        contents = await file.read(_MAX_UPLOAD_BYTES + 1)
        if len(contents) > _MAX_UPLOAD_BYTES:
            raise HTTPException(status_code=413, detail="Plik przekracza limit 32 MiB.")
        if not contents:
            raise HTTPException(status_code=400, detail="Pusty plik.")

        try:
            fmt = detect_format(contents, filename)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

        stem = Path(filename).stem or "uploaded"
        try:
            if fmt == "pandapower_json":
                new_net = load_pandapower_json(contents)
                new_net.name = stem
                try:
                    PowerFlowRunner(new_net).run()
                except Exception:
                    pass  # session handles recalc; upload should not fail
            else:
                with tempfile.NamedTemporaryFile(
                    "wb", suffix=".m", prefix=f"{stem}_", delete=False
                ) as handle:
                    handle.write(contents)
                    temp_path = Path(handle.name)
                try:
                    new_net = load_matpower_case(temp_path)
                    new_net.name = stem
                    if not getattr(new_net, "_geo_source", None) and _DATA_DIR.is_dir():
                        load_geo_sidecar(new_net, _DATA_DIR / stem)
                    PowerFlowRunner(new_net).run()
                finally:
                    temp_path.unlink(missing_ok=True)
        except HTTPException:
            raise
        except Exception as exc:
            raise HTTPException(
                status_code=400, detail=f"Nie udało się załadować pliku: {exc}"
            ) from exc

        with state_lock:
            state["session"] = SwitchingSession(new_net)
            payload = state["session"].build_payload()
        return JSONResponse(payload)

    @app.get("/api/network/export/json")
    def export_json() -> JSONResponse:
        net = current_session().working_net
        json_str = pp.to_json(net)
        filename = f"{getattr(net, 'name', 'network') or 'network'}.json"
        from fastapi.responses import Response
        return Response(
            content=json_str.encode("utf-8"),
            media_type="application/json",
            headers={"Content-Disposition": f"attachment; filename={filename}"},
        )

    @app.get("/api/network/export/matpower")
    def export_matpower() -> JSONResponse:
        from fastapi.responses import Response
        from pandapower.converter.matpower import to_mpc
        import scipy.io as sio
        import io as _io
        net = current_session().working_net
        mpc = to_mpc(net).get("mpc", {})
        import numpy as np
        lines = ["function mpc = network",
                 f"mpc.baseMVA = {mpc.get('baseMVA', 100)};", ""]
        for table_name, data in mpc.items():
            if table_name == "baseMVA":
                continue
            try:
                arr = np.array(data)
                rows = "; ".join(" ".join(str(v) for v in row) for row in arr)
                lines.append(f"mpc.{table_name} = [{rows}];")
            except Exception:
                pass
        text = "\n".join(lines) + "\n"
        filename = f"{getattr(net, 'name', 'network') or 'network'}.m"
        return Response(
            content=text.encode("utf-8"),
            media_type="text/plain",
            headers={
                "Content-Disposition": f"attachment; filename={filename}",
                "X-Export-Note": (
                    "best-effort; pandapower-specific metadata not preserved"
                ),
            },
        )

    @app.post("/api/network/new")
    def new_network() -> JSONResponse:
        with state_lock:
            state["session"] = SwitchingSession(pp.create_empty_network(f_hz=50))
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
