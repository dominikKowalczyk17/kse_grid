# `_apply_geojson_sidecar`


**Plik źródłowy:** `kse_grid\matpower.py`  
**Rodzaj:** funkcja  
**Linie w kodzie:** 137-190


## Co to jest


To funkcja, która bierze gotowy plik `GeoJSON` i przypina jego punkty do busów
aktualnie załadowanego case'a `MATPOWER`.

## Nagłówek funkcji


```python
def _apply_geojson_sidecar(net: pp.pandapowerNet, sidecar_path: Path) -> None:
```

## Argumenty


| Argument | Typ w kodzie | Wartość domyślna |
|---|---|---|
| `net` | `pp.pandapowerNet` | `brak` |
| `sidecar_path` | `Path` | `brak` |

## Co zwraca


Kod podpowiada, że funkcja zwraca: `None`.

## Co wchodzi

Na wejściu są dwie rzeczy:

1. `net` - już zaimportowany `pandapowerNet`,
2. `sidecar_path` - ścieżka do GeoJSON-a z punktami stacji.

Przykład pojedynczego feature'a, jaki ta funkcja umie zjeść:

```json
{
  "type": "Feature",
  "geometry": {
    "type": "Point",
    "coordinates": [19.1778, 51.21298]
  },
  "properties": {
    "bus": 1,
    "station": "BEK Near Pajeczno"
  }
}
```

## Co wychodzi

Funkcja nic nie zwraca jawnie, ale modyfikuje `net`:

- wpisuje geometrię do `net.bus.at[bus_idx, "geo"]`,
- czasem zmienia nazwę szyny,
- jeśli nazwy szyn się zmieniły, odświeża też nazwy linii i traf.

Realny efekt dla `case2746wop_TAMU_Updated.m`:

```python
net.bus.loc[0, ["name", "geo"]].to_dict()
# {
#   'name': 'BEK Near Pajeczno 220 kV',
#   'geo': '{"type":"Point","coordinates":[19.1778,51.21298]}'
# }

net.line.loc[0, "name"]
# 'Line 1: Belchatow -> BEK Near Pajeczno 220 kV'
```

To drugie pokazuje ważny szczegół: po zmianie nazwy szyny potrafią zmienić się też nazwy elementów złożonych.

## Jak dokładnie łączy GeoJSON z case'em

1. Wczytuje `FeatureCollection` z pliku.
2. Buduje słowniki lookupów dla busów:
   - indeksy `pandapower`,
   - numerację `1-based`,
   - nazwy busów.
3. Dla każdego `Feature`:
   - sprawdza, czy geometria to `Point`,
   - pobiera `coordinates = [lon, lat]`,
   - wywołuje `_match_geo_feature_to_bus(...)`.
4. Jeśli bus został znaleziony:
   - zapisuje punkt do `net.bus.at[bus_idx, "geo"]`,
   - opcjonalnie podmienia nazwę busa na nazwę stacji.
5. Jeśli po całej pętli nie dopasowano żadnego punktu, rzuca błąd.

## Kluczowy przykład

Jeśli `Feature` ma:

```json
{
  "type": "Feature",
  "geometry": {
    "type": "Point",
    "coordinates": [21.0, 51.625]
  },
  "properties": {
    "bus": 123,
    "station": "Kozienice"
  }
}
```

i `_match_geo_feature_to_bus(...)` zwróci bus o indeksie `122`, to efekt jest
logicznie taki:

```python
net.bus.at[122, "geo"] = '{"type":"Point","coordinates":[21.0,51.625]}'
```

Jeśli obecna nazwa busa była pusta albo tymczasowa, funkcja może też ustawić:

```python
net.bus.at[122, "name"] = "Kozienice 220 kV"
```

## Co to znaczy w praktyce

Ta funkcja jest miejscem, gdzie kończy się etap:

```text
EPC -> GeoJSON
```

i zaczyna etap:

```text
GeoJSON -> net.bus["geo"] -> widok na mapie
```
