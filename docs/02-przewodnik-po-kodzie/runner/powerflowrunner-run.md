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

## Co robi krok po kroku


1. Próbuje wykonać operacje i reaguje na możliwe błędy.

## Oryginalny opis zapisany w kodzie

Uruchamia load flow z inicjalizacją AC (flat start: U=1 p.u., kąt=0°).
Zwraca True jeśli zbieżny, False jeśli nie.
