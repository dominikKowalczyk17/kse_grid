# `_compute_geo_view`

**Plik źródłowy:** `kse_grid\serializer.py`  
**Rodzaj:** funkcja pomocnicza

## Co robi

Liczy parametry startowego widoku mapy na podstawie współrzędnych busów. Wyznacza środek, granice i przybliżony poziom zoom dla trybu geograficznego.

## Nagłówek funkcji

```python
def _compute_geo_view(positions: dict[int, tuple[float, float]]) -> dict[str, Any]:
```

## Co zwraca

Słownik z polami:

- `center`,
- `bounds`,
- `zoom`,
- `focusZoom`.

## Jak działa

1. zbiera wszystkie długości i szerokości geograficzne,
2. wyznacza zachód/wschód/południe/północ,
3. środek bierze jako środek bounding boxa,
4. zoom liczy przez `_estimate_map_zoom(...)`,
5. `focusZoom` ustawia o 2 poziomy bliżej, ale nie bardziej niż `12.5`.
