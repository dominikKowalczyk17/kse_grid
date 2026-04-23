# `_compute_positions`


**Plik źródłowy:** `kse_grid\serializer.py`  
**Rodzaj:** funkcja  
**Linie w kodzie:** 73-104


## Co to jest


To jest funkcja pomocnicza lub główna o nazwie `_compute_positions`. Po nazwie widać, że odpowiada za fragment logiki związany z: **compute positions**.

## Nagłówek funkcji


```python
def _compute_positions(net: pp.pandapowerNet) -> dict[int, tuple[float, float]]:
```

## Argumenty


| Argument | Typ w kodzie | Wartość domyślna |
|---|---|---|
| `net` | `pp.pandapowerNet` | `brak` |

## Co zwraca


Kod podpowiada, że funkcja zwraca: `dict[int, tuple[float, float]]`.

## Co robi krok po kroku


1. Tworzy lub uzupełnia zmienne `graph` na podstawie wyniku funkcji `create_nxgraph`.
2. Przechodzi po kolejnych elementach i dla każdego wykonuje te same operacje.
3. Tworzy lub uzupełnia zmienne `components` na podstawie wyniku funkcji `list`.
4. Przygotowuje zmienną pomocniczą `positions`.
5. Przechodzi po kolejnych elementach i dla każdego wykonuje te same operacje.
6. Na końcu zwraca wynik: `positions`.

## Oryginalny opis zapisany w kodzie

Liczy pozycje szyn algorytmem spring layout (Fruchterman-Reingold) na grafie
topologii sieci. Geodane (`net.bus.geo`) są celowo ignorowane — siatka jest
renderowana jako abstrakcyjny graf, nie jako mapa.
