# `_ensure_reference_bus`


**Plik źródłowy:** `kse_grid\matpower.py`  
**Rodzaj:** funkcja  
**Linie w kodzie:** 78-114


## Co to jest


To jest funkcja pomocnicza lub główna o nazwie `_ensure_reference_bus`. Po nazwie widać, że odpowiada za fragment logiki związany z: **ensure reference bus**.

## Nagłówek funkcji


```python
def _ensure_reference_bus(net: pp.pandapowerNet) -> None:
```

## Argumenty


| Argument | Typ w kodzie | Wartość domyślna |
|---|---|---|
| `net` | `pp.pandapowerNet` | `brak` |

## Co zwraca


Kod podpowiada, że funkcja zwraca: `None`.

## Co robi krok po kroku


1. Przygotowuje zmienne pomocnicze: `active_ext_grid`.
2. Przygotowuje zmienne pomocnicze: `active_slack_gen`.
3. Sprawdza warunek i wybiera odpowiednią ścieżkę działania.
4. Sprawdza warunek i wybiera odpowiednią ścieżkę działania.
5. Sprawdza warunek i wybiera odpowiednią ścieżkę działania.
