# `_status`

**Plik źródłowy:** `kse_grid\serializer.py`  
**Rodzaj:** funkcja pomocnicza

## Co robi

Mapuje liczbę na prostą klasę jakości:

- `good`,
- `warn`,
- `bad`.

## Nagłówek funkcji

```python
def _status(value: float, warn: float, bad: float) -> str:
```

## Reguła

1. jeśli `value >= bad`, zwraca `bad`,
2. w przeciwnym razie jeśli `value >= warn`, zwraca `warn`,
3. w przeciwnym razie zwraca `good`.

## Po co istnieje

To wspólny helper dla statystyk napięć, przeciążeń i ogólnego stanu obciążenia. Dzięki temu backend w jednym miejscu decyduje o klasie alarmu, a frontend tylko ją pokazuje.
