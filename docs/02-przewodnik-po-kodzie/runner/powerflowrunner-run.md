# `PowerFlowRunner.run`


**Plik źródłowy:** `kse_grid\runner.py`  
**Rodzaj:** metoda klasy `PowerFlowRunner`  
**Linie w kodzie:** 18-38


## Co to jest


To jest metoda klasy `PowerFlowRunner`. Po nazwie widać, że odpowiada za fragment logiki związany z: **run**.

## Nagłówek metody


```python
    def run(self,
            algorithm: str = "nr",
            max_iteration: int = 100,
            tolerance_mva: float = 1.0) -> bool:
```

## Argumenty


| Argument | Typ w kodzie | Wartość domyślna |
|---|---|---|
| `algorithm` | `str` | `"nr"` |
| `max_iteration` | `int` | `100` |
| `tolerance_mva` | `float` | `1.0` |

## Co zwraca


Kod podpowiada, że metoda zwraca: `bool`.

## Co wchodzi

Metoda dostaje:

- `self.net` - gotowy model `pandapowerNet`,
- nazwę algorytmu,
- limit iteracji,
- tolerancję mocy.

Typowe wywołanie w tym projekcie:

```python
runner.run(algorithm="iwamoto_nr", max_iteration=100, tolerance_mva=1.5)
```

## Co wychodzi

Z punktu widzenia Pythona wynik to tylko `True` albo `False`, ale ważniejsze są skutki w `self.net`:

- gdy wynik to `True`, pandapower zapisuje wyniki do `res_bus`, `res_line`, `res_trafo`,
- gdy wynik to `False`, metoda łapie `LoadflowNotConverged`, drukuje komunikat i nie przerywa programu wyjątkiem.

Przykład:

```python
ok = runner.run(algorithm="iwamoto_nr", max_iteration=100, tolerance_mva=1.5)
ok
# True

runner.net.res_bus.loc[0, ["vm_pu", "va_degree"]].to_dict()
# {'vm_pu': 1.0535466794624884, 'va_degree': -2.543403484847102}
```

## Co robi krok po kroku


1. Próbuje wykonać operacje i reaguje na możliwe błędy.

## Oryginalny opis zapisany w kodzie

Uruchamia load flow z inicjalizacją AC (flat start: U=1 p.u., kąt=0°).
Zwraca True jeśli zbieżny, False jeśli nie.
