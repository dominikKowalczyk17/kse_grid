# `_match_geo_feature_to_bus`


**Plik źródłowy:** `kse_grid\matpower.py`  
**Rodzaj:** funkcja  
**Linie w kodzie:** 238-276


## Co to jest

To funkcja, która odpowiada na pytanie:

```text
do którego busa z aktualnie wczytanego case'a należy ten punkt GeoJSON
```

To jest most między:

- `Feature` z pliku `*.geojson`,
- a konkretnym wierszem `net.bus` w `pandapower`.

## Nagłówek funkcji


```python
def _match_geo_feature_to_bus(
    feature: dict,
    id_lookup: dict[int, int],
    one_based_lookup: dict[int, int],
    name_lookup: dict[str, int],
) -> int | None:
```

## Argumenty


| Argument | Typ w kodzie | Wartość domyślna |
|---|---|---|
| `feature` | `dict` | `brak` |
| `id_lookup` | `dict[int, int]` | `brak` |
| `one_based_lookup` | `dict[int, int]` | `brak` |
| `name_lookup` | `dict[str, int]` | `brak` |

## Co zwraca


Kod podpowiada, że funkcja zwraca: `int | None`.

## Jak wygląda wejściowy `Feature`

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

Ta funkcja nie używa geometrii do dopasowania.  
Patrzy na pola opisowe w `properties`.

## Co robi krok po kroku

1. Bierze `properties = feature.get("properties")`.
2. Szuka kandydatów identyfikatora w kolejności:
   - `bus`,
   - `bus_id`,
   - `bus_idx`,
   - `pp_index`,
   - `id`,
   - `feature.id`.
3. Jeśli znajdzie liczbę, próbuje dopasować ją:
   - najpierw przez `one_based_lookup`,
   - potem przez `id_lookup`.
4. Jeśli dopasowanie po numerze się nie uda, próbuje po nazwie:
   - `name`,
   - `bus_name`,
   - `station`.
5. Jeśli nadal nic nie pasuje, zwraca `None`.

## Po co są dwa lookupi numeryczne

To ważny szczegół:

- `one_based_lookup` obsługuje numerację typu `1, 2, 3...`,
- `id_lookup` obsługuje indeksy już używane w `pandapower`.

Dzięki temu ten sam `GeoJSON` może pasować zarówno do numeracji źródłowej busów,
jak i do indeksów po imporcie.

## Przykład dopasowania

Jeśli `feature` ma:

```json
{
  "properties": {
    "bus": 123,
    "station": "Kozienice"
  }
}
```

i `one_based_lookup[123] == 122`, to funkcja zwróci:

```python
122
```

czyli indeks busa w `net.bus`.

Od tej chwili kod może zrobić:

```python
net.bus.at[122, "geo"] = ...
```

## Najważniejszy wniosek

Ta funkcja nie zgaduje po topologii ani po położeniu.  
Ona korzysta z jawnego mapowania:

```text
Feature.properties.bus -> bus w case'ie
```

albo awaryjnie:

```text
Feature.properties.station -> nazwa busa
```
