# `normalize_name`


**Plik źródłowy:** `kse_grid\convert_kse_kmz.py`  
**Rodzaj:** funkcja  
**Linie w kodzie:** 52-58


## Co to jest


To jest funkcja pomocnicza lub główna o nazwie `normalize_name`. Po nazwie widać, że odpowiada za fragment logiki związany z: **normalize name**.

## Nagłówek funkcji


```python
def normalize_name(name: str) -> str:
```

## Argumenty


| Argument | Typ w kodzie | Wartość domyślna |
|---|---|---|
| `name` | `str` | `brak` |

## Co zwraca


Kod podpowiada, że funkcja zwraca: `str`.

## Co robi krok po kroku


1. Tworzy lub uzupełnia zmienne `raw` na podstawie wyniku funkcji `name.strip`.
2. Tworzy lub uzupełnia zmienne `raw` na podstawie wyniku funkcji `_NUM_PREFIX.sub`.
3. Tworzy lub uzupełnia zmienne `raw` na podstawie wyniku funkcji `_TAIL_CODE.sub`.
4. Tworzy lub uzupełnia zmienne `raw` na podstawie wyniku funkcji `_strip_diacritics(raw).lower`.
5. Przygotowuje zmienne pomocnicze: `tokens`.
6. Na końcu zwraca wynik: `" ".join(tokens)`.
