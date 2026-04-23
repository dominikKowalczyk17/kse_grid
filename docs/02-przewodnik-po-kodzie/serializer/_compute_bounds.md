# `_compute_bounds`


**Plik źródłowy:** `kse_grid\serializer.py`  
**Rodzaj:** funkcja  
**Linie w kodzie:** 107-114


## Co to jest


To jest funkcja pomocnicza lub główna o nazwie `_compute_bounds`. Po nazwie widać, że odpowiada za fragment logiki związany z: **compute bounds**.

## Nagłówek funkcji


```python
def _compute_bounds(positions: dict[int, tuple[float, float]]) -> dict[str, list[float]]:
```

## Argumenty


| Argument | Typ w kodzie | Wartość domyślna |
|---|---|---|
| `positions` | `dict[int, tuple[float, float]]` | `brak` |

## Co zwraca


Kod podpowiada, że funkcja zwraca: `dict[str, list[float]]`.

## Co robi krok po kroku


1. Przygotowuje zmienne pomocnicze: `xs`.
2. Przygotowuje zmienne pomocnicze: `ys`.
3. Przygotowuje zmienne pomocnicze: `x_min, x_max`.
4. Przygotowuje zmienne pomocnicze: `y_min, y_max`.
5. Tworzy lub uzupełnia zmienne `pad_x` na podstawie wyniku funkcji `max`.
6. Tworzy lub uzupełnia zmienne `pad_y` na podstawie wyniku funkcji `max`.
7. Na końcu zwraca wynik: `{"x": [x_min - pad_x, x_max + pad_x], "y": [y_min - pad_y, y_max + pad_y]}`.
