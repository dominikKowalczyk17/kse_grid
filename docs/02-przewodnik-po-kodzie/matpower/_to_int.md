# `_to_int`


**Plik źródłowy:** `kse_grid\matpower.py`  
**Rodzaj:** funkcja  
**Linie w kodzie:** 279-284


## Co to jest

`_to_int(value)` zamienia wartość na int, ale tylko jeśli wygląda jak liczba całkowita.

## Nagłówek funkcji


```python
def _to_int(value: object) -> int:
```

## Argumenty


| Argument | Typ w kodzie | Wartość domyślna |
|---|---|---|
| `value` | `object` | `brak` |

## Co zwraca


Kod podpowiada, że funkcja zwraca: `int`.

## Obsługuje:

   - int
   - inne typy całkowite
   - string typu "12"

  Jak nie pasuje, rzuca TypeError.

  Po co: bezpieczne wyciąganie indeksów busów/linii/traf z tabel pandapower.
