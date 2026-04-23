# `KSEGrid.run_powerflow`


**Plik źródłowy:** `kse_grid\grid.py`  
**Rodzaj:** metoda klasy `KSEGrid`  
**Linie w kodzie:** 41-50


## Co to jest


To jest metoda klasy `KSEGrid`. Po nazwie widać, że odpowiada za fragment logiki związany z: **run powerflow**.

## Nagłówek metody


```python
    def run_powerflow(self,
                      algorithm: str = "iwamoto_nr",
                      max_iteration: int = 100,
                      tolerance_mva: float = 1.5) -> "KSEGrid": ## w PSE 1.5 MWA jest akceptowalne
```

## Argumenty


| Argument | Typ w kodzie | Wartość domyślna |
|---|---|---|
| `algorithm` | `str` | `"iwamoto_nr"` |
| `max_iteration` | `int` | `100` |
| `tolerance_mva` | `float` | `1.5` |

## Co zwraca


Kod podpowiada, że metoda zwraca: `"KSEGrid"`.

## Co dostaje na wejściu

Ta metoda zakłada, że wcześniej wykonano:

```python
grid = KSEGrid.from_matpower_case("data/case3120sp.m")
```

Na wejściu ma więc:

- `self.net` - gotowy model `pandapowerNet`,
- parametry solvera, np. `algorithm="iwamoto_nr"`.

## Co zmienia i co oddaje

Metoda **nie tworzy nowego obiektu**. Zwraca `self`, ale po drodze zmienia stan:

- tworzy `self._runner = PowerFlowRunner(self.net)`,
- ustawia `self._converged` na wynik `True` albo `False`,
- jeśli solver się zbiegnie, zapełnia `self.net.res_bus`, `self.net.res_line`, `self.net.res_trafo`.

Przykład:

```python
grid = KSEGrid.from_matpower_case("data/case3120sp.m").run_powerflow()

grid._converged
# True

grid.net.res_bus.loc[0, ["vm_pu", "va_degree"]].to_dict()
# {'vm_pu': 1.0535466794624884, 'va_degree': -2.543403484847102}
```

## Co robi krok po kroku


1. Sprawdza warunek i wybiera odpowiednią ścieżkę działania.
2. Tworzy lub uzupełnia zmienne `self._runner` na podstawie wyniku funkcji `PowerFlowRunner`.
3. Tworzy lub uzupełnia zmienne `self._converged` na podstawie wyniku funkcji `self._runner.run`.
4. Na końcu zwraca wynik: `self`.

## Oryginalny opis zapisany w kodzie

Uruchamia obliczenia load flow (opcjonalnie, wzbogaca wizualizację).
