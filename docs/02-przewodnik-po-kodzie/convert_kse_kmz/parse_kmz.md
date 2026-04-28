# `parse_kmz`

**Plik źródłowy:** `kse_grid\convert_kse_kmz.py`  
**Rodzaj:** funkcja

## Co robi

Czyta archiwum KMZ z atlasem KSE i buduje katalog stacji:

```python
{normalized_name: (lon, lat, raw_name)}
```

To jest baza odniesienia używana później do fuzzy matchingu nazw z pliku EPC.

## Nagłówek funkcji

```python
def parse_kmz(kmz_path: Path) -> dict[str, tuple[float, float, str]]:
```

## Co dzieje się w środku

1. otwiera archiwum ZIP `.kmz`,
2. znajduje pierwszy plik `.kml`,
3. parsuje XML,
4. przechodzi po `Placemark`,
5. bierze tylko wpisy mające nazwę i punkt `Point`,
6. odczytuje `lon, lat`,
7. pomija wpisy planowane/projektowane (`proj...`),
8. normalizuje nazwę przez `normalize_name(...)`,
9. zapisuje pierwszy znaleziony punkt dla danego klucza.

## Co zwraca

Słownik, gdzie klucz to nazwa uproszczona, a wartość zawiera:

- długość geograficzną,
- szerokość geograficzną,
- oryginalną nazwę z KMZ.
