"""Warstwa backendowa do sterowania switchami i przeliczania topologii."""

from __future__ import annotations

from copy import deepcopy
from typing import Any, Callable

import pandas as pd
import pandapower as pp
import pandapower.auxiliary as pp_aux

from kse_grid.element_editing import (
    apply_element_update,
    field_schema,
    read_element_params,
)
from kse_grid.serializer import (
    compute_graph_positions,
    serialize_network,
    serialize_topology_update,
)


_DEFAULT_POWERFLOW_OPTIONS = {
    "algorithm": "nr",
    "max_iteration": 100,
    "tolerance_mva": 1.5,
}


class SwitchingSession:
    """
    Trzyma stan roboczy sieci dla interaktywnych operacji łączeniowych.

    Model pracy jest prosty:
    - `base_net` przechowuje stan bazowy po imporcie i pierwszym load flow,
    - `working_net` jest kopią roboczą, na której otwieramy / zamykamy switche,
    - po każdej zmianie topologii robimy nowy `runpp()` i budujemy świeży payload.

    Dzięki temu API nie mutuje bezpośrednio jedynego egzemplarza sieci "w miejscu".
    Każda operacja działa na kopii, a dopiero po udanym przeliczeniu stan jest
    publikowany jako nowy `working_net`. To upraszcza debugowanie i chroni przed
    przypadkowym zostawieniem pół-zmienionego obiektu po wyjątku.
    """

    def __init__(self, net: pp.pandapowerNet):
        # Bazę trzymamy osobno, żeby można było zrobić szybki reset topologii.
        self.base_net = deepcopy(net)

        # To jest egzemplarz, który będzie żył pod API i zmieniał stan switchy.
        self.working_net = deepcopy(net)

        # Layout grafowy liczymy raz dla sieci bazowej i później reuse'ujemy.
        # Dzięki temu po przełączeniu switcha układ węzłów nie "tańczy", a API
        # nie odpala kosztownego spring layoutu przy każdej operacji.
        self._graph_positions = compute_graph_positions(self.base_net)

        # Jeśli wcześniejszy load flow używał niestandardowych parametrów, chcemy
        # je zachować przy kolejnych przeliczeniach po zmianach topologii.
        self._powerflow_options = _extract_powerflow_options(net)

        self._last_run_succeeded = _has_results(self.working_net)
        self._last_run_message: str | None = None

        # Gdy serwer dostanie sieć bez wyników, liczymy stan startowy od razu,
        # żeby frontend nie zaczynał od pustych tabel wynikowych.
        if not self._last_run_succeeded:
            self._recalculate_in_place(self.working_net)

    def build_payload(self) -> dict[str, Any]:
        """Zwraca pełny payload sieci wraz ze stanem sesji przełączeniowej."""
        payload = serialize_network(self.working_net, graph_positions=self._graph_positions)
        self._inject_session_state(payload["topology"])
        return payload

    def get_element_params(self, kind: str, element_id: int) -> dict[str, Any]:
        """Zwraca bieżące parametry elementu w postaci nadającej się do edycji."""
        return read_element_params(self.working_net, kind, element_id)

    def update_element(
        self,
        kind: str,
        element_id: int,
        fields: dict[str, Any],
    ) -> dict[str, Any]:
        """Aktualizuje parametry elementu i przelicza load flow.

        Zwracany payload zawiera dodatkowe pole `changedElement` z pełną re-serializacją
        zmienionego obiektu, dzięki czemu frontend może wstrzyknąć zmiany w istniejącą
        sieć bez utraty layoutu (drag busa, łamania linii).
        """
        update = self._apply_change(
            lambda net: apply_element_update(net, kind, element_id, fields),
            success_message=f"Zaktualizowano parametry {kind} #{element_id}.",
            changed_element=(kind, element_id),
        )
        update["changedElementParams"] = read_element_params(self.working_net, kind, element_id)
        return update

    @staticmethod
    def field_schema() -> dict[str, list[dict[str, Any]]]:
        """Schemat edytowalnych pól dla wszystkich typów elementów."""
        return field_schema()

    def build_update_payload(
        self,
        *,
        changed_element: tuple[str, int] | None = None,
    ) -> dict[str, Any]:
        """
        Zwraca slim payload zmian po przełączeniu switcha — bez pól layoutu.
        Frontend wstrzykuje go do istniejącej sieci, dzięki czemu ręczne edycje
        pozycji szyn i łamań linii nie są tracone po każdym `runpp()`.
        """
        payload = serialize_topology_update(self.working_net, changed_element=changed_element)
        self._inject_session_state(payload["topology"])
        return payload

    def _inject_session_state(self, topology: dict[str, Any]) -> None:
        topology["lastRunSucceeded"] = self._last_run_succeeded
        topology["lastRunMessage"] = self._last_run_message
        topology["powerflowOptions"] = dict(self._powerflow_options)

    def set_switch_state(self, switch_id: int, closed: bool) -> dict[str, Any]:
        """Ustawia stan jednego switcha i od razu przelicza working net."""
        return self._apply_change(
            lambda net: _set_switch_state(net, switch_id=switch_id, closed=closed),
            success_message=f"Switch #{switch_id} ustawiony na {'zamknięty' if closed else 'otwarty'}.",
        )

    def reset(self) -> dict[str, Any]:
        """Przywraca working net do stanu bazowego i odświeża payload."""
        self.working_net = deepcopy(self.base_net)
        self._recalculate_in_place(self.working_net)
        self._last_run_message = "Topologia przywrócona do stanu bazowego."
        return self.build_update_payload()

    def _apply_change(
        self,
        mutator: Callable[[pp.pandapowerNet], None],
        *,
        success_message: str,
        changed_element: tuple[str, int] | None = None,
    ) -> dict[str, Any]:
        # Każdą operację wykonujemy na kopii roboczej. Jeśli coś pójdzie źle
        # podczas mutacji lub load flow, stary `working_net` zostanie nienaruszony.
        candidate = deepcopy(self.working_net)
        mutator(candidate)
        self._recalculate_in_place(candidate)
        if self._last_run_succeeded:
            self._last_run_message = success_message
        self.working_net = candidate
        return self.build_update_payload(changed_element=changed_element)

    def _recalculate_in_place(self, net: pp.pandapowerNet) -> None:
        # Stare wyniki po poprzednim stanie topologii byłyby mylące, więc przed
        # nowym `runpp()` czyścimy wszystkie tabele `res_*`.
        _clear_results(net)

        try:
            pp.runpp(
                net,
                algorithm=self._powerflow_options["algorithm"],
                calculate_voltage_angles=True,
                max_iteration=self._powerflow_options["max_iteration"],
                init="flat",
                tolerance_mva=self._powerflow_options["tolerance_mva"],
            )
        except (pp_aux.LoadflowNotConverged, UserWarning) as exc:
            net.converged = False
            self._last_run_succeeded = False
            self._last_run_message = str(exc)
            return

        net.converged = True
        self._last_run_succeeded = True
        self._last_run_message = None


