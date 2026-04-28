# `main`

**Plik źródłowy:** `kse_grid\convert_tamu_geo.py`  
**Rodzaj:** funkcja CLI

## Co robi

To wejście dla prostszego konwertera TAMU:

```text
EPC -> GeoJSON sidecar
```

Czyta argumenty z linii poleceń, wybiera ścieżkę wyjściową, uruchamia `convert(...)` i wypisuje krótkie statystyki.

## Nagłówek funkcji

```python
def main() -> None:
```

## Co dzieje się w środku

1. tworzy parser CLI,
2. przyjmuje ścieżkę do `EPC`,
3. opcjonalnie przyjmuje `--out`,
4. jeśli `--out` nie podano, używa `<stem>.geojson`,
5. wywołuje `convert(...)`,
6. drukuje liczbę stacji, busów i dopasowanych punktów.

## Kiedy używać

Ta wersja jest dobra, gdy wystarcza geometria ze środków stacji zapisanych w EPC. Jeśli chcesz lepsze dopasowanie do atlasu KSE, użyj `convert_kse_kmz.py`.
