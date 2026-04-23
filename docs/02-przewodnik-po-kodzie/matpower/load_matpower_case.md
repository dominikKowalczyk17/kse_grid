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
