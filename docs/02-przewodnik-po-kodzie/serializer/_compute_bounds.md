# `_compute_bounds`

**Plik źródłowy:** `kse_grid\serializer.py`  
**Rodzaj:** funkcja pomocnicza

## Co robi

Wyznacza prostokąt obejmujący cały layout grafowy. Frontend używa tego do ustawienia zakresu osi i sensownego marginesu wokół sieci.

## Nagłówek funkcji

```python
def _compute_bounds(positions: dict[int, tuple[float, float]]) -> dict[str, list[float]]:
```

## Co zwraca

Słownik:

```python
{"x": [xmin, xmax], "y": [ymin, ymax]}
```

## Jak działa

1. zbiera wszystkie współrzędne `x` i `y`,
2. liczy minima i maksima,
3. dodaje padding równy `8%` rozpiętości, ale nie mniejszy niż `0.2`,
4. zwraca wynik dla obu osi.
