# `convert_tamu_geo.py`

Ten katalog opisuje plik `kse_grid\convert_tamu_geo.py`, czyli konwerter:

```text
TAMU .EPC -> GeoJSON sidecar dla case'a MATPOWER
```

To jest ważny etap w projekcie, bo to właśnie tutaj powstaje plik `*.geojson`,
który później `matpower.py` dopina do busów z case'a.

## Najkrótszy przepływ danych

```text
sekcja "substation data" z EPC
-> subst_id -> nazwa stacji + lat/lon

sekcja "bus data" z EPC
-> bus -> subst_id + nazwa stacji

połączenie po subst_id
-> jeden Feature GeoJSON na bus
```

Przykład logiczny:

```text
BUS 123 -> SUBSTATION 45
SUBSTATION 45 -> "Kozienice", lat=51.625, lon=21.0
=> Feature dla BUS 123 z punktem "Kozienice"
```

## Co zawiera wynikowy GeoJSON

Wynik ma postać `FeatureCollection`, czyli listy obiektów `Feature`.

Pojedynczy `Feature` to jeden punkt przestrzenny z opisem:

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

Tutaj:

- `geometry` mówi, **gdzie** leży punkt,
- `properties.bus` mówi, **do którego busa** ten punkt ma być przypięty,
- `properties.station` daje nazwę stacji do ewentualnego nadania nazwy busowi.

## Pliki w tym katalogu

- [`_iter_sections`](_iter_sections.md)
- [`_parse_buses`](_parse_buses.md)
- [`_parse_substations`](_parse_substations.md)
- [`convert`](convert.md)
- [`main`](main.md)

## Co jest w tym pliku ogólnie

W osobnych plikach `.md` obok są opisane poszczególne funkcje:

- jak parser czyta `substation data`,
- jak parser czyta `bus data`,
- jak z tych dwóch sekcji powstają `Feature` w GeoJSON,
- jak później ten GeoJSON łączy się z busami z case'a.
