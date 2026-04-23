# `_clean_station_name`


**Plik źródłowy:** `kse_grid\matpower.py`  
**Rodzaj:** funkcja  
**Linie w kodzie:** 210-217


## Co to jest


To jest funkcja pomocnicza lub główna o nazwie `_clean_station_name`. Po nazwie widać, że odpowiada za fragment logiki związany z: **clean station name**.

## Nagłówek funkcji


```python
def _clean_station_name(raw: object) -> str:
```

## Argumenty


| Argument | Typ w kodzie | Wartość domyślna |
|---|---|---|
| `raw` | `object` | `brak` |

## Co zwraca


Kod podpowiada, że funkcja zwraca: `str`.

## Co robi krok po kroku


1. Sprawdza warunek i wybiera odpowiednią ścieżkę działania.
2. Tworzy lub uzupełnia zmienne `text` na podstawie wyniku funkcji `_STATION_PREFIX_RE.sub`.
3. Tworzy lub uzupełnia zmienne `text` na podstawie wyniku funkcji `_STATION_NOISE_RE.sub`.
4. Tworzy lub uzupełnia zmienne `text` na podstawie wyniku funkcji `_to_ascii`.
5. Tworzy lub uzupełnia zmienne `text` na podstawie wyniku funkcji `re.sub(r"\s+", " ", text).strip`.
6. Na końcu zwraca wynik: `text`.
