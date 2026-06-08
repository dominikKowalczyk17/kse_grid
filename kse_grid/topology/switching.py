"""Backend layer for switch control and interactive load flow recalculation."""

from __future__ import annotations

from copy import deepcopy
from typing import Any, Callable

import pandapower as pp
import pandas as pd

from kse_grid.loading.matpower_importer import seed_operational_switches
from kse_grid.powerflow.engine import load_powerflow_options
from kse_grid.powerflow.island_powerflow import run_island_powerflow
from kse_grid.serialization.graph_layout import recompute_graph_positions
from kse_grid.serialization.serializer import (
    compute_graph_positions,
    serialize_network,
    serialize_topology_update,
)
from kse_grid.topology.element_editing import (
    apply_element_update,
    create_element_in_net,
    field_schema,
    read_element_params,
    validate_creation_fields,
)

_BRANCH_KINDS: frozenset[str] = frozenset({"line", "trafo"})


class SwitchingSession:
    """
    Holds the working network state for interactive switching operations.

    Working model:
    - ``base_net`` stores the baseline state after import and the first load flow.
    - ``working_net`` is a mutable copy on which topology and parameter changes are staged.
    - Load flow runs only on explicit user request.

    This means the API never mutates the single network instance in place.
    Every operation works on a copy; only after a successful calculation is the result
    published as the new ``working_net``. This simplifies debugging and protects against
    leaving a partially-modified object after an exception.
    """

    def __init__(self, net: pp.pandapowerNet):
        # Keep the base separately so that a topology reset is a cheap deepcopy.
        self.base_net = deepcopy(net)

        # This instance lives under the API and accumulates switch/parameter changes.
        self.working_net = deepcopy(net)

        # Graph layout is computed once for the base network and reused thereafter.
        # This prevents node positions from "dancing" after each switch operation and
        # avoids running the expensive spring layout on every API call.
        self._graph_positions = compute_graph_positions(self.base_net)

        # Preserve custom power flow parameters from the initial run for subsequent recalcs.
        self._powerflow_options = load_powerflow_options(net)

        self._last_run_succeeded: bool | None = _has_results(self.working_net)
        self._last_run_message: str | None = None
        self._pending_recalc = False
        self._pending_change_count = 0

        if net.bus.empty:
            self._last_run_succeeded = None
            self._last_run_message = "No buses — cannot run load flow."
        elif not self._last_run_succeeded:
            self._recalculate_in_place(self.working_net)

    def build_payload(self) -> dict[str, Any]:
        """Return the full network payload with session state injected."""
        payload = serialize_network(self.working_net, graph_positions=self._graph_positions)
        self._inject_session_state(payload["topology"])
        return payload

    def get_element_params(self, kind: str, element_id: int) -> dict[str, Any]:
        """Return current element parameters in edit-ready form."""
        return read_element_params(self.working_net, kind, element_id)

    def update_element(
        self,
        kind: str,
        element_id: int,
        fields: dict[str, Any],
    ) -> dict[str, Any]:
        """Stage an element parameter update and mark load flow as pending.

        The returned payload includes a ``changedElement`` field with the full
        re-serialisation of the modified element, allowing the frontend to patch
        the existing network state without losing manual layout edits.
        """
        update = self._stage_change(
            lambda net: apply_element_update(net, kind, element_id, fields),
            pending_message=f"Updated parameters of {kind} #{element_id}.",
            changed_element=(kind, element_id),
        )
        update["changedElementParams"] = read_element_params(self.working_net, kind, element_id)
        return update

    def create_element(self, kind: str, fields: dict[str, Any]) -> dict[str, Any]:
        """Create a new element in the working network and stage a load flow recalculation.

        Returns a dict with ``newElementId`` (int) and ``topologyUpdate`` (slim payload
        augmented with updated graph positions).
        Raises ``ValueError`` if required fields are missing or values are invalid.
        """
        validate_creation_fields(kind, fields)
        new_id: list[int] = []

        def mutator(net: pp.pandapowerNet) -> None:
            new_id.append(create_element_in_net(net, kind, fields))
            if kind in _BRANCH_KINDS:
                seed_operational_switches(net)

        topology_update = self._stage_change(mutator, pending_message=f"Added new element {kind}.")
        self._commit_topology_to_base()
        self._graph_positions = recompute_graph_positions(self.working_net)
        topology_update["positions"] = {str(k): list(v) for k, v in self._graph_positions.items()}
        return {"newElementId": new_id[0], "topologyUpdate": topology_update}

    @staticmethod
    def field_schema() -> dict[str, list[dict[str, Any]]]:
        """Return the editable field schema for all element types."""
        return field_schema()

    def build_update_payload(
        self,
        *,
        changed_element: tuple[str, int] | None = None,
    ) -> dict[str, Any]:
        """Return a slim update payload after a switch toggle or recalculation.

        The payload omits layout fields so the frontend can inject it into the
        existing network state without discarding manual node positions or line breakpoints.
        """
        payload = serialize_topology_update(self.working_net, changed_element=changed_element)
        self._inject_session_state(payload["topology"])
        return payload

    def _inject_session_state(self, topology: dict[str, Any]) -> None:
        topology["lastRunSucceeded"] = self._last_run_succeeded
        topology["lastRunMessage"] = self._last_run_message
        topology["powerflowOptions"] = dict(self._powerflow_options)
        topology["pendingRecalc"] = self._pending_recalc
        topology["pendingChangeCount"] = self._pending_change_count

    def set_switch_state(self, switch_id: int, closed: bool) -> dict[str, Any]:
        """Set the state of a single switch and mark load flow as pending."""
        return self._stage_change(
            lambda net: _set_switch_state(net, switch_id=switch_id, closed=closed),
            pending_message=f"Set switch #{switch_id} to {'closed' if closed else 'open'}.",
        )

    def recalculate(self) -> dict[str, Any]:
        """Run load flow on the current working network state."""
        candidate = deepcopy(self.working_net)
        self._recalculate_in_place(candidate)
        self.working_net = candidate
        if self._last_run_succeeded:
            self._pending_recalc = False
            self._pending_change_count = 0
            self._last_run_message = "Power flow recalculated for the current network state."
        else:
            self._pending_recalc = True
        return self.build_update_payload()

    def reset(self) -> dict[str, Any]:
        """Restore the working network to the base state and return a fresh payload."""
        self.working_net = deepcopy(self.base_net)
        self._recalculate_in_place(self.working_net)
        self._pending_recalc = False
        self._pending_change_count = 0
        self._last_run_message = "Topology restored to baseline state."
        return self.build_payload()

    def _stage_change(
        self,
        mutator: Callable[[pp.pandapowerNet], None],
        *,
        pending_message: str,
        changed_element: tuple[str, int] | None = None,
    ) -> dict[str, Any]:
        # Apply every mutation to a copy of the working network. If the mutator
        # raises, the original working_net remains untouched.
        candidate = deepcopy(self.working_net)
        mutator(candidate)
        _clear_results(candidate)
        self.working_net = candidate
        self._pending_recalc = True
        self._pending_change_count += 1
        self._last_run_succeeded = None
        self._last_run_message = (
            f"{pending_message} Changes are pending — run power flow to update results."
        )
        return self.build_update_payload(changed_element=changed_element)

    def _recalculate_in_place(self, net: pp.pandapowerNet) -> None:
        if net.bus.empty:
            self._last_run_succeeded = None
            self._last_run_message = "No buses — cannot run load flow."
            return
        _clear_results(net)
        opts = self._powerflow_options
        island_results = run_island_powerflow(
            net,
            algorithm=str(opts["algorithm"]),
            max_iteration=int(opts["max_iteration"]),
            tolerance_mva=float(opts["tolerance_mva"]),
        )
        net._island_pf_results = island_results

        energized = [r for r in island_results if r.status != "unsupplied"]
        failed = [r for r in energized if not r.converged]

        if not island_results:
            net.converged = False
            self._last_run_succeeded = False
            self._last_run_message = "No islands to calculate."
        elif not energized:
            net.converged = False
            self._last_run_succeeded = False
            self._last_run_message = (
                "No voltage source in the network — add an ext_grid to a bus, "
                "then recalculate power flow."
            )
        elif failed:
            net.converged = False
            self._last_run_succeeded = False
            msgs = "; ".join(r.message for r in failed if r.message)
            self._last_run_message = (
                f"No convergence in {len(failed)} island(s). {msgs}"
            )
        else:
            net.converged = True
            self._last_run_succeeded = True
            self._last_run_message = None


    def _commit_topology_to_base(self) -> None:
        """Promote current working topology to base so Reset reverts only switch changes."""
        self.base_net = deepcopy(self.working_net)
        _clear_results(self.base_net)

    def delete_element(self, kind: str, element_id: int) -> dict[str, Any]:
        """Remove an element from the working network and stage a load flow recalculation.

        Raises ``KeyError`` if the element does not exist.
        """
        _check_element_exists(self.working_net, kind, element_id)

        def mutator(net: pp.pandapowerNet) -> None:
            _delete_from_net(net, kind, element_id)

        topology_update = self._stage_change(
            mutator, pending_message=f"Deleted {kind} #{element_id}."
        )
        self._commit_topology_to_base()
        self._graph_positions = recompute_graph_positions(self.working_net)
        topology_update["positions"] = {str(k): list(v) for k, v in self._graph_positions.items()}
        return {"deletedElement": {"kind": kind, "id": element_id}, "topologyUpdate": topology_update}


