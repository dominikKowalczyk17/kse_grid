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


1. Tworzy lub uzupełnia zmienne `bus_names` na podstawie wyniku funkcji `net.bus["name"].fillna("").astype(str).str.strip`.
2. Tworzy lub uzupełnia zmienne `empty_bus_names` na podstawie wyniku funkcji `bus_names.eq`.
3. Przechodzi po kolejnych elementach i dla każdego wykonuje te same operacje.
4. Tworzy lub uzupełnia zmienne `line_names` na podstawie wyniku funkcji `net.line["name"].fillna("").astype(str).str.strip`.
5. Tworzy lub uzupełnia zmienne `empty_line_names` na podstawie wyniku funkcji `line_names.eq`.
6. Przechodzi po kolejnych elementach i dla każdego wykonuje te same operacje.
7. Tworzy lub uzupełnia zmienne `trafo_names` na podstawie wyniku funkcji `net.trafo["name"].fillna("").astype(str).str.strip`.
8. Tworzy lub uzupełnia zmienne `empty_trafo_names` na podstawie wyniku funkcji `trafo_names.eq`.
9. Przechodzi po kolejnych elementach i dla każdego wykonuje te same operacje.
10. Wywołuje funkcję `_ensure_reference_bus`.
