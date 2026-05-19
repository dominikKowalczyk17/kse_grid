"""Silnik obliczeniowy load flow — wykonuje obliczenia bez wiedzy o prezentacji."""

from __future__ import annotations

from dataclasses import dataclass

import pandapower as pp
import pandapower.auxiliary as pp_aux

_DEFAULT_ALGORITHM = "nr"
_DEFAULT_MAX_ITERATION = 100
_DEFAULT_TOLERANCE_MVA = 1e-6


@dataclass
class PowerFlowResult:
    converged: bool
    message: str | None = None


def run_powerflow(
    net: pp.pandapowerNet,
    algorithm: str = _DEFAULT_ALGORITHM,
    max_iteration: int = _DEFAULT_MAX_ITERATION,
    tolerance_mva: float = _DEFAULT_TOLERANCE_MVA,
) -> PowerFlowResult:
    """Uruchamia load flow z flat-start. Zapisuje parametry na sieci dla sesji przełączeniowej."""
    setattr(net, "_powerflow_options", {
        "algorithm": algorithm,
        "max_iteration": max_iteration,
        "tolerance_mva": tolerance_mva,
    })
    try:
        pp.runpp(
            net,
            algorithm=algorithm,
            calculate_voltage_angles=True,
            max_iteration=max_iteration,
            init="flat",
            tolerance_mva=tolerance_mva,
        )
        return PowerFlowResult(converged=True)
    except pp_aux.LoadflowNotConverged as exc:
        return PowerFlowResult(converged=False, message=str(exc))


def load_powerflow_options(net: pp.pandapowerNet) -> dict[str, object]:
    """Odczytuje parametry load flow zapisane na sieci; zwraca domyślne gdy brak."""
    raw = getattr(net, "_powerflow_options", None)
    if isinstance(raw, dict) and {"algorithm", "max_iteration", "tolerance_mva"} <= raw.keys():
        return dict(raw)
    return {
        "algorithm": _DEFAULT_ALGORITHM,
        "max_iteration": _DEFAULT_MAX_ITERATION,
        "tolerance_mva": _DEFAULT_TOLERANCE_MVA,
    }
