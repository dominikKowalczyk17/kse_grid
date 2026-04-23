# `best_match`


**Plik źródłowy:** `kse_grid\convert_kse_kmz.py`  
**Rodzaj:** funkcja  
**Linie w kodzie:** 92-116


## Co to jest


To jest funkcja pomocnicza lub główna o nazwie `best_match`. Po nazwie widać, że odpowiada za fragment logiki związany z: **best match**.

## Nagłówek funkcji


```python
def best_match(query: str, catalogue: dict[str, tuple[float, float, str]], cutoff: float = 0.86):
```

## Argumenty


| Argument | Typ w kodzie | Wartość domyślna |
|---|---|---|
| `query` | `str` | `brak` |
| `catalogue` | `dict[str, tuple[float, float, str]]` | `brak` |
| `cutoff` | `float` | `0.86` |

## Co zwraca


Kod podpowiada, że funkcja zwraca: `brak`.

## Co robi krok po kroku


1. Sprawdza warunek i wybiera odpowiednią ścieżkę działania.
2. Sprawdza warunek i wybiera odpowiednią ścieżkę działania.
3. Tworzy lub uzupełnia zmienne `keys` na podstawie wyniku funkcji `list`.
4. Tworzy lub uzupełnia zmienne `matches` na podstawie wyniku funkcji `difflib.get_close_matches`.
5. Sprawdza warunek i wybiera odpowiednią ścieżkę działania.
6. Tworzy lub uzupełnia zmienne `q_tokens` na podstawie wyniku funkcji `set`.
7. Sprawdza warunek i wybiera odpowiednią ścieżkę działania.
8. Na końcu zwraca wynik: `None`.
