# `_normalize_imported_net`


**Plik źródłowy:** `kse_grid\matpower.py`  
**Rodzaj:** funkcja  
**Linie w kodzie:** 53-75


## Co to jest


To jest funkcja pomocnicza lub główna o nazwie `_normalize_imported_net`. Po nazwie widać, że odpowiada za fragment logiki związany z: **normalize imported net**.

## Nagłówek funkcji


```python
def _normalize_imported_net(net: pp.pandapowerNet):
```

## Argumenty


| Argument | Typ w kodzie | Wartość domyślna |
|---|---|---|
| `net` | `pp.pandapowerNet` | `brak` |

## Co zwraca


Kod podpowiada, że funkcja zwraca: `brak`.

## Co robi krok po kroku


1. jeśli szyna nie ma nazwy, wpisuje Bus N
2. jeśli linia nie ma nazwy, wpisuje Line N: busA -> busB
3. jeśli trafo nie ma nazwy, wpisuje Trafo N: hvBus -> lvBus
4. na końcu woła _ensure_reference_bus(net)

Po co: żeby UI, tooltipy, listy i diagnostyka nie miały pustych nazw.
