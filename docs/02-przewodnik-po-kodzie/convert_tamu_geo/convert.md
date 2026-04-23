# `convert`


**Plik źródłowy:** `kse_grid\convert_tamu_geo.py`  
**Rodzaj:** funkcja  
**Linie w kodzie:** 105-149


## Co to jest


To jest funkcja pomocnicza lub główna o nazwie `convert`. Po nazwie widać, że odpowiada za fragment logiki związany z: **convert**.

## Nagłówek funkcji


```python
def convert(epc_path: Path, out_path: Path) -> dict:
```

## Argumenty


| Argument | Typ w kodzie | Wartość domyślna |
|---|---|---|
| `epc_path` | `Path` | `brak` |
| `out_path` | `Path` | `brak` |

## Co zwraca


Kod podpowiada, że funkcja zwraca: `dict`.

## Co robi krok po kroku


1. Tworzy lub uzupełnia zmienne `text` na podstawie wyniku funkcji `epc_path.read_text`.
2. Przygotowuje zmienną pomocniczą `subs`.
3. Przygotowuje zmienną pomocniczą `buses`.
4. Przechodzi po kolejnych elementach i dla każdego wykonuje te same operacje.
5. Sprawdza warunek i wybiera odpowiednią ścieżkę działania.
6. Sprawdza warunek i wybiera odpowiednią ścieżkę działania.
7. Przygotowuje zmienne pomocnicze: `features`.
8. Przygotowuje zmienne pomocnicze: `matched`.
9. Przechodzi po kolejnych elementach i dla każdego wykonuje te same operacje.
10. Przygotowuje zmienne pomocnicze: `fc`.
11. Wywołuje funkcję `out_path.write_text`.
12. Na końcu zwraca wynik: `{"buses": len(buses), "substations": len(subs), "matched": matched, "out": str(out_path)}`.
