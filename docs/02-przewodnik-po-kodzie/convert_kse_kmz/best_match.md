# `best_match`

**Plik źródłowy:** `kse_grid\convert_kse_kmz.py`  
**Rodzaj:** funkcja

## Co robi

Szuka najlepszego dopasowania nazwy stacji w katalogu z KMZ. Najpierw próbuje idealnego trafienia, potem `difflib`, a na końcu prosty fallback oparty o wspólne tokeny.

## Nagłówek funkcji

```python
def best_match(
    query: str,
    catalogue: dict[str, tuple[float, float, str]],
    cutoff: float = 0.86,
):
```

## Kolejność dopasowania

1. **exact match** - jeśli `query` jest dokładnym kluczem w katalogu,
2. **fuzzy match** - `difflib.get_close_matches(...)`,
3. **token overlap fallback** - porównanie nakładania się zbiorów tokenów.

## Co zwraca

Jeśli znajdzie dopasowanie, zwraca trójkę w stylu:

```python
((lon, lat, raw_name), matched_key, score)
```

Jeśli nie znajdzie nic sensownego, zwraca `None`.

## Po co fallback tokenowy

Przy krótkich nazwach `difflib` bywa zbyt restrykcyjny. Token overlap pozwala jeszcze wyłapać przypadki, gdzie część słów się zgadza, ale zapis jest inny niż w atlasie.
