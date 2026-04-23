# `main`


**Plik źródłowy:** `kse_grid\convert_kse_kmz.py`  
**Rodzaj:** funkcja  
**Linie w kodzie:** 119-188


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
4. Wywołuje funkcję `parser.add_argument`.
5. Wywołuje funkcję `parser.add_argument`.
6. Tworzy lub uzupełnia zmienne `args` na podstawie wyniku funkcji `parser.parse_args`.
7. Tworzy lub uzupełnia zmienne `catalogue` na podstawie wyniku funkcji `parse_kmz`.
8. Wywołuje funkcję `print`.
9. Tworzy lub uzupełnia zmienne `text` na podstawie wyniku funkcji `args.epc.read_text`.
10. Przygotowuje zmienną pomocniczą `subs`.
11. Przygotowuje zmienną pomocniczą `buses`.
12. Przechodzi po kolejnych elementach i dla każdego wykonuje te same operacje.
13. Wywołuje funkcję `print`.
14. Przygotowuje zmienne pomocnicze: `features`.
15. Przygotowuje zmienne pomocnicze: `matched_kmz`.
16. Przygotowuje zmienne pomocnicze: `matched_epc_only`.
17. Przygotowuje zmienne pomocnicze: `unmatched`.
18. Przechodzi po kolejnych elementach i dla każdego wykonuje te same operacje.
19. Przygotowuje zmienne pomocnicze: `fc`.
20. Wywołuje funkcję `args.out.write_text`.
21. Wywołuje funkcję `print`.
