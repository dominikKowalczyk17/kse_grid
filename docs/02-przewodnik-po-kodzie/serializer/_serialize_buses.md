# `_serialize_buses`


**Plik źródłowy:** `kse_grid\serializer.py`  
**Rodzaj:** funkcja  
**Linie w kodzie:** 195-249


## Co to jest


To jest funkcja pomocnicza lub główna o nazwie `_serialize_buses`. Po nazwie widać, że odpowiada za fragment logiki związany z: **serialize buses**.

## Nagłówek funkcji


```python
def _serialize_buses(
    net: pp.pandapowerNet,
    positions: dict[int, tuple[float, float]],
    geo_positions: dict[int, tuple[float, float]],
    has_results: bool,
) -> list[dict[str, Any]]:
```

## Argumenty


| Argument | Typ w kodzie | Wartość domyślna |
|---|---|---|
| `net` | `pp.pandapowerNet` | `brak` |
| `positions` | `dict[int, tuple[float, float]]` | `brak` |
| `geo_positions` | `dict[int, tuple[float, float]]` | `brak` |
| `has_results` | `bool` | `brak` |

## Co zwraca


Kod podpowiada, że funkcja zwraca: `list[dict[str, Any]]`.

## Co robi krok po kroku


1. Przygotowuje zmienne pomocnicze: `slack_buses`.
2. Przygotowuje zmienne pomocnicze: `gen_buses`.
3. Przygotowuje zmienną pomocniczą `out`.
4. Przechodzi po kolejnych elementach i dla każdego wykonuje te same operacje.
5. Na końcu zwraca wynik: `out`.
