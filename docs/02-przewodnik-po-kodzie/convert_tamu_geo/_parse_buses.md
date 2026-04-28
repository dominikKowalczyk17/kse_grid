# `_parse_buses`


**Plik źródłowy:** `kse_grid\convert_tamu_geo.py`  
**Rodzaj:** funkcja  
**Linie w kodzie:** 73-102


## Co to jest

To parser sekcji `bus data` z pliku `.EPC`.

Jest kluczowy dla całego mapowania, bo odpowiada na pytanie:

```text
który bus należy do której stacji
```

## Nagłówek funkcji


```python
def _parse_buses(rows: list[str]) -> list[dict]:
```

## Argumenty


| Argument | Typ w kodzie | Wartość domyślna |
|---|---|---|
| `rows` | `list[str]` | `brak` |

## Co zwraca


Kod podpowiada, że funkcja zwraca: `list[dict]`.

## Co zwraca w praktyce

Zwracana lista ma rekordy w stylu:

```python
[
    {"bus": 123, "subst": 45, "station": "Kozienice"},
    {"bus": 124, "subst": 45, "station": "Kozienice"},
]
```

To właśnie stąd później bierze się informacja:

```text
BUS 123 -> stacja 45 -> Kozienice
```

## Co robi krok po kroku

1. Dla każdego wiersza rozbija tekst przez `shlex.split(...)`.
2. Bierze pierwszy token jako numer busa:
   - `tokens[0] -> bus_id`
3. Potem patrzy na końcówkę rekordu, bo tam w formacie `EPC` znajduje się:
   - `subst_id`,
   - nazwa stacji,
   - area/zone i inne pola pomocnicze.
4. Wyciąga z ogona rekordu:
   - `tokens[-7] -> subst_id`
   - `tokens[-6] -> station`
5. Dodaje wynik do listy `buses`.

## Oryginalny opis zapisany w kodzie

Each bus row ends with: ... <subst_id> "<station name>" <area> <zone> "" <flag> "".

## Przykład idei

Jeśli końcówka wiersza wygląda logicznie tak:

```text
... 45 "Kozienice" 1 1 "" 0 ""
```

to funkcja tworzy rekord:

```python
{"bus": 123, "subst": 45, "station": "Kozienice"}
```

I to jest dokładnie odpowiedź na pytanie:

```text
skąd program wie, że BUS 123 to Kozienice
```

Wie to z `bus data` w `EPC`, a nie z samego `MATPOWER`.
