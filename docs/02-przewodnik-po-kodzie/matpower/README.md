# `matpower.py`

To jest warstwa importu. Bierze plik MATPOWER i zamienia go na `pandapowerNet`, a potem dopina brakujące rzeczy potrzebne dalej w aplikacji: sensowne nazwy, slack/reference bus i geometrię.

## Co wchodzi, co wychodzi

| Wejście | Wyjście |
|---|---|
| `data/case3120sp.m` | `pandapowerNet` bez geometrii zewnętrznej |
| `data/case2746wop_TAMU_Updated.m` + `data/case2746wop_TAMU_Updated.geojson` | `pandapowerNet` z geometrią w `net.bus["geo"]` |

## Co dokładnie robi ten moduł

1. Importuje `.m` przez `pandapower.converter.matpower.from_mpc`.
2. Jeśli import wywala się na `gencost`, usuwa blok `mpc.gencost` i próbuje jeszcze raz.
3. Uzupełnia brakujące nazwy szyn, linii i traf.
4. Pilnuje, żeby istniał aktywny punkt odniesienia (`ext_grid` albo generator slack).
5. Szuka sidecara GeoJSON obok case'a.
6. Jeśli znajdzie pasujące punkty, wpisuje współrzędne do `net.bus["geo"]`.

## Realny przykład z repo

Wejście:

```python
from kse_grid.matpower import load_matpower_case

net = load_matpower_case("data/case2746wop_TAMU_Updated.m")
```

Wybrane efekty:

```python
net.name
# 'case2746wop_TAMU_Updated'

getattr(net, "_geo_source")
# '...\\data\\case2746wop_TAMU_Updated.geojson'

net.bus.loc[0, ["name", "vn_kv", "geo"]].to_dict()
# {
#   'name': 'BEK Near Pajeczno 220 kV',
#   'vn_kv': 220.0,
#   'geo': '{"type":"Point","coordinates":[19.1778,51.21298]}'
# }
```

## Pliki w tym katalogu

- [`_apply_geojson_sidecar`](_apply_geojson_sidecar.md)
- [`_candidate_geo_sidecars`](_candidate_geo_sidecars.md)
- [`_clean_station_name`](_clean_station_name.md)
- [`_ensure_reference_bus`](_ensure_reference_bus.md)
- [`_import_matpower_case`](_import_matpower_case.md)
- [`_import_without_gencost`](_import_without_gencost.md)
- [`_load_geo_sidecar`](_load_geo_sidecar.md)
- [`_match_geo_feature_to_bus`](_match_geo_feature_to_bus.md)
- [`_normalize_imported_net`](_normalize_imported_net.md)
- [`_refresh_composite_names`](_refresh_composite_names.md)
- [`_to_ascii`](_to_ascii.md)
- [`_to_float`](_to_float.md)
- [`_to_int`](_to_int.md)
- [`load_matpower_case`](load_matpower_case.md)
