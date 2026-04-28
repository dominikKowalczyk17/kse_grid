# `_safe_float`

**Plik źródłowy:** `kse_grid\serializer.py`  
**Rodzaj:** funkcja pomocnicza

## Co robi

Próbuje zamienić wartość na `float`, ale zamiast rzucać wyjątek przy problemie zwraca `None`.

## Nagłówek funkcji

```python
def _safe_float(value: Any) -> float | None:
```

## Zachowanie

- obsługuje `bool`, liczby rzeczywiste i stringi z liczbą,
- odrzuca wartości nienumeryczne,
- odrzuca też `NaN` i `inf`,
- przy błędzie zwraca `None`.

## Kiedy jest używana

Tam, gdzie brak liczby nie musi zatrzymywać programu, np. przy czytaniu geometrii, napięć albo obciążeń z częściowo niekompletnych danych.
