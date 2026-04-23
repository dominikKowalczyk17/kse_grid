# `_count_voltage_violations`


**Plik źródłowy:** `kse_grid\serializer.py`  
**Rodzaj:** funkcja  
**Linie w kodzie:** 350-354


## Co to jest


To jest funkcja pomocnicza lub główna o nazwie `_count_voltage_violations`. Po nazwie widać, że odpowiada za fragment logiki związany z: **count voltage violations**.

## Nagłówek funkcji


```python
def _count_voltage_violations(net: pp.pandapowerNet) -> int:
```

## Argumenty


| Argument | Typ w kodzie | Wartość domyślna |
|---|---|---|
| `net` | `pp.pandapowerNet` | `brak` |

## Co zwraca


Kod podpowiada, że funkcja zwraca: `int`.

## Co robi krok po kroku


1. Sprawdza warunek i wybiera odpowiednią ścieżkę działania.
2. Tworzy lub uzupełnia zmienne `vm` na podstawie wyniku funkcji `net.res_bus["vm_pu"].dropna`.
3. Na końcu zwraca wynik: `int(((vm < _VOLTAGE_OK_MIN) | (vm > _VOLTAGE_OK_MAX)).sum())`.
