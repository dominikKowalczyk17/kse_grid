# `grid.py`

Ten plik to **fasada wysokiego poziomu**. Sam nie robi ciężkiej roboty obliczeniowej - spina moduły `matpower`, `runner` i `web_server` w prosty interfejs łańcuchowy.

## Co wchodzi, co wychodzi

| Metoda | Wejście | Wyjście |
|---|---|---|
| `KSEGrid.from_matpower_case(...)` | ścieżka do pliku `.m` | obiekt `KSEGrid` z uzupełnionym `grid.net` |
| `grid.run_powerflow(...)` | parametry solvera | ten sam `KSEGrid`, ale z wynikami w `net.res_*` |
| `grid.report()` | brak dodatkowych argumentów | ten sam `KSEGrid`, plus raport do terminala |
| `grid.serve(...)` | host, port, `auto_open` | uruchomiony serwer HTTP |

## Typowy przepływ

```python
from kse_grid.grid import KSEGrid

grid = KSEGrid.from_matpower_case("data/case3120sp.m")
grid = grid.run_powerflow()
grid.report()
grid.serve(port=8050)
```

Po kolejnych krokach stan obiektu wygląda tak:

1. Po `from_matpower_case(...)`: istnieje `grid.net`, ale `net.res_bus` może być jeszcze puste.
2. Po `run_powerflow(...)`: `grid._converged` mówi, czy solver się zbiega, a wyniki są w `net.res_bus`, `net.res_line`, `net.res_trafo`.
3. Po `report()`: nic nie zmienia się w danych, tylko drukuje się czytelny skrót wyników.
4. Po `serve()`: `grid.net` jest serializowane do JSON-a i wystawiane przez FastAPI.

## Pliki w tym katalogu

- [`KSEGrid.__init__`](ksegrid-__init__.md)
- [`KSEGrid.from_matpower_case`](ksegrid-from_matpower_case.md)
- [`klasa KSEGrid`](ksegrid-klasa.md)
- [`KSEGrid.report`](ksegrid-report.md)
- [`KSEGrid.run_powerflow`](ksegrid-run_powerflow.md)
- [`KSEGrid.serve`](ksegrid-serve.md)
