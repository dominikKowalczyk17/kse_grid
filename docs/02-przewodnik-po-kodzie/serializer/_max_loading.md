# `_max_loading`

**Plik źródłowy:** `kse_grid\serializer.py`  
**Rodzaj:** funkcja pomocnicza

## Co robi

Znajduje największe obciążenie procentowe w całej sieci, biorąc pod uwagę zarówno linie, jak i transformatory.

## Nagłówek funkcji

```python
def _max_loading(net: pp.pandapowerNet) -> float:
```

## Jak działa

1. zbiera maksimum z `net.res_line["loading_percent"]`, jeśli istnieje,
2. zbiera maksimum z `net.res_trafo["loading_percent"]`, jeśli istnieje,
3. zwraca większą z tych wartości,
4. jeśli brak danych, zwraca `0.0`.

## Po co istnieje

To pojedyncza liczba do szybkiego pokazania w UI: "jak bardzo obciążony jest najbardziej krytyczny element sieci".
