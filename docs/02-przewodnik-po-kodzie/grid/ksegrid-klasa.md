# Klasa `KSEGrid`


**Plik źródłowy:** `kse_grid\grid.py`  
**Linie w kodzie:** 10-80


## Co to jest


To jest klasa o nazwie `KSEGrid`. Klasa grupuje razem dane i metody dotyczące jednego większego zadania.

## Jak myśleć o tej klasie


Najprościej można ją traktować jak pojemnik, który trzyma dane i funkcje związane z jednym zadaniem.

## Metody tej klasy


- [`__init__`](ksegrid-__init__.md)
- [`from_matpower_case`](ksegrid-from_matpower_case.md)
- [`run_powerflow`](ksegrid-run_powerflow.md)
- [`report`](ksegrid-report.md)
- [`serve`](ksegrid-serve.md)

## Oryginalny opis zapisany w kodzie

Fasada łącząca ładowanie pliku MATPOWER z wizualizacją sieci.

Przykłady użycia
----------------
# Załaduj plik .m i otwórz interaktywny dashboard w przeglądarce:
    import kse_grid
    kse_grid.KSEGrid.from_matpower_case("case.m").run_powerflow().serve()

# Dostęp do surowej sieci pandapower:
    grid = kse_grid.KSEGrid.from_matpower_case("case.m").run_powerflow()
    net = grid.net
