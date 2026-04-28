# `convert`


**Plik źródłowy:** `kse_grid\convert_tamu_geo.py`  
**Rodzaj:** funkcja  
**Linie w kodzie:** 105-149


## Co to jest

To główna funkcja konwersji:

```text
TAMU .EPC -> GeoJSON sidecar
```

To właśnie tutaj powstaje plik `*.geojson`, który potem może zostać wczytany obok
pliku `.m` i przypięty do busów w `matpower.py`.

## Nagłówek funkcji


```python
def convert(epc_path: Path, out_path: Path) -> dict:
```

## Argumenty


| Argument | Typ w kodzie | Wartość domyślna |
|---|---|---|
| `epc_path` | `Path` | `brak` |
| `out_path` | `Path` | `brak` |

## Co zwraca


Kod podpowiada, że funkcja zwraca: `dict`.

## Najważniejszy pomysł

Funkcja łączy dwie rzeczy z `EPC`:

1. `substation data`:
   ```text
   subst_id -> nazwa stacji + lat/lon
   ```
2. `bus data`:
   ```text
   bus -> subst_id + nazwa stacji
   ```

Po połączeniu tych danych dostajemy:

```text
bus -> punkt na mapie
```

## Co to jest `Feature`

`Feature` w GeoJSON to jeden obiekt przestrzenny z geometrią i opisem.

W tym module jeden `Feature` oznacza zwykle:

```text
jeden bus + punkt geograficzny stacji, do której ten bus należy
```

Przykład:

```json
{
  "type": "Feature",
  "geometry": {
    "type": "Point",
    "coordinates": [21.0, 51.625]
  },
  "properties": {
    "bus": 123,
    "subst_id": 45,
    "station": "Kozienice"
  }
}
```

## Co robi krok po kroku

1. Czyta tekst pliku `EPC`.
2. Przechodzi po sekcjach z `_iter_sections(...)`.
3. Dla sekcji `substation` wywołuje `_parse_substations(...)`.
4. Dla sekcji `bus` wywołuje `_parse_buses(...)`.
5. Sprawdza, czy ma dane stacji i busów.
6. Dla każdego busa:
   - bierze `subst_id`,
   - szuka odpowiadającej mu stacji w `subs`,
   - pobiera z niej `lon/lat`.
7. Z tych danych buduje `Feature` GeoJSON.
8. Zbiera wszystkie feature'y do `FeatureCollection`.
9. Zapisuje wynik do `out_path`.

## Kluczowy przykład mapowania

Załóżmy, że parsery zwróciły:

```python
subs = {
    45: {"name": "Kozienice", "lat": 51.625, "lon": 21.0}
}

buses = [
    {"bus": 123, "subst": 45, "station": "Kozienice"}
]
```

Wtedy `convert(...)` tworzy logicznie taki wynik:

```json
{
  "type": "Feature",
  "geometry": {
    "type": "Point",
    "coordinates": [21.0, 51.625]
  },
  "properties": {
    "bus": 123,
    "subst_id": 45,
    "station": "Kozienice"
  }
}
```

To jest dokładny moment, w którym powstaje połączenie:

```text
BUS 123 -> Kozienice -> współrzędne na mapie
```

## Co zwraca

Funkcja zwraca słownik statystyk, np.:

```python
{
    "buses": 2746,
    "substations": 312,
    "matched": 2746,
    "out": "data/case2746wop_TAMU_Updated.geojson",
}
```
