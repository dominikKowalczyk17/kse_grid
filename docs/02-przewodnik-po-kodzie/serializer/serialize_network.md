# `serialize_network`

**Plik źródłowy:** `kse_grid\serializer.py`  
**Rodzaj:** funkcja

## Co robi

To główna funkcja adaptera `pandapower -> JSON`. Zbiera dane topologiczne, wyniki load flow, geometrię, statystyki i diagnostykę, a potem składa z nich jeden słownik gotowy do wysłania do frontendu.

## Nagłówek funkcji

```python
def serialize_network(net: pp.pandapowerNet) -> dict[str, Any]:
```

## Co zwraca

Słownik zawierający m.in.:

- `name`,
- `stats`,
- `totals`,
- `diagnostics`,
- `buses`,
- `lines`,
- `trafos`,
- `layoutModes`,
- `defaultViewMode`,
- `graphBounds`,
- `geoView`.

## Co dzieje się w środku

1. liczy pozycje grafowe przez `_compute_positions(...)`,
2. wyciąga geometrię przez `_extract_geo_positions(...)`,
3. sprawdza, czy są wyniki `res_bus`, `res_line`, `res_trafo`,
4. wyznacza poziomy napięć i domyślny filtr napięciowy,
5. liczy granice grafu i widok mapy,
6. serializuje busy, linie i transformatory,
7. dopina statystyki, sumy mocy i diagnostykę,
8. zwraca gotowy payload.
