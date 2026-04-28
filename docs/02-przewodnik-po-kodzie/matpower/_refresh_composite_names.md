# `_refresh_composite_names`


**Plik źródłowy:** `kse_grid\matpower.py`  
**Rodzaj:** funkcja  
**Linie w kodzie:** 220-235


## Co to jest

`_refresh_composite_names(net)` odświeża nazwy linii i traf po zmianie nazw busów.

## Nagłówek funkcji


```python
def _refresh_composite_names(net: pp.pandapowerNet) -> None:
```

## Argumenty


| Argument | Typ w kodzie | Wartość domyślna |
|---|---|---|
| `net` | `pp.pandapowerNet` | `brak` |

## Co zwraca


Kod podpowiada, że funkcja zwraca: `None`.

## Co robi krok po kroku

To ważne, bo wcześniej linia mogła mieć nazwę:

   - Line 5: Bus 12 -> Bus 48

a po dopasowaniu stacji powinna mieć:

   - Line 5: Kielce 220 kV -> Radom 220 kV

Ale funkcja zmienia tylko nazwy domyślne/generowane automatycznie.
Jeśli nazwa była własna i sensowna, zostawia ją.