def _extract_powerflow_options(net: pp.pandapowerNet) -> dict[str, Any]:
    """
    Pobiera parametry load flow zapisane wcześniej na sieci.

    Jeśli wcześniejszy kod nie zapisał takich ustawień, wracamy do domyślnych
    parametrów aplikacji. Dzięki temu warstwa switchy nie musi zgadywać, jak
    uruchamiać `runpp()` po zmianie topologii.
    """
    raw = getattr(net, "_powerflow_options", None)
    if not isinstance(raw, dict):
        return dict(_DEFAULT_POWERFLOW_OPTIONS)
    return {
        "algorithm": str(raw.get("algorithm", _DEFAULT_POWERFLOW_OPTIONS["algorithm"])),
        "max_iteration": int(raw.get("max_iteration", _DEFAULT_POWERFLOW_OPTIONS["max_iteration"])),
        "tolerance_mva": float(raw.get("tolerance_mva", _DEFAULT_POWERFLOW_OPTIONS["tolerance_mva"])),
    }


def _has_results(net: pp.pandapowerNet) -> bool:
    return hasattr(net, "res_bus") and not net.res_bus.empty


def _clear_results(net: pp.pandapowerNet) -> None:
    """
    Czyści wszystkie tabele wynikowe `res_*`.

    To ważne przy nieudanym `runpp()`: bez czyszczenia sieć zachowałaby stare wyniki
    z poprzedniego stanu topologii, a frontend pokazałby dane niezgodne ze switchami.
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
    """Ustawia `closed` dla konkretnego switcha albo rzuca czytelny błąd."""
    if switch_id not in net.switch.index:
        raise KeyError(f"Nie istnieje switch #{switch_id}.")
    net.switch.at[switch_id, "closed"] = bool(closed)
