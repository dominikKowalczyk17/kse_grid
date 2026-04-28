# `_count_overloads`

**Plik źródłowy:** `kse_grid\serializer.py`  
**Rodzaj:** funkcja pomocnicza

## Co robi

Liczy łączną liczbę przeciążonych gałęzi: linii i transformatorów.

## Nagłówek funkcji

```python
def _count_overloads(net: pp.pandapowerNet) -> int:
```

## Jak działa

1. zaczyna od `0`,
2. jeśli są wyniki dla linii, dodaje liczbę przypadków z `loading_percent > _OVERLOAD_PCT`,
3. jeśli są wyniki dla traf, robi to samo dla `net.res_trafo`,
4. zwraca sumę.

## Ważne

W tym module `_OVERLOAD_PCT` jest ustawione na `150.0`, więc przeciążenie oznacza przekroczenie 150% obciążenia znamionowego.
