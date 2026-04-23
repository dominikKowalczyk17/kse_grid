# `_parse_buses`


**Plik źródłowy:** `kse_grid\convert_tamu_geo.py`  
**Rodzaj:** funkcja  
**Linie w kodzie:** 73-102


## Co to jest


To jest funkcja pomocnicza lub główna o nazwie `_parse_buses`. Po nazwie widać, że odpowiada za fragment logiki związany z: **parse buses**.

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

## Co robi krok po kroku


1. Przygotowuje zmienną pomocniczą `buses`.
2. Przechodzi po kolejnych elementach i dla każdego wykonuje te same operacje.
3. Na końcu zwraca wynik: `buses`.

## Oryginalny opis zapisany w kodzie

Each bus row ends with: ... <subst_id> "<station name>" <area> <zone> "" <flag> "".
