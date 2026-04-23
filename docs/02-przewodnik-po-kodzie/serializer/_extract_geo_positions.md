# `_extract_geo_positions`


**Plik źródłowy:** `kse_grid\serializer.py`  
**Rodzaj:** funkcja  
**Linie w kodzie:** 117-150


## Co to jest


To jest funkcja pomocnicza lub główna o nazwie `_extract_geo_positions`. Po nazwie widać, że odpowiada za fragment logiki związany z: **extract geo positions**.

## Nagłówek funkcji


```python
def _extract_geo_positions(net: pp.pandapowerNet) -> dict[int, tuple[float, float]]:
```

## Argumenty


| Argument | Typ w kodzie | Wartość domyślna |
|---|---|---|
| `net` | `pp.pandapowerNet` | `brak` |

## Co zwraca


Kod podpowiada, że funkcja zwraca: `dict[int, tuple[float, float]]`.

## Co robi krok po kroku


1. Przygotowuje zmienną pomocniczą `positions`.
2. Sprawdza warunek i wybiera odpowiednią ścieżkę działania.
3. Sprawdza warunek i wybiera odpowiednią ścieżkę działania.
4. Przechodzi po kolejnych elementach i dla każdego wykonuje te same operacje.
5. Na końcu zwraca wynik: `positions`.
