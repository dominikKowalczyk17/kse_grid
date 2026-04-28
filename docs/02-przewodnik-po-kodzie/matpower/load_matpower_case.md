# `load_matpower_case`

**Plik źródłowy:** `kse_grid\matpower.py`  
**Rodzaj:** funkcja

## Co robi

To główna funkcja importu pliku MATPOWER `.m` do `pandapowerNet`. Po samym imporcie wykonuje też normalizację nazw, pilnuje reference bus i próbuje dołączyć geometrię z sidecara GeoJSON.

## Nagłówek funkcji

```python
def load_matpower_case(case_file: str | Path, f_hz: int = 50) -> pp.pandapowerNet:
```

## Co dzieje się w środku

1. zamienia ścieżkę na obiekt `Path`,
2. importuje case przez `_import_matpower_case(...)`,
3. wpisuje nazwę modelu do `net.name`,
4. zapamiętuje oryginalną ścieżkę w `net._case_path`,
5. wywołuje `_normalize_imported_net(net)`,
6. wywołuje `_load_geo_sidecar(net, case_path)`,
7. zwraca gotową sieć.

## Co zwraca

`pandapowerNet` gotowy do dalszych kroków: `run_powerflow()`, `serialize_network()` albo `serve()`.
