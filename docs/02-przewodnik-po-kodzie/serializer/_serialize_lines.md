# `_serialize_lines`


**Plik źródłowy:** `kse_grid\serializer.py`  
**Rodzaj:** funkcja  
**Linie w kodzie:** 252-273


## Co to jest


To jest funkcja pomocnicza lub główna o nazwie `_serialize_lines`. Po nazwie widać, że odpowiada za fragment logiki związany z: **serialize lines**.

## Nagłówek funkcji


```python
def _serialize_lines(net: pp.pandapowerNet, has_results: bool) -> list[dict[str, Any]]:
```

## Argumenty


| Argument | Typ w kodzie | Wartość domyślna |
|---|---|---|
| `net` | `pp.pandapowerNet` | `brak` |
| `has_results` | `bool` | `brak` |

## Co zwraca


Kod podpowiada, że funkcja zwraca: `list[dict[str, Any]]`.

## Co robi krok po kroku


1. Przygotowuje zmienną pomocniczą `out`.
2. Przechodzi po kolejnych elementach i dla każdego wykonuje te same operacje.
3. Na końcu zwraca wynik: `out`.
