# `_to_int`

**Plik źródłowy:** `kse_grid\serializer.py`  
**Rodzaj:** funkcja pomocnicza

## Co robi

Bezpiecznie zamienia wartość na `int`, ale tylko jeśli wygląda jak liczba całkowita albo string z liczbą całkowitą.

## Nagłówek funkcji

```python
def _to_int(value: object) -> int:
```

## Kiedy jest używana

Przede wszystkim przy pracy z indeksami busów, linii i transformatorów, które w `pandapower` mogą mieć typy numpy/pandas, a frontend i kod pomocniczy oczekują zwykłego `int`.

## Zachowanie

- dla `Integral` zwraca `int(value)`,
- dla stringa typu `"12"` też zwraca `12`,
- dla innych typów rzuca `TypeError`.
