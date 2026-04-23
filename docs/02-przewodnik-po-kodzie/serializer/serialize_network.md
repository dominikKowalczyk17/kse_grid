# `serialize_network`


**Plik źródłowy:** `kse_grid\serializer.py`  
**Rodzaj:** funkcja  
**Linie w kodzie:** 23-51


## Co to jest


To jest funkcja pomocnicza lub główna o nazwie `serialize_network`. Po nazwie widać, że odpowiada za fragment logiki związany z: **serialize network**.

## Nagłówek funkcji


```python
def serialize_network(net: pp.pandapowerNet) -> dict[str, Any]:
```

## Argumenty


| Argument | Typ w kodzie | Wartość domyślna |
|---|---|---|
| `net` | `pp.pandapowerNet` | `brak` |

## Co zwraca


Kod podpowiada, że funkcja zwraca: `dict[str, Any]`.

## Co wchodzi

Na wejściu jest kompletna sieć `pandapowerNet`. Funkcja działa w dwóch trybach:

1. **przed load flow** - są dane topologiczne, ale nie ma jeszcze wyników,
2. **po load flow** - oprócz topologii są już `res_bus`, `res_line`, `res_trafo`.

Przykład:

```python
net = load_matpower_case("data/case2746wop_TAMU_Updated.m")
payload = serialize_network(net)
```

## Co wychodzi

Wyjściem jest słownik, który można bezpośrednio oddać jako JSON z API.

Najważniejsze elementy:

```python
payload.keys()
# [
#   'name', 'hasResults', 'voltageLevels', 'defaultVoltageFilter',
#   'layoutModes', 'defaultViewMode', 'geoAvailable', 'stats',
#   'buses', 'lines', 'trafos', 'bounds', 'graphBounds', 'geoView'
# ]
```

Fragment realnego wyniku:

```python
payload["stats"]
# {
#   'nBus': 2746,
#   'nLine': 3340,
#   'nTrafo': 172,
#   'nGen': 378,
#   'maxLoading': '281.0%',
#   'loadClass': 'bad',
#   'nViol': 2082,
#   'violClass': 'bad',
#   'nOverload': 8,
#   'ovlClass': 'bad'
# }
```

Pojedyncza szyna po serializacji:

```python
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

## Co robi krok po kroku


1. Tworzy lub uzupełnia zmienne `positions` na podstawie wyniku funkcji `_compute_positions`.
2. Tworzy lub uzupełnia zmienne `geo_positions` na podstawie wyniku funkcji `_extract_geo_positions`.
3. Przygotowuje zmienne pomocnicze: `has_bus_results`.
4. Przygotowuje zmienne pomocnicze: `has_line_results`.
5. Przygotowuje zmienne pomocnicze: `has_trafo_results`.
6. Tworzy lub uzupełnia zmienne `voltage_levels` na podstawie wyniku funkcji `sorted`.
7. Przygotowuje zmienne pomocnicze: `default_voltage_filter`.
8. Tworzy lub uzupełnia zmienne `graph_bounds` na podstawie wyniku funkcji `_compute_bounds`.
9. Przygotowuje zmienne pomocnicze: `geo_view`.
10. Na końcu zwraca wynik: `{
        "name": getattr(net, "name", None) or "Sieć elektroenergetyczna",
        "hasResults": has_bus_results,
        "voltageLevels": voltage_levels,
        "defaultVoltageFilter": default_voltage_filter,
        "layoutModes": ["graph", "geo"] if geo_view else ["graph"],
        "defaultViewMode": "geo" if geo_view else "graph",
        "geoAvailable": geo_view is not None,
        "stats": _compute_stats(net),
        "buses": _serialize_buses(net, positions, geo_positions, has_bus_results),
        "lines": _serialize_lines(net, has_line_results),
        "trafos": _serialize_trafos(net, has_trafo_results),
        "bounds": graph_bounds,
        "graphBounds": graph_bounds,
        "geoView": geo_view,
    }`.

## Oryginalny opis zapisany w kodzie

Zwraca słownik z całą siecią + wynikami load flow gotowy do JSON-a.
