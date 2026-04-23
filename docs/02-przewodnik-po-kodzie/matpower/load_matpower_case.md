# `load_matpower_case`


**Plik źródłowy:** `kse_grid\matpower.py`  
**Rodzaj:** funkcja  
**Linie w kodzie:** 13-21


## Co to jest


To jest funkcja pomocnicza lub główna o nazwie `load_matpower_case`. Po nazwie widać, że odpowiada za fragment logiki związany z: **load matpower case**.

## Nagłówek funkcji


```python
def load_matpower_case(case_file: str | Path, f_hz: int = 50) -> pp.pandapowerNet:
```

## Argumenty


| Argument | Typ w kodzie | Wartość domyślna |
|---|---|---|
| `case_file` | `str | Path` | `brak` |
| `f_hz` | `int` | `50` |

## Co zwraca


Kod podpowiada, że funkcja zwraca: `pp.pandapowerNet`.

## Co wchodzi

Najczęściej jedna z dwóch rzeczy:

1. sam plik `.m`,
2. plik `.m`, obok którego leży sidecar `.geojson`.

Przykłady:

```python
load_matpower_case("data/case3120sp.m")
load_matpower_case("data/case2746wop_TAMU_Updated.m")
```

Drugi przypadek jest ciekawszy, bo obok istnieje plik:

```text
data/case2746wop_TAMU_Updated.geojson
```

## Co wychodzi

Wyjściem jest `pandapowerNet`, ale ważne są też skutki uboczne na obiekcie:

- `net.name` = nazwa case'a bez rozszerzenia,
- `net._case_path` = pełna ścieżka do źródła,
- opcjonalnie `net._geo_source` = pełna ścieżka do użytego sidecara,
- nazwy elementów są uzupełnione,
- reference bus jest dopilnowany.

Przykład bez geometrii:

```python
net = load_matpower_case("data/case3120sp.m")
net.bus.loc[0, ["name", "vn_kv"]].to_dict()
# {'name': 'Bus 1', 'vn_kv': 220.0}
```

Przykład z geometrią:

```python
net = load_matpower_case("data/case2746wop_TAMU_Updated.m")
getattr(net, "_geo_source")
# '...\\data\\case2746wop_TAMU_Updated.geojson'

net.bus.loc[0, ["name", "geo"]].to_dict()
# {
#   'name': 'BEK Near Pajeczno 220 kV',
#   'geo': '{"type":"Point","coordinates":[19.1778,51.21298]}'
# }
```

## Co robi krok po kroku


1. Tworzy lub uzupełnia zmienne `case_path` na podstawie wyniku funkcji `Path(case_file).expanduser().resolve`.
2. Tworzy lub uzupełnia zmienne `net` na podstawie wyniku funkcji `_import_matpower_case`.
3. Przygotowuje zmienne pomocnicze: `net.name`.
4. Wywołuje funkcję `setattr`.
5. Wywołuje funkcję `_normalize_imported_net`.
6. Wywołuje funkcję `_load_geo_sidecar`.
7. Na końcu zwraca wynik: `net`.

## Oryginalny opis zapisany w kodzie

Ładuje przypadek MATPOWER (.m) do pandapower.
