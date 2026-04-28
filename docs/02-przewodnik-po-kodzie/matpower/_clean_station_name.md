# `_clean_station_name`


**Plik źródłowy:** `kse_grid\matpower.py`  
**Rodzaj:** funkcja  
**Linie w kodzie:** 210-217


## Co to jest

`_clean_station_name(raw)` czyści nazwę stacji z GeoJSON.

## Nagłówek funkcji


```python
def _clean_station_name(raw: object) -> str:
```

## Argumenty


| Argument | Typ w kodzie | Wartość domyślna |
|---|---|---|
| `raw` | `object` | `brak` |

## Co zwraca


Kod podpowiada, że funkcja zwraca: `str`.

## Robi:

 1. jeśli to nie string -> zwraca pusty string
 2. usuwa prefiks liczbowy z początku, np. 123 Stacja
 3. ucina „śmieci” od &... do końca
 4. przepuszcza przez _to_ascii(...)
 5. zwija wielokrotne spacje
 6. trimuje

 Czyli z surowego station robi krótką, czystą nazwę stacji.
