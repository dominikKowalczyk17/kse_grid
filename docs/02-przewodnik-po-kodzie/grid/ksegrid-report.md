# `KSEGrid.report`


**Plik źródłowy:** `kse_grid\grid.py`  
**Rodzaj:** metoda klasy `KSEGrid`  
**Linie w kodzie:** 53-68


## Co to jest


To jest metoda klasy `KSEGrid`. Po nazwie widać, że odpowiada za fragment logiki związany z: **report**.

## Nagłówek metody


```python
    def report(self) -> "KSEGrid":
```

## Argumenty


Ta funkcja nie przyjmuje własnych argumentów roboczych.

## Co zwraca


Kod podpowiada, że metoda zwraca: `"KSEGrid"`.

## Co wchodzi

`report()` działa sensownie tylko wtedy, gdy wcześniej load flow się zbiegnie:

```python
grid = KSEGrid.from_matpower_case("data/case3120sp.m").run_powerflow()
grid.report()
```

Jeśli `self._converged` jest `False`, metoda nie rzuca błędu - tylko wypisuje:

```text
Brak wyników – load flow nie zbiegł.
```

## Co wychodzi

Ta metoda nie zwraca nowych danych. Jej prawdziwym wyjściem jest **tekst w terminalu**:

1. woła `self._runner.summary()`,
2. liczy `violations = self._runner.voltage_violations()`,
3. jeśli są naruszenia napięcia, drukuje preview tabeli.

Dla `case3120sp.m` po zbieżnym load flow liczba naruszeń to:

```python
len(grid._runner.voltage_violations())
# 1610
```

## Co robi krok po kroku


1. Sprawdza warunek i wybiera odpowiednią ścieżkę działania.
2. Sprawdza warunek i wybiera odpowiednią ścieżkę działania.
3. Wywołuje funkcję `self._runner.summary`.
4. Tworzy lub uzupełnia zmienne `violations` na podstawie wyniku funkcji `self._runner.voltage_violations`.
5. Sprawdza warunek i wybiera odpowiednią ścieżkę działania.
6. Na końcu zwraca wynik: `self`.

## Oryginalny opis zapisany w kodzie

Drukuje wyniki load flow. Brak efektu, jeśli nie zbiegł.
