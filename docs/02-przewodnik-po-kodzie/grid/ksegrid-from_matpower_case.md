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

## Co robi krok po kroku


1. Tworzy lub uzupełnia zmienne `grid` na podstawie wyniku funkcji `cls`.
2. Tworzy lub uzupełnia zmienne `grid.net` na podstawie wyniku funkcji `load_matpower_case`.
3. Wywołuje funkcję `print`.
4. Wywołuje funkcję `print`.
5. Na końcu zwraca wynik: `grid`.

## Oryginalny opis zapisany w kodzie

Tworzy KSEGrid z pliku MATPOWER (.m).
