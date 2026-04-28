# `_serialize_trafos`

**Plik źródłowy:** `kse_grid\serializer.py`  
**Rodzaj:** funkcja pomocnicza

## Co robi

Serializuje transformatory do prostych słowników JSON używanych przez frontend.

## Nagłówek funkcji

```python
def _serialize_trafos(net: pp.pandapowerNet, has_results: bool) -> list[dict[str, Any]]:
```

## Co trafia do pojedynczego transformatora

- `id`,
- `name`,
- `hvBus`, `lvBus`,
- `vnHvKv`, `vnLvKv`,
- `snMva`,
- opcjonalnie `loading`, `pHvMw`.

## Jak działa

1. iteruje po `net.trafo`,
2. przepisuje dane znamionowe i połączenia HV/LV,
3. jeśli są wyniki load flow, dopina obciążenie i moc po stronie HV,
4. jeśli wyników nie ma, wpisuje `loading = 0.0`.
