# `_to_float`


**Plik źródłowy:** `kse_grid\serializer.py`  
**Rodzaj:** funkcja  
**Linie w kodzie:** 62-66


## Co to jest


To jest funkcja pomocnicza lub główna o nazwie `_to_float`. Po nazwie widać, że odpowiada za fragment logiki związany z: **to float**.

## Nagłówek funkcji


```python
def _to_float(value: object) -> float:
```

## Argumenty


| Argument | Typ w kodzie | Wartość domyślna |
|---|---|---|
| `value` | `object` | `brak` |

## Co zwraca


Kod podpowiada, że funkcja zwraca: `float`.

## Co robi krok po kroku


1. Tworzy lub uzupełnia zmienne `result` na podstawie wyniku funkcji `_safe_float`.
2. Sprawdza warunek i wybiera odpowiednią ścieżkę działania.
3. Na końcu zwraca wynik: `result`.
