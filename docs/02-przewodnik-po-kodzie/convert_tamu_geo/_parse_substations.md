# `_parse_substations`


**Plik źródłowy:** `kse_grid\convert_tamu_geo.py`  
**Rodzaj:** funkcja  
**Linie w kodzie:** 50-70


## Co to jest


To jest funkcja pomocnicza lub główna o nazwie `_parse_substations`. Po nazwie widać, że odpowiada za fragment logiki związany z: **parse substations**.

## Nagłówek funkcji


```python
def _parse_substations(rows: list[str]) -> dict[int, dict]:
```

## Argumenty


| Argument | Typ w kodzie | Wartość domyślna |
|---|---|---|
| `rows` | `list[str]` | `brak` |

## Co zwraca


Kod podpowiada, że funkcja zwraca: `dict[int, dict]`.

## Co robi krok po kroku


1. Przygotowuje zmienną pomocniczą `subs`.
2. Przechodzi po kolejnych elementach i dla każdego wykonuje te same operacje.
3. Na końcu zwraca wynik: `subs`.
