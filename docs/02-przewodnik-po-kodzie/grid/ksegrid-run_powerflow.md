# `KSEGrid.run_powerflow`

**Plik źródłowy:** `kse_grid\grid.py`  
**Rodzaj:** metoda klasy `KSEGrid`

## Co robi

Uruchamia obliczenia load flow dla już załadowanej sieci. Sama nie liczy rozpływu bezpośrednio - tworzy `PowerFlowRunner`, deleguje do niego solver i zapamiętuje, czy obliczenia się zbiegły.

## Nagłówek metody

```python
def run_powerflow(
    self,
    algorithm: str = "iwamoto_nr",
    max_iteration: int = 100,
    tolerance_mva: float = 1.5,
) -> "KSEGrid":
```

## Argumenty

| Argument | Znaczenie |
|---|---|
| `algorithm` | nazwa algorytmu przekazywana do `pandapower.runpp` |
| `max_iteration` | maksymalna liczba iteracji solvera |
| `tolerance_mva` | tolerancja zbieżności w MVA |

## Co zwraca

Ten sam obiekt `KSEGrid` (`self`), więc można łańcuchować wywołania.

## Co dzieje się w środku

1. sprawdza, czy `self.net` istnieje,
2. tworzy `self._runner = PowerFlowRunner(self.net)`,
3. wywołuje `self._runner.run(...)`,
4. zapisuje wynik logiczny do `self._converged`,
5. zwraca `self`.

## Efekt uboczny

Jeśli solver się zbiegnie, `pandapower` wypełnia tabele wynikowe `net.res_bus`, `net.res_line`, `net.res_trafo` i inne `res_*`. To właśnie te dane potem trafiają do `report()` i do dashboardu.
