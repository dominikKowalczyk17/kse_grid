# `main`

**Plik źródłowy:** `kse_grid\convert_kse_kmz.py`  
**Rodzaj:** funkcja CLI

## Co robi

To punkt wejścia dla skryptu uruchamianego z linii poleceń. Parsuje argumenty `--epc`, `--kmz`, `--out`, buduje katalog z KMZ, czyta EPC i zapisuje GeoJSON sidecar z możliwie najlepszymi współrzędnymi busów.

## Nagłówek funkcji

```python
def main() -> None:
```

## Co dzieje się w środku

1. tworzy parser argumentów CLI,
2. wczytuje katalog stacji z KMZ przez `parse_kmz(...)`,
3. parsuje sekcje `substation` i `bus` z EPC,
4. dla każdego busa szuka najlepszego dopasowania nazwy stacji w KMZ,
5. jeśli znajdzie trafienie, bierze współrzędne z KMZ,
6. jeśli nie, ale zna stację z EPC, bierze współrzędne z EPC,
7. zapisuje wynik jako `FeatureCollection`,
8. wypisuje statystyki: ile busów dostało geometrię z KMZ, ile tylko z EPC, ile pozostało bez geometrii.

## Efekt

Powstaje GeoJSON sidecar lepszy jakościowo niż czysty eksport z EPC, bo tam gdzie się da korzysta z atlasu KSE.
