# `KSEGrid.from_matpower_case`

**Plik źródłowy:** `kse_grid\grid.py`  
**Rodzaj:** metoda klasowa klasy `KSEGrid`

## Co robi

To jest główna brama wejściowa do projektu. Tworzy nowy obiekt `KSEGrid`, ładuje plik MATPOWER `.m` przez `load_matpower_case(...)`, zapisuje wynik do `grid.net` i wypisuje krótki komunikat z liczbą szyn, linii i transformatorów.

## Nagłówek metody

```python
@classmethod
def from_matpower_case(cls, case_file: str | Path, f_hz: int = 50) -> "KSEGrid":
```

## Argumenty

| Argument | Znaczenie |
|---|---|
| `case_file` | ścieżka do pliku MATPOWER `.m` |
| `f_hz` | częstotliwość sieci przekazywana do importera `pandapower` |

## Co zwraca

Nowy obiekt `KSEGrid` z uzupełnionym polem `net`.

## Co dzieje się w środku

1. tworzy pusty obiekt `grid = cls()`,
2. ładuje przypadek przez `load_matpower_case(...)`,
3. zapisuje wynik do `grid.net`,
4. wypisuje nazwę modelu i liczność elementów,
5. zwraca gotowy obiekt.

## Typowe użycie

```python
grid = KSEGrid.from_matpower_case("data/case3120sp.m")
```

Po tym kroku można już wywołać `run_powerflow()`, `report()` albo `serve()`.
