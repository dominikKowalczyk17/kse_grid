# `_compute_geo_view`


**Plik źródłowy:** `kse_grid\serializer.py`  
**Rodzaj:** funkcja  
**Linie w kodzie:** 153-163


## Co to jest


To jest funkcja pomocnicza lub główna o nazwie `_compute_geo_view`. Po nazwie widać, że odpowiada za fragment logiki związany z: **compute geo view**.

## Nagłówek funkcji


```python
def _compute_geo_view(positions: dict[int, tuple[float, float]]) -> dict[str, Any]:
```

## Argumenty


| Argument | Typ w kodzie | Wartość domyślna |
|---|---|---|
| `positions` | `dict[int, tuple[float, float]]` | `brak` |

## Co zwraca


Kod podpowiada, że funkcja zwraca: `dict[str, Any]`.

## Co robi krok po kroku


1. Przygotowuje zmienne pomocnicze: `lons`.
2. Przygotowuje zmienne pomocnicze: `lats`.
3. Przygotowuje zmienne pomocnicze: `west, east`.
4. Przygotowuje zmienne pomocnicze: `south, north`.
5. Na końcu zwraca wynik: `{
        "center": {"lon": (west + east) / 2.0, "lat": (south + north) / 2.0},
        "bounds": {"lon": [west, east], "lat": [south, north]},
        "zoom": _estimate_map_zoom(west, east, south, north),
        "focusZoom": min(_estimate_map_zoom(west, east, south, north) + 2.0, 12.5),
    }`.
