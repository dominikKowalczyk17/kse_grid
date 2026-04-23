# `_match_geo_feature_to_bus`


**Plik źródłowy:** `kse_grid\matpower.py`  
**Rodzaj:** funkcja  
**Linie w kodzie:** 238-276


## Co to jest


To jest funkcja pomocnicza lub główna o nazwie `_match_geo_feature_to_bus`. Po nazwie widać, że odpowiada za fragment logiki związany z: **match geo feature to bus**.

## Nagłówek funkcji


```python
def _match_geo_feature_to_bus(
    feature: dict,
    id_lookup: dict[int, int],
    one_based_lookup: dict[int, int],
    name_lookup: dict[str, int],
) -> int | None:
```

## Argumenty


| Argument | Typ w kodzie | Wartość domyślna |
|---|---|---|
| `feature` | `dict` | `brak` |
| `id_lookup` | `dict[int, int]` | `brak` |
| `one_based_lookup` | `dict[int, int]` | `brak` |
| `name_lookup` | `dict[str, int]` | `brak` |

## Co zwraca


Kod podpowiada, że funkcja zwraca: `int | None`.

## Co robi krok po kroku


1. Przygotowuje zmienne pomocnicze: `properties`.
2. Przygotowuje zmienne pomocnicze: `raw_candidates`.
3. Przechodzi po kolejnych elementach i dla każdego wykonuje te same operacje.
4. Przygotowuje zmienne pomocnicze: `name_candidates`.
5. Przechodzi po kolejnych elementach i dla każdego wykonuje te same operacje.
6. Na końcu zwraca wynik: `None`.
