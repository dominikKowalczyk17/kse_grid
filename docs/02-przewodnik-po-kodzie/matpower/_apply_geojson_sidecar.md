# `_apply_geojson_sidecar`


**Plik źródłowy:** `kse_grid\matpower.py`  
**Rodzaj:** funkcja  
**Linie w kodzie:** 137-190


## Co to jest


To jest funkcja pomocnicza lub główna o nazwie `_apply_geojson_sidecar`. Po nazwie widać, że odpowiada za fragment logiki związany z: **apply geojson sidecar**.

## Nagłówek funkcji


```python
def _apply_geojson_sidecar(net: pp.pandapowerNet, sidecar_path: Path) -> None:
```

## Argumenty


| Argument | Typ w kodzie | Wartość domyślna |
|---|---|---|
| `net` | `pp.pandapowerNet` | `brak` |
| `sidecar_path` | `Path` | `brak` |

## Co zwraca


Kod podpowiada, że funkcja zwraca: `None`.

## Co robi krok po kroku


1. Tworzy lub uzupełnia zmienne `payload` na podstawie wyniku funkcji `json.loads`.
2. Tworzy lub uzupełnia zmienne `features` na podstawie wyniku funkcji `payload.get`.
3. Sprawdza warunek i wybiera odpowiednią ścieżkę działania.
4. Przygotowuje zmienne pomocnicze: `id_lookup`.
5. Przygotowuje zmienne pomocnicze: `one_based_lookup`.
6. Przygotowuje zmienne pomocnicze: `name_lookup`.
7. Przygotowuje zmienne pomocnicze: `matched`.
8. Przygotowuje zmienne pomocnicze: `renamed`.
9. Przechodzi po kolejnych elementach i dla każdego wykonuje te same operacje.
10. Sprawdza warunek i wybiera odpowiednią ścieżkę działania.
11. Sprawdza warunek i wybiera odpowiednią ścieżkę działania.
