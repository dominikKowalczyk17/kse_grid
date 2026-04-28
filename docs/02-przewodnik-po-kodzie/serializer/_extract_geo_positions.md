# `_extract_geo_positions`

**Plik źródłowy:** `kse_grid\serializer.py`  
**Rodzaj:** funkcja pomocnicza

## Co robi

Wyciąga współrzędne geograficzne busów z dwóch możliwych miejsc:

1. `net.bus_geodata`,
2. kolumny `net.bus["geo"]` z GeoJSON Point.

Wynikiem jest jednolita mapa `{bus_id: (lon, lat)}`.

## Nagłówek funkcji

```python
def _extract_geo_positions(net: pp.pandapowerNet) -> dict[int, tuple[float, float]]:
```

## Co dzieje się w środku

1. jeśli istnieje `net.bus_geodata`, czyta z niego `x`, `y`,
2. jeśli w `net.bus` istnieje kolumna `geo`, próbuje sparsować ją jako GeoJSON,
3. bierze tylko obiekty typu `Point`,
4. pomija wpisy uszkodzone, puste albo nienumeryczne,
5. zwraca słownik z geometrią tylko dla busów, które udało się poprawnie odczytać.
