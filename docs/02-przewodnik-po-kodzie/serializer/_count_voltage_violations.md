# `_count_voltage_violations`

**Plik źródłowy:** `kse_grid\serializer.py`  
**Rodzaj:** funkcja pomocnicza

## Co robi

Liczy, ile busów ma napięcie poza pasmem dopuszczalnym `0.95-1.05 p.u.`.

## Nagłówek funkcji

```python
def _count_voltage_violations(net: pp.pandapowerNet) -> int:
```

## Jak działa

1. jeśli `net.res_bus` jest puste, zwraca `0`,
2. bierze kolumnę `vm_pu`,
3. odrzuca `NaN`,
4. liczy elementy spełniające:

```python
(vm < 0.95) | (vm > 1.05)
```
