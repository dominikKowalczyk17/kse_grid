# `runner.py`

To jest warstwa obliczeniowa. Bierze już załadowany `pandapowerNet`, uruchamia load flow i umie pokazać wynik w formie tekstowej.

## Co wchodzi, co wychodzi

| Operacja | Wejście | Wyjście |
|---|---|---|
| `PowerFlowRunner.run(...)` | `pandapowerNet` + parametry solvera | `True` / `False` oraz uzupełnione `net.res_*` |
| `PowerFlowRunner.summary()` | `pandapowerNet` po obliczeniach | raport tekstowy do terminala |
| `PowerFlowRunner.voltage_violations()` | `pandapowerNet` po obliczeniach | `DataFrame` z szynami poza pasmem 0.95-1.05 p.u. |

## Realny przykład z repo

```python
from kse_grid.matpower import load_matpower_case
from kse_grid.runner import PowerFlowRunner

net = load_matpower_case("data/case3120sp.m")
runner = PowerFlowRunner(net)
ok = runner.run(algorithm="iwamoto_nr", max_iteration=100, tolerance_mva=1.5)
```

Przykładowy stan po obliczeniach:

```python
ok
# True

net.res_bus.loc[0, ["vm_pu", "va_degree"]].to_dict()
# {'vm_pu': 1.0535466794624884, 'va_degree': -2.543403484847102}

len(runner.voltage_violations())
# 1610
```

## Pliki w tym katalogu

- [`PowerFlowRunner.__init__`](powerflowrunner-__init__.md)
- [`klasa PowerFlowRunner`](powerflowrunner-klasa.md)
- [`PowerFlowRunner.run`](powerflowrunner-run.md)
- [`PowerFlowRunner.summary`](powerflowrunner-summary.md)
- [`PowerFlowRunner.voltage_violations`](powerflowrunner-voltage_violations.md)
