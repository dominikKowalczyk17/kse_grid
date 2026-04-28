# `normalize_name`

**Plik źródłowy:** `kse_grid\convert_kse_kmz.py`  
**Rodzaj:** funkcja

## Co robi

Przekształca surową nazwę stacji do uproszczonego klucza tekstowego używanego przy dopasowaniu. Usuwa prefiksy liczbowe i skrótowe kody, wycina słowa-szum i sprowadza wszystko do małych liter ASCII.

## Nagłówek funkcji

```python
def normalize_name(name: str) -> str:
```

## Co dzieje się w środku

1. obcina spacje,
2. usuwa prefiks typu `1 BEK ...`,
3. usuwa końcowy kod typu `... RO`,
4. usuwa diakrytyki,
5. zamienia na małe litery,
6. rozbija tekst na tokeny,
7. usuwa tokeny-szum, np. `stacja`, `gpz`, `near`, `north`,
8. skleja wynik z powrotem do jednego klucza.

## Przykład

Nazwa:

```text
1 BEK Stacja Bełchatów RO
```

po normalizacji staje się kluczem zbliżonym do:

```text
belchatow
```
