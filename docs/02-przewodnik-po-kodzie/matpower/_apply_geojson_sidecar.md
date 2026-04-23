# `_apply_geojson_sidecar`


**Plik źródłowy:** `kse_grid\matpower.py`  
**Rodzaj:** funkcja  
**Linie w kodzie:** 137-190


## Co to jest


To jest funkcja pomocnicza lub główna o nazwie `_apply_geojson_sidecar`. Po nazwie widać, że odpowiada za fragment logiki związany z: **apply geojson sidecar**.

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

## Co robi krok po kroku


1. Tworzy lub uzupełnia zmienne `payload` na podstawie wyniku funkcji `json.loads`.
2. Tworzy lub uzupełnia zmienne `features` na podstawie wyniku funkcji `payload.get`.
3. Sprawdza warunek i wybiera odpowiednią ścieżkę działania.
4. Przygotowuje zmienne pomocnicze: `id_lookup`.
5. Przygotowuje zmienne pomocnicze: `one_based_lookup`.
6. Przygotowuje zmienne pomocnicze: `name_lookup`.
7. Przygotowuje zmienne pomocnicze: `matched`.
8. Przygotowuje zmienne pomocnicze: `renamed`.
9. Przechodzi po kolejnych elementach i dla każdego wykonuje te same operacje.
10. Sprawdza warunek i wybiera odpowiednią ścieżkę działania.
11. Sprawdza warunek i wybiera odpowiednią ścieżkę działania.
