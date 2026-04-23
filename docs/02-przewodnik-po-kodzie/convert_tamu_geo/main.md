# `main`


**Plik źródłowy:** `kse_grid\convert_tamu_geo.py`  
**Rodzaj:** funkcja  
**Linie w kodzie:** 152-163


## Co to jest


To jest funkcja pomocnicza lub główna o nazwie `main`. Po nazwie widać, że odpowiada za fragment logiki związany z: **main**.

## Nagłówek funkcji


```python
def main() -> None:
```

## Argumenty


Ta funkcja nie przyjmuje własnych argumentów roboczych.

## Co zwraca


Kod podpowiada, że funkcja zwraca: `None`.

## Co robi krok po kroku


1. Tworzy lub uzupełnia zmienne `parser` na podstawie wyniku funkcji `argparse.ArgumentParser`.
2. Wywołuje funkcję `parser.add_argument`.
3. Wywołuje funkcję `parser.add_argument`.
4. Tworzy lub uzupełnia zmienne `args` na podstawie wyniku funkcji `parser.parse_args`.
5. Przygotowuje zmienne pomocnicze: `out`.
6. Tworzy lub uzupełnia zmienne `stats` na podstawie wyniku funkcji `convert`.
7. Wywołuje funkcję `print`.
