# `_max_loading`


**Plik źródłowy:** `kse_grid\serializer.py`  
**Rodzaj:** funkcja  
**Linie w kodzie:** 337-347


## Co to jest


To jest funkcja pomocnicza lub główna o nazwie `_max_loading`. Po nazwie widać, że odpowiada za fragment logiki związany z: **max loading**.

## Nagłówek funkcji


```python
def _max_loading(net: pp.pandapowerNet) -> float:
```

## Argumenty


| Argument | Typ w kodzie | Wartość domyślna |
|---|---|---|
| `net` | `pp.pandapowerNet` | `brak` |

## Co zwraca


Kod podpowiada, że funkcja zwraca: `float`.

## Co robi krok po kroku


1. Przygotowuje zmienną pomocniczą `candidates`.
2. Sprawdza warunek i wybiera odpowiednią ścieżkę działania.
3. Sprawdza warunek i wybiera odpowiednią ścieżkę działania.
4. Na końcu zwraca wynik: `max(candidates, default=0.0)`.
