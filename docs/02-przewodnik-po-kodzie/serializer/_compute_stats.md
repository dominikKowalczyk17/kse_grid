# `_compute_stats`


**Plik źródłowy:** `kse_grid\serializer.py`  
**Rodzaj:** funkcja  
**Linie w kodzie:** 319-334


## Co to jest


To jest funkcja pomocnicza lub główna o nazwie `_compute_stats`. Po nazwie widać, że odpowiada za fragment logiki związany z: **compute stats**.

## Nagłówek funkcji


```python
def _compute_stats(net: pp.pandapowerNet) -> dict[str, Any]:
```

## Argumenty


| Argument | Typ w kodzie | Wartość domyślna |
|---|---|---|
| `net` | `pp.pandapowerNet` | `brak` |

## Co zwraca


Kod podpowiada, że funkcja zwraca: `dict[str, Any]`.

## Co robi krok po kroku


1. Tworzy lub uzupełnia zmienne `max_loading` na podstawie wyniku funkcji `_max_loading`.
2. Tworzy lub uzupełnia zmienne `n_viol` na podstawie wyniku funkcji `_count_voltage_violations`.
3. Tworzy lub uzupełnia zmienne `n_overload` na podstawie wyniku funkcji `_count_overloads`.
4. Na końcu zwraca wynik: `{
        "nBus": int(len(net.bus)),
        "nLine": int(len(net.line)),
        "nTrafo": int(len(net.trafo)),
        "nGen": int(len(net.gen)),
        "maxLoading": f"{max_loading:.1f}%",
        "loadClass": _status(max_loading, _LOAD_WARN_PCT, _LOAD_BAD_PCT),
        "nViol": n_viol,
        "violClass": _status(float(n_viol), 1.0, 5.0),
        "nOverload": n_overload,
        "ovlClass": _status(float(n_overload), 1.0, 5.0),
    }`.
