# `_candidate_geo_sidecars`


**Plik źródłowy:** `kse_grid\matpower.py`  
**Rodzaj:** funkcja  
**Linie w kodzie:** 126-134


## Co to jest
`_candidate_geo_sidecars(case_path)` generuje listę nazw plików, których loader szuka obok case'a.

  Dla case2746wop.m sprawdzi kolejno np.:

   1. case2746wop.geojson
   2. case2746wop.json
   3. case2746wop.wgs84.geojson
   4. case2746wop_wgs84.geojson
   5. case2746wop_geo.geojson

  Po co: różne konwertery i datasety dają różne nazwy plików, więc loader obsługuje kilka wariantów.
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
