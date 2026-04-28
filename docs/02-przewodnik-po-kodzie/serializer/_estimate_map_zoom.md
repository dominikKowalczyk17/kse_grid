# `_estimate_map_zoom`

**Plik źródłowy:** `kse_grid\serializer.py`  
**Rodzaj:** funkcja pomocnicza

## Co robi

Dobiera przybliżony zoom mapy na podstawie rozmiaru obszaru zajmowanego przez sieć.

## Nagłówek funkcji

```python
def _estimate_map_zoom(west: float, east: float, south: float, north: float) -> float:
```

## Jak działa

1. liczy rozpiętość obszaru jako większą z:
   - `east - west`,
   - `north - south`,
2. porównuje ten span z kilkoma progami,
3. dla małych obszarów daje duży zoom,
4. dla dużych obszarów daje mniejszy zoom.

## Charakter funkcji

To nie jest dokładna geodezyjna formuła Mapboxa. To świadomie prosty heurystyczny mapper: wystarcza, żeby startowy widok był sensowny dla polskiej sieci, bez nadmiernej komplikacji.
