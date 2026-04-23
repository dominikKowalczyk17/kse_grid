# `_candidate_geo_sidecars`


**Plik źródłowy:** `kse_grid\matpower.py`  
**Rodzaj:** funkcja  
**Linie w kodzie:** 126-134


## Co to jest


To jest funkcja pomocnicza lub główna o nazwie `_candidate_geo_sidecars`. Po nazwie widać, że odpowiada za fragment logiki związany z: **candidate geo sidecars**.

## Nagłówek funkcji


```python
def _candidate_geo_sidecars(case_path: Path) -> list[Path]:
```

## Argumenty


| Argument | Typ w kodzie | Wartość domyślna |
|---|---|---|
| `case_path` | `Path` | `brak` |

## Co zwraca


Kod podpowiada, że funkcja zwraca: `list[Path]`.

## Co robi krok po kroku


1. Przygotowuje zmienne pomocnicze: `stem`.
2. Na końcu zwraca wynik: `[
        case_path.with_suffix(".geojson"),
        case_path.with_suffix(".json"),
        case_path.with_name(f"{stem}.wgs84.geojson"),
        case_path.with_name(f"{stem}_wgs84.geojson"),
        case_path.with_name(f"{stem}_geo.geojson"),
    ]`.
