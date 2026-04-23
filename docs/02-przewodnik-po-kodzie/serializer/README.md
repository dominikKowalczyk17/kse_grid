# `serializer.py`

To jest adapter między światem `pandapower` i frontendem. Frontend nie zna DataFrame'ów ani struktur pandapower, więc ten moduł spłaszcza wszystko do zwykłego słownika JSON-owego.

## Co wchodzi, co wychodzi

| Wejście | Wyjście |
|---|---|
| `pandapowerNet` bez wyników load flow | payload z `hasResults=False`, zerowymi statystykami przeciążeń i tylko layoutem logicznym |
| `pandapowerNet` z `res_bus`, `res_line`, `res_trafo` | payload z napięciami, obciążeniami, statystykami i ewentualnym widokiem mapowym |

## Najważniejsze pola payloadu

| Klucz | Co znaczy |
|---|---|
| `name` | nazwa sieci pokazywana w UI |
| `stats` | liczba szyn/linii/traf i klasy stanu (`good/warn/bad`) |
| `buses` | lista szyn z pozycją grafową, a czasem też `lon/lat` |
| `lines` | lista linii z `fromBus`, `toBus`, `loading`, `pFromMw` |
| `trafos` | lista transformatorów z `hvBus`, `lvBus`, `loading` |
| `layoutModes` | `['graph']` albo `['graph', 'geo']` |
| `geoView` | środek, bounds i zoom dla mapy, jeśli są geodane |

## Realny przykład z repo

```python
from kse_grid.matpower import load_matpower_case
from kse_grid.runner import PowerFlowRunner
from kse_grid.serializer import serialize_network

net = load_matpower_case("data/case2746wop_TAMU_Updated.m")
PowerFlowRunner(net).run(algorithm="iwamoto_nr", max_iteration=100, tolerance_mva=1.5)
payload = serialize_network(net)
```

Fragment wyniku:

```python
payload["layoutModes"]
# ['graph', 'geo']

payload["defaultViewMode"]
# 'geo'

payload["buses"][0]
# {
#   'id': 0,
#   'name': 'BEK Near Pajeczno 220 kV',
#   'type': 'PQ',
#   'vn_kv': 220.0,
#   'x': ...,
#   'y': ...,
#   'lon': 19.1778,
#   'lat': 51.21298,
#   'vmPu': 1.038482327420389
# }
```

## Pliki w tym katalogu

- [`_compute_bounds`](_compute_bounds.md)
- [`_compute_geo_view`](_compute_geo_view.md)
- [`_compute_positions`](_compute_positions.md)
- [`_compute_stats`](_compute_stats.md)
- [`_count_overloads`](_count_overloads.md)
- [`_count_voltage_violations`](_count_voltage_violations.md)
- [`_estimate_map_zoom`](_estimate_map_zoom.md)
- [`_extract_geo_positions`](_extract_geo_positions.md)
- [`_max_loading`](_max_loading.md)
- [`_safe_float`](_safe_float.md)
- [`_serialize_buses`](_serialize_buses.md)
- [`_serialize_lines`](_serialize_lines.md)
- [`_serialize_trafos`](_serialize_trafos.md)
- [`_status`](_status.md)
- [`_to_float`](_to_float.md)
- [`_to_int`](_to_int.md)
- [`serialize_network`](serialize_network.md)
