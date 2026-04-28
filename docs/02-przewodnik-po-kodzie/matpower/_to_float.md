# `_to_float`


**Plik źródłowy:** `kse_grid\matpower.py`  
**Rodzaj:** funkcja  
**Linie w kodzie:** 287-294


## Co to jest

`_to_float(value)` zamienia wartość na float.

## Nagłówek funkcji


```python
def _to_float(value: object) -> float:
```

## Argumenty


| Argument | Typ w kodzie | Wartość domyślna |
|---|---|---|
| `value` | `object` | `brak` |

## Co zwraca


Kod podpowiada, że funkcja zwraca: `float`.

## Obsługuje:

   - liczby rzeczywiste
   - bool
   - string typu "220.0"

  Jak nie pasuje, rzuca TypeError.

Po co: bezpieczne czytanie:
- współrzędnych lon/lat
- napięć vn_kv
- innych pól liczbowych
