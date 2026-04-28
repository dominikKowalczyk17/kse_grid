# `_to_ascii`


**Plik źródłowy:** `kse_grid\matpower.py`  
**Rodzaj:** funkcja  
**Linie w kodzie:** 201-207


## Co to jest

`_to_ascii(text)` zamienia tekst na ASCII bez polskich znaków i innych diakrytyków.
## Nagłówek funkcji


```python
def _to_ascii(text: str) -> str:
```

## Argumenty


| Argument | Typ w kodzie | Wartość domyślna |
|---|---|---|
| `text` | `str` | `brak` |

## Co zwraca


Kod podpowiada, że funkcja zwraca: `str`.

## Przykład:

- Łódź -> Lodz
- Pątnów -> Patnow

Najpierw robi ręczne podmiany z _ASCII_FALLBACK, potem normalizację Unicode i usuwa znaki diakrytyczne.

Po co: żeby nazwy z GeoJSON i z case'a łatwiej było porównywać i czyściej wyświetlać.
