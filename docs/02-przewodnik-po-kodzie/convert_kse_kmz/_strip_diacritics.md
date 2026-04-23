# `_strip_diacritics`


**Plik źródłowy:** `kse_grid\convert_kse_kmz.py`  
**Rodzaj:** funkcja  
**Linie w kodzie:** 43-44


## Co to jest


To jest funkcja pomocnicza lub główna o nazwie `_strip_diacritics`. Po nazwie widać, że odpowiada za fragment logiki związany z: **strip diacritics**.

## Nagłówek funkcji


```python
def _strip_diacritics(s: str) -> str:
```

## Argumenty


| Argument | Typ w kodzie | Wartość domyślna |
|---|---|---|
| `s` | `str` | `brak` |

## Co zwraca


Kod podpowiada, że funkcja zwraca: `str`.

## Co robi krok po kroku


1. Na końcu zwraca wynik: `"".join(c for c in unicodedata.normalize("NFKD", s) if not unicodedata.combining(c))`.
