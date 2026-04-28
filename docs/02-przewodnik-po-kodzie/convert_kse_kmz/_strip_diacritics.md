# `_strip_diacritics`

**Plik źródłowy:** `kse_grid\convert_kse_kmz.py`  
**Rodzaj:** funkcja

## Co robi

Usuwa znaki diakrytyczne z tekstu, np. zamienia `Łódź` na zapis bez akcentów. To przygotowanie pod późniejsze porównywanie nazw stacji z różnych źródeł.

## Nagłówek funkcji

```python
def _strip_diacritics(s: str) -> str:
```

## Co zwraca

Nowy string bez znaków diakrytycznych.

## Po co istnieje

Nazwy z KMZ i z EPC/TAMU mogą różnić się tylko zapisem polskich znaków. Bez tej normalizacji fuzzy matching dawałby dużo gorsze wyniki.
