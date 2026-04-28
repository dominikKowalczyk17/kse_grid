# `_ensure_reference_bus`


**Plik źródłowy:** `kse_grid\matpower.py`  
**Rodzaj:** funkcja  
**Linie w kodzie:** 78-114


## Co to jest


`ensure_reference_bus(net)` - pilnuje, żeby sieć miała punkt odniesienia/slack, bo bez tego load flow może się nie policzyć.

## Nagłówek funkcji


```python
def _ensure_reference_bus(net: pp.pandapowerNet) -> None:
```

## Argumenty


| Argument | Typ w kodzie | Wartość domyślna |
|---|---|---|
| `net` | `pp.pandapowerNet` | `brak` |

## Logika:

1. sprawdza, czy już istnieje aktywny ext_grid
2. albo aktywny generator z slack=True
3. jeśli tak, nic nie robi

Jeśli nie ma reference bus:

1. bierze pierwszy ext_grid, którego bus jest aktywny, i ustawia mu in_service=True
2. jeśli nie ma sensownego ext_grid, bierze pierwszy aktywny generator:
   - ustawia in_service=True
   - ustawia slack=True
   - jeśli jest kolumna slack_weight i jest pusta, daje 1.0