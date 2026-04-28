# `_to_float`

**Plik źródłowy:** `kse_grid\serializer.py`  
**Rodzaj:** funkcja pomocnicza

## Co robi

Zamienia wartość na `float`, ale w odróżnieniu od `_safe_float(...)` nie pozwala na ciche niepowodzenie. Jeśli konwersja się nie uda, rzuca `TypeError`.

## Nagłówek funkcji

```python
def _to_float(value: object) -> float:
```

## Jak działa

1. woła `_safe_float(value)`,
2. jeśli wynik jest `None`, zgłasza błąd,
3. w przeciwnym razie zwraca liczbę zmiennoprzecinkową.

## Kiedy jest używana

Tam, gdzie dana liczba jest wymagana i jej brak oznacza błąd danych, np. przy `vn_kv`, `length_km` albo `sn_mva`.
