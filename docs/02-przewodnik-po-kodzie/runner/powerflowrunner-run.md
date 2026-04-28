# `PowerFlowRunner.run`

**Plik źródłowy:** `kse_grid\runner.py`  
**Rodzaj:** metoda klasy `PowerFlowRunner`

## Co robi

Uruchamia load flow przez `pandapower.runpp`. Włącza obliczanie kątów napięć, używa `flat start` i zwraca tylko prostą odpowiedź logiczną: czy solver się zbiega.

## Nagłówek metody

```python
def run(
    self,
    algorithm: str = "nr",
    max_iteration: int = 100,
    tolerance_mva: float = 1.0,
) -> bool:
```

## Argumenty

| Argument | Znaczenie |
|---|---|
| `algorithm` | algorytm solvera, np. `nr` albo `iwamoto_nr` |
| `max_iteration` | limit iteracji |
| `tolerance_mva` | tolerancja zbieżności |

## Co zwraca

- `True` - jeśli `runpp(...)` zakończy się sukcesem,
- `False` - jeśli `pandapower` rzuci `LoadflowNotConverged`.

## Co dzieje się w środku

1. wywołuje `_RUNPP(...)`, domyślnie alias do `pp.runpp`,
2. przekazuje `calculate_voltage_angles=True`,
3. przekazuje `init="flat"`,
4. jeśli solver się nie zbiega, łapie wyjątek i drukuje komunikat zamiast wywalać cały program.

## Efekt uboczny

Po udanym wywołaniu `pandapower` wypełnia `net.res_*`, np. `net.res_bus`, `net.res_line`, `net.res_trafo`.
