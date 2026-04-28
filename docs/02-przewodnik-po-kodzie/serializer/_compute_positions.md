# `_compute_positions`

**Plik źródłowy:** `kse_grid\serializer.py`  
**Rodzaj:** funkcja pomocnicza

## Co robi

Liczy pozycje wszystkich busów w abstrakcyjnym układzie grafowym. Nie używa geometrii WGS84 - buduje layout logiczny na podstawie topologii sieci.

## Nagłówek funkcji

```python
def _compute_positions(net: pp.pandapowerNet) -> dict[int, tuple[float, float]]:
```

## Najważniejsza idea

Funkcja korzysta z `networkx.spring_layout`, ale nadaje połączeniom transformatorowym dużo większą wagę niż liniom. Dzięki temu szyny połączone trafem układają się blisko siebie, co lepiej oddaje stację z wieloma poziomami napięć.

## Co dzieje się w środku

1. tworzy graf topologii przez `create_nxgraph(...)`,
2. dodaje osierocone węzły, jeśli trzeba,
3. ustawia wagę linii na `1.0`,
4. ustawia wagę krawędzi trafo/trafo3w na `50.0`,
5. dzieli graf na spójne składowe,
6. dla każdej składowej liczy osobny `spring_layout`,
7. rozsuwa składowe offsetem, żeby się nie nakładały,
8. zwraca mapę `{bus_id: (x, y)}`.
