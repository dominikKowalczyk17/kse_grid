# `KSEGrid.from_matpower_case`


**Plik źródłowy:** `kse_grid\grid.py`  
**Rodzaj:** metoda klasy `KSEGrid`  
**Linie w kodzie:** 32-38


## Co to jest


To jest metoda klasy `KSEGrid`. Po nazwie widać, że odpowiada za fragment logiki związany z: **from matpower case**.

## Nagłówek metody


```python
    def from_matpower_case(cls, case_file: str | Path, f_hz: int = 50) -> "KSEGrid":
```

## Argumenty


| Argument | Typ w kodzie | Wartość domyślna |
|---|---|---|
| `case_file` | `str | Path` | `brak` |
| `f_hz` | `int` | `50` |

## Co zwraca


Kod podpowiada, że metoda zwraca: `"KSEGrid"`.

## Co faktycznie dostaje na wejściu

Najczęściej zwykłą ścieżkę do pliku `.m`:

```python
grid = KSEGrid.from_matpower_case("data/case3120sp.m")
```

Metoda nie oczekuje jeszcze gotowego `pandapowerNet`. Sama woła `load_matpower_case(...)` i dopiero wynik wkłada do `grid.net`.

## Co faktycznie oddaje na wyjściu

Zwraca nowy obiekt `KSEGrid`, w którym:

- `grid.net` już istnieje,
- `grid.net.name` jest ustawione na stem pliku,
- `grid._runner` jest jeszcze `None`,
- `grid._converged` jest jeszcze `False`.

Przykład po wywołaniu:

```python
grid.net.name
# 'case3120sp'

len(grid.net.bus), len(grid.net.line), len(grid.net.trafo)
# (3120, 3487, 206)
```

## Co robi krok po kroku


1. Tworzy lub uzupełnia zmienne `grid` na podstawie wyniku funkcji `cls`.
2. Tworzy lub uzupełnia zmienne `grid.net` na podstawie wyniku funkcji `load_matpower_case`.
3. Wywołuje funkcję `print`.
4. Wywołuje funkcję `print`.
5. Na końcu zwraca wynik: `grid`.

## Oryginalny opis zapisany w kodzie

Tworzy KSEGrid z pliku MATPOWER (.m).
