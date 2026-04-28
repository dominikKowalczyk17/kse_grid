# `_serialize_buses`

**Plik źródłowy:** `kse_grid\serializer.py`  
**Rodzaj:** funkcja pomocnicza

## Co robi

Zamienia tabelę `net.bus` oraz powiązane wyniki na listę prostych słowników JSON opisujących szyny.

## Nagłówek funkcji

```python
def _serialize_buses(
    net: pp.pandapowerNet,
    positions: dict[int, tuple[float, float]],
    geo_positions: dict[int, tuple[float, float]],
    has_results: bool,
) -> list[dict[str, Any]]:
```

## Co trafia do pojedynczego busa

Każdy element listy zawiera m.in.:

- `id`,
- `name`,
- `type` (`Slack` / `PV` / `PQ`),
- `vn_kv`,
- `x`, `y`,
- `loadMw`, `loadMvar`, `genMw`,
- opcjonalnie `lon`, `lat`,
- opcjonalnie `vmPu`, `vaDeg`, `genMvar`.

## Jak działa

1. buduje zbiory busów slack i generatorowych,
2. iteruje po wszystkich szynach,
3. przypisuje pozycję grafową,
4. sumuje obciążenia i generację przypięte do danej szyny,
5. ustala typ busa,
6. jeśli istnieje geometria, dopina `lon/lat`,
7. jeśli istnieją wyniki load flow, dopina napięcie, kąt i moc bierną generatorów.
