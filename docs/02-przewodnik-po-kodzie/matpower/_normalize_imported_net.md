# `_normalize_imported_net`

**Plik źródłowy:** `kse_grid\matpower.py`  
**Rodzaj:** funkcja pomocnicza

## Co robi

Porządkuje świeżo zaimportowaną sieć. Uzupełnia brakujące nazwy busów, linii i transformatorów, a na końcu pilnuje, żeby istniał aktywny bus odniesienia.

## Nagłówek funkcji

```python
def _normalize_imported_net(net: pp.pandapowerNet):
```

## Co dzieje się w środku

1. dla pustych nazw busów wpisuje `Bus N`,
2. dla pustych nazw linii wpisuje `Line N: from -> to`,
3. dla pustych nazw transformatorów wpisuje `Trafo N: hv -> lv`,
4. wywołuje `_ensure_reference_bus(net)`.

## Po co istnieje

Po imporcie z MATPOWER część nazw bywa pusta albo nieczytelna. Bez tej normalizacji tooltipy, raporty i listy w UI miałyby dużo gorszą jakość.
