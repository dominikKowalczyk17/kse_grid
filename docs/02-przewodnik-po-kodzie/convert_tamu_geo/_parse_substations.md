# `_parse_substations`


**Plik źródłowy:** `kse_grid\convert_tamu_geo.py`  
**Rodzaj:** funkcja  
**Linie w kodzie:** 50-70


## Co to jest

To parser sekcji `substation data` z pliku `.EPC`.

Jego zadanie jest bardzo konkretne:

1. odczytać identyfikator stacji `subst_id`,
2. odczytać nazwę stacji,
3. odczytać jej współrzędne `lat/lon`,
4. zbudować słownik, po którym później da się znaleźć geometrię stacji.

## Nagłówek funkcji


```python
def _parse_substations(rows: list[str]) -> dict[int, dict]:
```

## Argumenty


| Argument | Typ w kodzie | Wartość domyślna |
|---|---|---|
| `rows` | `list[str]` | `brak` |

## Co zwraca


Kod podpowiada, że funkcja zwraca: `dict[int, dict]`.

## Co zwraca w praktyce

Zwracany słownik ma kształt:

```python
{
    45: {"name": "Kozienice", "lat": 51.625, "lon": 21.0},
    46: {"name": "Belchatow", "lat": 51.268, "lon": 19.331},
}
```

Klucz to `subst_id`, czyli identyfikator stacji w pliku `EPC`.

## Co robi krok po kroku

1. Dla każdego wiersza dzieli tekst na tokeny przez `shlex.split(...)`.
2. Czyta z początku rekordu:
   - `tokens[0]` -> `sid`,
   - `tokens[1]` -> `name`,
   - `tokens[3]` -> `lat`,
   - `tokens[4]` -> `lon`.
3. Pomija rekordy błędne albo takie, gdzie `lat == 0` i `lon == 0`.
4. Zapisuje wynik do słownika `subs[sid]`.

## Przykład idei

Jeśli w `EPC` jest logicznie taki rekord:

```text
45 "Kozienice" : 51.625 21.000 ...
```

to funkcja zamieni go na:

```python
subs[45] = {
    "name": "Kozienice",
    "lat": 51.625,
    "lon": 21.000,
}
```

To jeszcze nie mówi nic o konkretnym busie.  
Ta funkcja odpowiada tylko za pytanie:

```text
gdzie leży stacja o numerze subst_id
```
