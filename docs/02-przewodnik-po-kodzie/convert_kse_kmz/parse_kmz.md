# `parse_kmz`


**Plik źródłowy:** `kse_grid\convert_kse_kmz.py`  
**Rodzaj:** funkcja  
**Linie w kodzie:** 61-89


## Co to jest


To jest funkcja pomocnicza lub główna o nazwie `parse_kmz`. Po nazwie widać, że odpowiada za fragment logiki związany z: **parse kmz**.

## Nagłówek funkcji


```python
def parse_kmz(kmz_path: Path) -> dict[str, tuple[float, float, str]]:
```

## Argumenty


| Argument | Typ w kodzie | Wartość domyślna |
|---|---|---|
| `kmz_path` | `Path` | `brak` |

## Co zwraca


Kod podpowiada, że funkcja zwraca: `dict[str, tuple[float, float, str]]`.

## Co robi krok po kroku


1. Otwiera zasób pomocniczy i wykonuje na nim operacje tylko w tym bloku.
2. Tworzy lub uzupełnia zmienne `root` na podstawie wyniku funkcji `tree.getroot`.
3. Przygotowuje zmienną pomocniczą `catalogue`.
4. Przechodzi po kolejnych elementach i dla każdego wykonuje te same operacje.
5. Na końcu zwraca wynik: `catalogue`.
