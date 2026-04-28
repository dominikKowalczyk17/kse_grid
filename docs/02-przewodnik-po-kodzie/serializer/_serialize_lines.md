# `_serialize_lines`

**Plik źródłowy:** `kse_grid\serializer.py`  
**Rodzaj:** funkcja pomocnicza

## Co robi

Serializuje linie do listy słowników JSON z informacją topologiczną, napięciową i - jeśli są geodane - także z długością oszacowaną po współrzędnych.

## Nagłówek funkcji

```python
def _serialize_lines(
    net: pp.pandapowerNet,
    has_results: bool,
    geo_positions: dict[int, tuple[float, float]],
) -> list[dict[str, Any]]:
```

## Najważniejsza cecha

Funkcja rozróżnia dwa typy długości:

- `modelLengthKm` - długość z modelu MATPOWER/pandapower,
- `geoLengthKm` - długość policzona po `lon/lat` metodą haversine.

Pole `lengthKm` dostaje preferencyjnie wartość geograficzną, a `lengthSource` mówi, skąd ona pochodzi.

## Co trafia do pojedynczej linii

- `id`, `name`,
- `fromBus`, `toBus`,
- `voltage`,
- `lengthKm`, `modelLengthKm`, `geoLengthKm`, `lengthSource`,
- opcjonalnie `loading`, `pFromMw`.
