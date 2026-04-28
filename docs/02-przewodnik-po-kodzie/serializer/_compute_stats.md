# `_compute_stats`

**Plik źródłowy:** `kse_grid\serializer.py`  
**Rodzaj:** funkcja pomocnicza

## Co robi

Buduje mały blok statystyk ogólnych używany w dashboardzie. To szybkie podsumowanie liczności sieci i najważniejszych alarmów.

## Nagłówek funkcji

```python
def _compute_stats(net: pp.pandapowerNet) -> dict[str, Any]:
```

## Co zwraca

Słownik z polami:

- `nBus`, `nLine`, `nTrafo`, `nGen`,
- `maxLoading`,
- `loadClass`,
- `nViol`, `violClass`,
- `nOverload`, `ovlClass`.

## Skąd bierze dane

Korzysta z helperów:

- `_max_loading(...)`,
- `_count_voltage_violations(...)`,
- `_count_overloads(...)`,
- `_status(...)`.

## Po co klasy `good/warn/bad`

Frontend może od razu pokolorować kafelki diagnostyczne bez powtarzania tej logiki po stronie JavaScript.