def _check_element_exists(net: pp.pandapowerNet, kind: str, element_id: int) -> None:
    table = getattr(net, kind, None)
    if table is None or element_id not in table.index:
        raise KeyError(f"{kind} #{element_id} does not exist.")


def _delete_from_net(net: pp.pandapowerNet, kind: str, element_id: int) -> None:
    if kind == "bus":
        pp.drop_buses(net, buses=[element_id])
        return
    if kind in {"line", "trafo"}:
        et = "l" if kind == "line" else "t"
        mask = (net.switch["element"].astype(int) == element_id) & (net.switch["et"] == et)
        net.switch.drop(net.switch.index[mask], inplace=True)
    getattr(net, kind).drop(element_id, inplace=True)


def _has_results(net: pp.pandapowerNet) -> bool:
    return hasattr(net, "res_bus") and not net.res_bus.empty


def _clear_results(net: pp.pandapowerNet) -> None:
    """Clear all result tables (``res_*``).

    Critical after a failed ``runpp()``: without clearing, the network would retain
    stale results from the previous topology state, causing the frontend to display
    data inconsistent with the current switch configuration.
    """
    for key in list(net.keys()):
        if not key.startswith("res_"):
            continue
        table = net[key]
        if isinstance(table, pd.DataFrame):
            net[key] = table.iloc[0:0].copy()
    if "_ppc" in net:
        net["_ppc"] = None


def _set_switch_state(net: pp.pandapowerNet, *, switch_id: int, closed: bool) -> None:
    """Set ``closed`` for a specific switch or raise a readable error."""
    if switch_id not in net.switch.index:
        raise KeyError(f"Switch #{switch_id} does not exist.")
    net.switch.at[switch_id, "closed"] = bool(closed)
