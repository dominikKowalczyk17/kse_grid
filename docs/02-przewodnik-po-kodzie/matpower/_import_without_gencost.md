# `_import_without_gencost`


**Plik źródłowy:** `kse_grid\matpower.py`  
**Rodzaj:** funkcja  
**Linie w kodzie:** 33-50


## Co to jest


To jest funkcja pomocnicza lub główna o nazwie `_import_without_gencost`. Po nazwie widać, że odpowiada za fragment logiki związany z: **import without gencost**.

## Nagłówek funkcji


```python
def _import_without_gencost(case_path: Path, f_hz: int) -> pp.pandapowerNet:
```

## Argumenty


| Argument | Typ w kodzie | Wartość domyślna |
|---|---|---|
| `case_path` | `Path` | `brak` |
| `f_hz` | `int` | `brak` |

## Co zwraca


Kod podpowiada, że funkcja zwraca: `pp.pandapowerNet`.

## Co robi krok po kroku


1. Tworzy lub uzupełnia zmienne `text` na podstawie wyniku funkcji `case_path.read_text`.
2. Tworzy lub uzupełnia zmienne `stripped, replacements` na podstawie wyniku funkcji `re.subn`.
3. Sprawdza warunek i wybiera odpowiednią ścieżkę działania.
4. Otwiera zasób pomocniczy i wykonuje na nim operacje tylko w tym bloku.
5. Próbuje wykonać operacje i reaguje na możliwe błędy.
