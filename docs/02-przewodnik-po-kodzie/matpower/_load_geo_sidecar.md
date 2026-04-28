# `_load_geo_sidecar`


**Plik źródłowy:** `kse_grid\matpower.py`  
**Rodzaj:** funkcja  
**Linie w kodzie:** 117-123


## Co to jest
`_load_geo_sidecar(net, case_path)` ładuje geometrię szyn z pliku obok case'a.

  Logika:

   1. bierze listę możliwych sidecarów z _candidate_geo_sidecars(...)
   2. sprawdza po kolei, czy plik istnieje
   3. pierwszy znaleziony przekazuje do _apply_geojson_sidecar(...)
   4. zapamiętuje źródło w net._geo_source
   5. kończy po pierwszym trafionym pliku

  Czyli: „znajdź GeoJSON obok .m i dolep współrzędne do busów”.

## Nagłówek funkcji


```python
def _load_geo_sidecar(net: pp.pandapowerNet, case_path: Path) -> None:
```

## Argumenty


| Argument | Typ w kodzie | Wartość domyślna |
|---|---|---|
| `net` | `pp.pandapowerNet` | `brak` |
| `case_path` | `Path` | `brak` |
