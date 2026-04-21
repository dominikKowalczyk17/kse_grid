from pathlib import Path

import pandapower as pp
from pandapower.converter.matpower import from_mpc


def load_matpower_case(case_file: str | Path, f_hz: int = 50) -> pp.pandapowerNet:
    """Ładuje przypadek MATPOWER (.m) do pandapower."""
    case_path = Path(case_file).expanduser().resolve()
    net = from_mpc(str(case_path), f_hz=f_hz)
    net.name = case_path.stem
    _normalize_imported_net(net)
    return net


def _normalize_imported_net(net: pp.pandapowerNet):
    bus_names = net.bus["name"].fillna("").astype(str).str.strip()
    empty_bus_names = bus_names.eq("")
    for bus_idx in net.bus.index[empty_bus_names]:
        net.bus.at[bus_idx, "name"] = f"Bus {bus_idx + 1}"

    line_names = net.line["name"].fillna("").astype(str).str.strip()
    empty_line_names = line_names.eq("")
    for line_idx in net.line.index[empty_line_names]:
        row = net.line.loc[line_idx]
        from_name = net.bus.at[row.from_bus, "name"]
        to_name = net.bus.at[row.to_bus, "name"]
        net.line.at[line_idx, "name"] = f"Linia {line_idx + 1}: {from_name} - {to_name}"

    trafo_names = net.trafo["name"].fillna("").astype(str).str.strip()
    empty_trafo_names = trafo_names.eq("")
    for trafo_idx in net.trafo.index[empty_trafo_names]:
        row = net.trafo.loc[trafo_idx]
        hv_name = net.bus.at[row.hv_bus, "name"]
        lv_name = net.bus.at[row.lv_bus, "name"]
        net.trafo.at[trafo_idx, "name"] = f"Trafo {trafo_idx + 1}: {hv_name} - {lv_name}"
