# `PowerFlowRunner.summary`


**Plik źródłowy:** `kse_grid\runner.py`  
**Rodzaj:** metoda klasy `PowerFlowRunner`  
**Linie w kodzie:** 41-108


## Co to jest


To jest metoda klasy `PowerFlowRunner`. Po nazwie widać, że odpowiada za fragment logiki związany z: **summary**.

## Nagłówek metody


```python
    def summary(self):
```

## Argumenty


Ta funkcja nie przyjmuje własnych argumentów roboczych.

## Co zwraca


Kod podpowiada, że metoda zwraca: `brak`.

## Co robi krok po kroku


1. Przygotowuje zmienne pomocnicze: `net`.
2. Przygotowuje zmienne pomocnicze: `sep`.
3. Wywołuje funkcję `print`.
4. Wywołuje funkcję `print`.
5. Wywołuje funkcję `print`.
6. Przygotowuje zmienne pomocnicze: `p_gen`.
7. Przygotowuje zmienne pomocnicze: `p_ext`.
8. Przygotowuje zmienne pomocnicze: `p_load`.
9. Przygotowuje zmienne pomocnicze: `p_loss`.
10. Wywołuje funkcję `print`.
11. Wywołuje funkcję `print`.
12. Wywołuje funkcję `print`.
13. Wywołuje funkcję `print`.
14. Wywołuje funkcję `print`.
15. Tworzy lub uzupełnia zmienne `bus_res` na podstawie wyniku funkcji `net.res_bus[["vm_pu", "va_degree"]].copy`.
16. Przygotowuje zmienne pomocnicze: `bus_res["nazwa"]`.
17. Przygotowuje zmienne pomocnicze: `bus_res["vn_kv"]`.
18. Tworzy lub uzupełnia zmienne `bus_res["odchylenie"]` na podstawie wyniku funkcji `bus_res["vm_pu"] - 1.0.abs`.
19. Wywołuje funkcję `print`.
20. Wywołuje funkcję `print`.
21. Wywołuje funkcję `print`.
22. Przechodzi po kolejnych elementach i dla każdego wykonuje te same operacje.
23. Tworzy lub uzupełnia zmienne `line_res` na podstawie wyniku funkcji `net.res_line[["p_from_mw", "loading_percent"]].copy`.
24. Przygotowuje zmienne pomocnicze: `line_res["nazwa"]`.
25. Tworzy lub uzupełnia zmienne `line_res["vn_kv"]` na podstawie wyniku funkcji `net.bus.loc[net.line["from_bus"], "vn_kv"].to_numpy`.
26. Wywołuje funkcję `print`.
27. Wywołuje funkcję `print`.
28. Wywołuje funkcję `print`.
29. Przechodzi po kolejnych elementach i dla każdego wykonuje te same operacje.
30. Tworzy lub uzupełnia zmienne `trafo_res` na podstawie wyniku funkcji `net.res_trafo[["p_hv_mw", "loading_percent"]].copy`.
31. Przygotowuje zmienne pomocnicze: `trafo_res["nazwa"]`.
32. Wywołuje funkcję `print`.
33. Wywołuje funkcję `print`.
34. Wywołuje funkcję `print`.
35. Przechodzi po kolejnych elementach i dla każdego wykonuje te same operacje.
36. Przygotowuje zmienne pomocnicze: `overloaded_lines`.
37. Przygotowuje zmienne pomocnicze: `overloaded_trafos`.
38. Wywołuje funkcję `print`.
39. Sprawdza warunek i wybiera odpowiednią ścieżkę działania.
40. Wywołuje funkcję `print`.

## Oryginalny opis zapisany w kodzie

Drukuje sformatowane podsumowanie wyników load flow.
